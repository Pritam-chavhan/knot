-- Campus email feed.
--
-- A small script in the founder's Gmail sends new mailing-list mail to
-- /api/ingest/email with a secret token. The server asks an AI model whether
-- each mail announces an event, changes one or is unrelated.
--
-- Trust: a mail only counts as coming from IITGN if Gmail's own checks
-- (DMARC) confirm the sender's iitgn.ac.in address. Only such mail can
-- publish on its own, and only as a club event unless the founder has marked
-- the sender as official. A mail can only change or cancel an event that the
-- same sender announced; anything else becomes a proposal in the Inbox.
--
-- Privacy: mail that isn't about an event is discarded at once. We keep only
-- a fingerprint of its Message-ID (so it's never processed twice), never its
-- sender, subject or text. Text kept for review is erased after 30 days.

-- The token itself is never stored, only its SHA-256.
alter table public.institutions
  add column if not exists ingest_token_hash text check (ingest_token_hash ~ '^[0-9a-f]{64}$'),
  add column if not exists ingest_official_senders text[] not null default '{}';
create unique index if not exists institutions_ingest_token on public.institutions (ingest_token_hash) where ingest_token_hash is not null;

alter table public.source_announcements
  alter column raw_text drop not null,
  add column if not exists message_hash text check (message_hash ~ '^[0-9a-f]{64}$'),
  add column if not exists outcome text check (outcome in
    ('pending', 'published', 'needs_review', 'updated', 'cancelled', 'duplicate', 'not_event', 'past', 'error')),
  add column if not exists confidence numeric check (confidence between 0 and 1),
  add column if not exists ai_note text check (char_length(ai_note) <= 300),
  add column if not exists event_id uuid references public.events(id) on delete set null,
  add column if not exists sender_verified boolean,
  add column if not exists attempts int not null default 0,
  -- A change the mail asked for that wasn't applied automatically:
  -- {"kind": "update"|"cancel", "before": {...}, "after": {...}, "resolved": bool, "applied": bool}
  add column if not exists proposal jsonb,
  add column if not exists processed_at timestamptz;

-- Not partial, so it can drive "insert unless already seen". NULLs never collide.
create unique index if not exists source_announcements_message
  on public.source_announcements (institution_id, message_hash);
create index if not exists source_announcements_recent
  on public.source_announcements (institution_id, received_at desc);
create index if not exists events_source_announcement
  on public.events (source_announcement_id) where source_announcement_id is not null;

alter table public.source_announcements drop constraint if exists source_announcements_no_text_when_skipped;
alter table public.source_announcements
  add constraint source_announcements_no_text_when_skipped
  check (outcome is null or outcome not in ('not_event', 'past', 'duplicate') or (raw_text is null and subject is null and from_address is null));

-- Who announced an event by mail (lowercased address), so only they can
-- change it automatically later.
alter table public.events add column if not exists mail_sender text check (char_length(mail_sender) <= 254);

-- Discarded or cancelled events no longer block a real announcement with the
-- same name on the same day.
drop index if exists public.events_dedupe;
create unique index events_dedupe on public.events (institution_id, dedupe_key)
  where dedupe_key is not null and review_status <> 'rejected' and status <> 'cancelled';

-- Events found in official institute mail are "official" without a person
-- verifying each one; the sender is the record. (The original rule may have
-- any auto-generated name, so find it by what it checks.)
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.events'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%official%' and pg_get_constraintdef(oid) ilike '%verified_by%'
  loop
    execute format('alter table public.events drop constraint %I', c);
  end loop;
end $$;
alter table public.events add constraint events_official_verified
  check (source_type <> 'official' or verified_by is not null or mail_sender is not null);

alter table public.moderation_actions drop constraint if exists moderation_actions_action_check;
alter table public.moderation_actions add constraint moderation_actions_action_check
  check (action in ('dismiss', 'warn', 'hide_event', 'cancel_event', 'restore_event', 'suspend_user', 'restore', 'make_admin', 'remove_admin',
                    'edit_event', 'apply_change', 'dismiss_change', 'trust_sender', 'untrust_sender'));

-- Students never see the mail log or the token hash. A column-level revoke
-- can't undo a table-level grant, so list what members may read instead.
revoke all on public.source_announcements from anon;
revoke insert, update, delete on public.source_announcements from authenticated;
revoke select on public.institutions from authenticated, anon;
grant select (id, name, email_domain, extra_domains, map_bounds, created_at) on public.institutions to authenticated;

-- ---------------------------------------------------------------------------
-- Server-side (service role) helpers
-- ---------------------------------------------------------------------------

-- Claims a mail for processing. A claim left "pending" for 3 minutes (the
-- previous attempt crashed or timed out) is taken over. Returns the row id
-- and 'claimed', or no id and 'in_progress' / 'seen'.
create or replace function public.ingest_claim(p_institution uuid, p_hash text)
returns table (id uuid, state text, attempts int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed_id uuid;
  claimed_attempts int;
begin
  insert into source_announcements as s (institution_id, message_hash, outcome, raw_text, attempts)
  values (p_institution, p_hash, 'pending', null, 1)
  on conflict (institution_id, message_hash) do update
    set received_at = now(), attempts = s.attempts + 1
    where s.outcome = 'pending' and s.received_at < now() - interval '3 minutes'
  returning s.id, s.attempts into claimed_id, claimed_attempts;
  if claimed_id is not null then
    return query select claimed_id, 'claimed'::text, claimed_attempts;
    return;
  end if;
  return query
    select null::uuid,
           case when a.outcome = 'pending' then 'in_progress' else 'seen' end,
           a.attempts
    from source_announcements a
    where a.institution_id = p_institution and a.message_hash = p_hash;
end;
$$;

-- Erases mail text 30 days after processing.
create or replace function public.ingest_purge_text()
returns int
language sql
security definer
set search_path = public, pg_temp
as $$
  with purged as (
    update source_announcements a
    set raw_text = null, subject = null, from_address = null
    where a.processed_at < now() - interval '30 days'
      and (a.raw_text is not null or a.subject is not null or a.from_address is not null)
    returning 1
  )
  select count(*)::int from purged;
$$;

-- Mails taken in during the last hour, for a flood cap.
create or replace function public.ingest_recent_calls(p_institution uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from source_announcements
  where institution_id = p_institution and received_at > now() - interval '1 hour';
$$;

revoke execute on function public.ingest_claim(uuid, text) from public, anon, authenticated;
revoke execute on function public.ingest_purge_text() from public, anon, authenticated;
revoke execute on function public.ingest_recent_calls(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.ingest_claim(uuid, text) to service_role;
    grant execute on function public.ingest_purge_text() to service_role;
    grant execute on function public.ingest_recent_calls(uuid) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Dashboard (admins of the same institution)
-- ---------------------------------------------------------------------------

drop function if exists public.admin_inbox(int);
create function public.admin_inbox(p_limit int default 50)
returns table (
  id uuid, received_at timestamptz, from_address text, subject text, outcome text, confidence numeric,
  ai_note text, event_id uuid, event_title text, event_starts_at timestamptz, event_review_status text, event_status text,
  sender_verified boolean, sender_official boolean, proposal jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  official text[];
begin
  perform public.require_admin();
  select i.ingest_official_senders into official from institutions i where i.id = public.my_institution();
  return query
    select a.id, a.received_at, a.from_address, a.subject, a.outcome, a.confidence, a.ai_note, a.event_id,
           e.title, e.starts_at, e.review_status, e.status,
           a.sender_verified,
           coalesce(lower(substring(a.from_address from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+')) = any(official), false),
           a.proposal
    from source_announcements a
    left join events e on e.id = a.event_id
    where a.institution_id = public.my_institution()
      and a.outcome is not null
      and a.outcome not in ('not_event', 'past', 'duplicate', 'pending')
    order by (a.outcome = 'needs_review') desc, a.received_at desc
    limit least(greatest(p_limit, 1), 200);
end;
$$;

create or replace function public.admin_inbox_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  inst uuid := public.my_institution();
  week timestamptz := now() - interval '7 days';
begin
  perform public.require_admin();
  return jsonb_build_object(
    'connected', (select ingest_token_hash is not null from institutions where id = inst),
    'official_senders', (select coalesce(array_length(ingest_official_senders, 1), 0) from institutions where id = inst),
    'last_mail_at', (select max(received_at) from source_announcements where institution_id = inst),
    'mails_7d', (select count(*) from source_announcements where institution_id = inst and received_at > week),
    'published_7d', (select count(*) from source_announcements where institution_id = inst and received_at > week and outcome = 'published'),
    'updated_7d', (select count(*) from source_announcements where institution_id = inst and received_at > week and outcome in ('updated', 'cancelled')),
    'skipped_7d', (select count(*) from source_announcements where institution_id = inst and received_at > week and outcome in ('not_event', 'past', 'duplicate')),
    'failed_7d', (select count(*) from source_announcements where institution_id = inst and received_at > week and outcome = 'error')
  );
end;
$$;

-- Edit an institute or club event and publish it, in one logged step.
-- Refuses student plans, cancelled and discarded events.
create or replace function public.admin_save_event(
  p_event uuid, p_source text, p_title text, p_category text, p_starts timestamptz, p_ends timestamptz,
  p_venue text, p_organiser text, p_description text, p_url text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.events;
begin
  perform public.require_admin();
  if p_source not in ('official', 'community') then
    raise exception 'bad_source' using errcode = 'P0001';
  end if;
  select * into e from events where id = p_event and institution_id = public.my_institution() for update;
  if e.id is null or e.source_type = 'student_hosted' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if e.status = 'cancelled' or e.review_status = 'rejected' then
    raise exception 'not_editable' using errcode = 'P0001';
  end if;
  update events set
    source_type = p_source,
    verified_by = case when p_source = 'official' then coalesce(e.verified_by, auth.uid()) else e.verified_by end,
    title = p_title, category = p_category, starts_at = p_starts, ends_at = p_ends,
    venue = p_venue, organiser = p_organiser, description = p_description, registration_url = p_url,
    review_status = 'approved'
  where id = e.id;
  insert into moderation_actions (admin_id, action, target_type, target_id, note)
  values (auth.uid(), 'edit_event', 'event', e.id, case when e.review_status = 'pending' then 'Checked and published' else 'Edited' end);
end;
$$;

-- Apply or dismiss a change proposed by a mail.
create or replace function public.admin_resolve_proposal(p_announcement uuid, p_apply boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a public.source_announcements;
  e public.events;
  after jsonb;
begin
  perform public.require_admin();
  select * into a from source_announcements
  where id = p_announcement and institution_id = public.my_institution() for update;
  if a.id is null or a.proposal is null or coalesce((a.proposal ->> 'resolved')::boolean, false) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_apply then
    select * into e from events where id = a.event_id and institution_id = a.institution_id for update;
    if e.id is null or e.source_type = 'student_hosted' then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    after := a.proposal -> 'after';
    if a.proposal ->> 'kind' = 'cancel' then
      update events set status = 'cancelled' where id = e.id;
    else
      update events set
        starts_at = coalesce((after ->> 'starts_at')::timestamptz, starts_at),
        ends_at = case when after ? 'ends_at' then (after ->> 'ends_at')::timestamptz else ends_at end,
        venue = coalesce(after ->> 'venue', venue)
      where id = e.id;
    end if;
  end if;
  update source_announcements
  set proposal = proposal || jsonb_build_object('resolved', true, 'applied', p_apply),
      outcome = case when p_apply then (case when proposal ->> 'kind' = 'cancel' then 'cancelled' else 'updated' end) else outcome end
  where id = a.id;
  insert into moderation_actions (admin_id, action, target_type, target_id, note)
  values (auth.uid(), case when p_apply then 'apply_change' else 'dismiss_change' end, 'event', a.event_id, left(a.ai_note, 280));
end;
$$;

-- Mark a sender as official (their events get the Official label).
create or replace function public.admin_set_official_sender(p_address text, p_official boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  addr text := lower(trim(p_address));
begin
  perform public.require_admin();
  if addr !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+$' or length(addr) > 254 then
    raise exception 'bad_address' using errcode = 'P0001';
  end if;
  update institutions
  set ingest_official_senders = case
    when p_official then (select coalesce(array_agg(distinct x), '{}') from unnest(ingest_official_senders || addr) x)
    else array_remove(ingest_official_senders, addr) end
  where id = public.my_institution();
  insert into moderation_actions (admin_id, action, target_type, target_id, note)
  values (auth.uid(), case when p_official then 'trust_sender' else 'untrust_sender' end, 'institution', public.my_institution(), addr);
end;
$$;

revoke execute on function public.admin_inbox(int) from public, anon;
revoke execute on function public.admin_inbox_stats() from public, anon;
revoke execute on function public.admin_save_event(uuid, text, text, text, timestamptz, timestamptz, text, text, text, text) from public, anon;
revoke execute on function public.admin_resolve_proposal(uuid, boolean) from public, anon;
revoke execute on function public.admin_set_official_sender(text, boolean) from public, anon;
grant execute on function public.admin_inbox(int) to authenticated;
grant execute on function public.admin_inbox_stats() to authenticated;
grant execute on function public.admin_save_event(uuid, text, text, text, timestamptz, timestamptz, text, text, text, text) to authenticated;
grant execute on function public.admin_resolve_proposal(uuid, boolean) to authenticated;
grant execute on function public.admin_set_official_sender(text, boolean) to authenticated;

-- New and changed events reach open Discover screens right away. Row-level
-- security still decides who receives each change.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
