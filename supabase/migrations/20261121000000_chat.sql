-- Connect, chat, block and report.
--
-- Students never write these tables directly. Every change goes through a
-- function that checks both people (same institution, active, not blocked)
-- and rate limits in one transaction.

-- ---------------------------------------------------------------------------
-- 1. Columns and indexes
-- ---------------------------------------------------------------------------

alter table public.connections
  add column if not exists last_message_at timestamptz,
  add column if not exists read_a timestamptz,
  add column if not exists read_b timestamptz;
create index if not exists connections_profile_a on public.connections (profile_a);
create index if not exists connections_profile_b on public.connections (profile_b);
create index if not exists connection_requests_incoming on public.connection_requests (to_id, status, created_at desc);
create index if not exists connection_requests_pair on public.connection_requests (from_id, to_id, created_at desc);

alter table public.reports
  add column if not exists subject_id uuid references public.profiles(id) on delete set null,
  add column if not exists snapshot jsonb,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution text check (resolution in ('dismissed', 'suspended', 'event_hidden'));
create index if not exists reports_queue on public.reports (status, created_at desc);
create index if not exists reports_subject on public.reports (subject_id) where status in ('open', 'reviewing');
create unique index if not exists reports_one_open
  on public.reports (reporter_id, target_type, target_id) where status in ('open', 'reviewing');

-- ---------------------------------------------------------------------------
-- 2. No direct writes
-- ---------------------------------------------------------------------------

drop policy if exists conn_req_insert on public.connection_requests;
drop policy if exists conn_req_cancel on public.connection_requests;
drop policy if exists conn_req_decline on public.connection_requests;
revoke insert, update, delete on public.connection_requests from authenticated;

drop policy if exists connections_delete on public.connections;
revoke insert, update, delete on public.connections from authenticated;

drop policy if exists messages_insert on public.messages;
revoke insert, update, delete on public.messages from authenticated;

drop policy if exists blocks_self on public.blocks;
drop policy if exists blocks_read_own on public.blocks;
create policy blocks_read_own on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
revoke insert, update, delete on public.blocks from authenticated;

drop policy if exists reports_insert on public.reports;
drop policy if exists reports_admin on public.reports;
revoke insert, update, delete on public.reports from authenticated;

drop function if exists public.accept_connection_request(uuid);

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

-- Another onboarded, active student at the caller's institution.
create or replace function public.is_active_peer(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_other is not null and p_other <> auth.uid() and exists (
    select 1 from profiles p
    where p.id = p_other
      and p.status = 'active'
      and p.onboarded_at is not null
      and p.institution_id = public.my_institution()
  );
$$;

-- Turns a pending request into a connection. Internal: callers check rights.
create or replace function public.connect_from_request(p_request uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r connection_requests;
  cid uuid;
begin
  select * into r from connection_requests where id = p_request for update;
  update connection_requests set status = 'accepted' where id = r.id;
  insert into connections (profile_a, profile_b, context, created_from_request)
  values (least(r.from_id, r.to_id), greatest(r.from_id, r.to_id), r.context, r.id)
  on conflict (profile_a, profile_b) do nothing
  returning id into cid;
  if cid is null then
    select id into cid from connections
    where profile_a = least(r.from_id, r.to_id) and profile_b = greatest(r.from_id, r.to_id);
  end if;
  return cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Connection requests
-- ---------------------------------------------------------------------------

-- Returns {state: 'requested' | 'connected', connection_id}.
-- If they already asked you, this connects you straight away. A declined
-- request keeps showing as requested to the sender for 30 days, so nobody
-- learns they were turned down and nobody can ask again and again.
create or replace function public.send_connection_request(p_to uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  note text := nullif(btrim(p_note), '');
  cid uuid;
  incoming uuid;
begin
  if not public.is_member() or not public.is_active_peer(p_to) or public.is_blocked_between(me, p_to) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if note is not null and char_length(note) > 140 then
    raise exception 'note_too_long' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('connect:' || least(me, p_to)::text || greatest(me, p_to)::text, 0));

  select id into cid from connections where profile_a = least(me, p_to) and profile_b = greatest(me, p_to);
  if cid is not null then
    return jsonb_build_object('state', 'connected', 'connection_id', cid);
  end if;

  select id into incoming from connection_requests
  where from_id = p_to and to_id = me and status = 'pending';
  if incoming is not null then
    return jsonb_build_object('state', 'connected', 'connection_id', public.connect_from_request(incoming));
  end if;

  if exists (
    select 1 from connection_requests
    where from_id = me and to_id = p_to
      and (status = 'pending' or (status = 'declined' and updated_at > now() - interval '30 days'))
  ) then
    return jsonb_build_object('state', 'requested');
  end if;

  if not public.accepts_requests(p_to) then
    raise exception 'not_accepting' using errcode = 'P0001';
  end if;
  perform public.check_rate_limit('connection_request', 20, interval '1 day');
  insert into connection_requests (from_id, to_id, context, note) values (me, p_to, 'people', note);
  return jsonb_build_object('state', 'requested');
end;
$$;

create or replace function public.respond_connection_request(p_request uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r connection_requests;
begin
  select * into r from connection_requests where id = p_request for update;
  if r.id is null or r.to_id <> auth.uid() or r.status <> 'pending' or not public.is_member() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if not p_accept then
    update connection_requests set status = 'declined' where id = r.id;
    return jsonb_build_object('state', 'declined');
  end if;
  if public.is_blocked_between(r.from_id, r.to_id) or not public.is_active_peer(r.from_id) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  return jsonb_build_object('state', 'connected', 'connection_id', public.connect_from_request(r.id));
end;
$$;

create or replace function public.cancel_connection_request(p_to uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update connection_requests set status = 'cancelled'
  where from_id = auth.uid() and to_id = p_to and status = 'pending';
$$;

-- Removing a connection deletes the chat for both people.
create or replace function public.remove_connection(p_other uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from connections
  where profile_a = least(auth.uid(), p_other) and profile_b = greatest(auth.uid(), p_other);
$$;

-- Where the caller stands with another student, for the profile button.
create or replace function public.relationship_with(p_other uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  cid uuid;
  rid uuid;
begin
  if p_other = me then
    return jsonb_build_object('state', 'self');
  end if;
  if not public.is_member() or not public.is_active_peer(p_other) or public.is_blocked_between(me, p_other) then
    return jsonb_build_object('state', 'unavailable');
  end if;
  select id into cid from connections where profile_a = least(me, p_other) and profile_b = greatest(me, p_other);
  if cid is not null then
    return jsonb_build_object('state', 'connected', 'connection_id', cid);
  end if;
  select id into rid from connection_requests where from_id = p_other and to_id = me and status = 'pending';
  if rid is not null then
    return jsonb_build_object('state', 'incoming', 'request_id', rid);
  end if;
  if exists (
    select 1 from connection_requests
    where from_id = me and to_id = p_other
      and (status = 'pending' or (status = 'declined' and updated_at > now() - interval '30 days'))
  ) then
    return jsonb_build_object('state', 'requested');
  end if;
  if not public.accepts_requests(p_other) then
    return jsonb_build_object('state', 'closed');
  end if;
  return jsonb_build_object('state', 'none');
end;
$$;

-- Requests waiting for the caller, newest first.
create or replace function public.my_connection_requests()
returns table (
  request_id uuid, from_id uuid, display_name text, programme text, batch_year int,
  avatar_path text, note text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.id, p.id, p.display_name, p.programme, p.batch_year, p.avatar_path, r.note, r.created_at
  from connection_requests r
  join profiles p on p.id = r.from_id
  where public.is_member()
    and r.to_id = auth.uid()
    and r.status = 'pending'
    and p.status = 'active'
    and p.institution_id = public.my_institution()
    and not public.is_blocked_between(r.from_id, r.to_id)
  order by r.created_at desc
  limit 100;
$$;

-- ---------------------------------------------------------------------------
-- 5. Messages
-- ---------------------------------------------------------------------------

-- p_client_id lets the phone retry a send without creating a duplicate.
create or replace function public.send_message(p_connection uuid, p_body text, p_client_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  c connections;
  other uuid;
  body text := btrim(coalesce(p_body, ''));
  m messages;
begin
  if char_length(body) = 0 then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if char_length(body) > 2000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;
  select * into c from connections where id = p_connection;
  if c.id is null or not public.is_connection_member(c.id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  other := case when c.profile_a = me then c.profile_b else c.profile_a end;
  if not public.is_active_peer(other) then
    raise exception 'not_available' using errcode = 'P0001';
  end if;

  if p_client_id is not null then
    select * into m from messages where id = p_client_id;
    if m.id is not null then
      if m.sender_id <> me or m.connection_id <> c.id then
        raise exception 'not_allowed' using errcode = 'P0001';
      end if;
      return jsonb_build_object('id', m.id, 'created_at', m.created_at);
    end if;
  end if;

  perform public.check_rate_limit('message', 60, interval '5 minutes');
  insert into messages (id, connection_id, sender_id, body)
  values (coalesce(p_client_id, gen_random_uuid()), c.id, me, body)
  returning * into m;
  update connections set
    last_message_at = m.created_at,
    read_a = case when profile_a = me then m.created_at else read_a end,
    read_b = case when profile_b = me then m.created_at else read_b end
  where id = c.id;
  return jsonb_build_object('id', m.id, 'created_at', m.created_at);
end;
$$;

create or replace function public.mark_chat_read(p_connection uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update connections set
    read_a = case when profile_a = auth.uid() then now() else read_a end,
    read_b = case when profile_b = auth.uid() then now() else read_b end
  where id = p_connection and auth.uid() in (profile_a, profile_b);
$$;

-- The caller's chats, most recent first, with the last message and how
-- many unread messages each has (counted up to 99).
create or replace function public.my_chats()
returns table (
  connection_id uuid, other_id uuid, display_name text, avatar_path text,
  last_body text, last_from_me boolean, last_at timestamptz, unread int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    o.id,
    o.display_name,
    o.avatar_path,
    left(lm.body, 140),
    lm.sender_id = auth.uid(),
    coalesce(lm.created_at, c.created_at),
    (
      select count(*)::int from (
        select 1 from messages m
        where m.connection_id = c.id
          and m.sender_id <> auth.uid()
          and m.created_at > coalesce(case when c.profile_a = auth.uid() then c.read_a else c.read_b end, '-infinity'::timestamptz)
        limit 99
      ) x
    )
  from connections c
  join profiles o on o.id = case when c.profile_a = auth.uid() then c.profile_b else c.profile_a end
  left join lateral (
    select m.body, m.sender_id, m.created_at from messages m
    where m.connection_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where public.is_member()
    and auth.uid() in (c.profile_a, c.profile_b)
    and o.status = 'active'
    and not public.is_blocked_between(c.profile_a, c.profile_b)
  order by coalesce(lm.created_at, c.created_at) desc
  limit 200;
$$;

-- For the tab badge: chats with unread messages, and requests waiting.
create or replace function public.chat_badge()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'unread_chats', (select count(*) from public.my_chats() where unread > 0),
    'requests', (select count(*) from public.my_connection_requests())
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. Blocks
-- ---------------------------------------------------------------------------

-- Blocking hides both people from each other everywhere, cancels requests
-- between them and closes their chat. Chat history is kept (hidden) so it can
-- still be reported; unblocking brings it back.
create or replace function public.block_profile(p_other uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if not public.is_member() or p_other is null or p_other = me
     or not exists (select 1 from profiles where id = p_other and institution_id = public.my_institution()) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from blocks where blocker_id = me and blocked_id = p_other) then
    return;
  end if;
  perform public.check_rate_limit('block', 30, interval '1 day');
  insert into blocks (blocker_id, blocked_id) values (me, p_other);
  update connection_requests set status = 'cancelled'
  where status = 'pending'
    and ((from_id = me and to_id = p_other) or (from_id = p_other and to_id = me));
  update event_join_requests r set status = 'declined'
  from events e
  where e.id = r.event_id and e.host_id = me and r.profile_id = p_other and r.status = 'pending';
  update event_join_requests r set status = 'withdrawn'
  from events e
  where e.id = r.event_id and e.host_id = p_other and r.profile_id = me and r.status = 'pending';
end;
$$;

create or replace function public.unblock_profile(p_other uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_other;
$$;

-- People the caller has blocked (their profiles are otherwise hidden).
create or replace function public.my_blocks()
returns table (profile_id uuid, display_name text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.blocked_id, p.display_name, b.created_at
  from blocks b
  join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
  limit 200;
$$;

-- ---------------------------------------------------------------------------
-- 7. Reports
-- ---------------------------------------------------------------------------

-- Saves what was reported at that moment, so admins see the evidence even if
-- it is later edited or deleted, without being able to read anyone's chats.
create or replace function public.file_report(p_type text, p_target uuid, p_reason text, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  inst uuid := public.my_institution();
  details text := nullif(btrim(p_details), '');
  subj uuid;
  snap jsonb;
  rid uuid;
  p profiles;
  m messages;
  c connections;
  e events;
begin
  if not public.is_member() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_reason is null or p_reason not in ('harassment', 'unsafe', 'fake', 'spam', 'inappropriate', 'other') then
    raise exception 'bad_reason' using errcode = 'P0001';
  end if;
  if details is not null and char_length(details) > 1000 then
    raise exception 'details_too_long' using errcode = 'P0001';
  end if;

  if p_type = 'profile' then
    select * into p from profiles where id = p_target and institution_id = inst;
    if p.id is null or p.id = me then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    subj := p.id;
    snap := jsonb_build_object(
      'display_name', p.display_name, 'programme', p.programme, 'batch_year', p.batch_year, 'bio', p.bio,
      'github', p.github, 'instagram', p.instagram, 'linkedin', p.linkedin, 'has_photo', p.avatar_path is not null);
  elsif p_type = 'message' then
    select * into m from messages where id = p_target;
    select * into c from connections where id = m.connection_id;
    if m.id is null or c.id is null or me not in (c.profile_a, c.profile_b) or m.sender_id = me then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    subj := m.sender_id;
    snap := jsonb_build_object(
      'sender_name', (select display_name from profiles where id = m.sender_id),
      'message', jsonb_build_object('body', m.body, 'at', m.created_at),
      'thread', (
        select coalesce(jsonb_agg(jsonb_build_object('from_reported', x.sender_id = m.sender_id, 'body', x.body, 'at', x.created_at) order by x.created_at), '[]'::jsonb)
        from (
          select sender_id, body, created_at from messages
          where connection_id = c.id and created_at <= m.created_at
          order by created_at desc
          limit 20
        ) x
      ));
  elsif p_type = 'event' then
    select * into e from events where id = p_target and institution_id = inst;
    if e.id is null or e.host_id = me then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    subj := e.host_id;
    snap := jsonb_build_object(
      'title', e.title, 'description', e.description, 'venue', e.venue, 'starts_at', e.starts_at,
      'source_type', e.source_type, 'host_name', (select display_name from profiles where id = e.host_id));
  else
    raise exception 'bad_type' using errcode = 'P0001';
  end if;

  select id into rid from reports
  where reporter_id = me and target_type = p_type and target_id = p_target and status in ('open', 'reviewing');
  if rid is not null then
    return rid;
  end if;
  perform public.check_rate_limit('report', 10, interval '1 day');
  insert into reports (reporter_id, target_type, target_id, reason, details, subject_id, snapshot)
  values (me, p_type, p_target, p_reason, details, subj, snap)
  returning id into rid;
  return rid;
end;
$$;

create or replace function public.admin_reports(p_open boolean default true, p_limit int default 50)
returns table (
  id uuid, created_at timestamptz, target_type text, target_id uuid, reason text, details text,
  status text, resolution text, resolved_at timestamptz, snapshot jsonb,
  reporter_id uuid, reporter_name text,
  subject_id uuid, subject_name text, subject_status text, subject_protected boolean, subject_open_reports int,
  event_hidden boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();
  return query
  select
    r.id, r.created_at, r.target_type, r.target_id, r.reason, r.details,
    r.status, r.resolution, r.resolved_at, r.snapshot,
    rp.id, rp.display_name,
    s.id, s.display_name, s.status, coalesce(s.is_founder or s.role = 'admin', false),
    (select count(*)::int from reports o where o.subject_id = r.subject_id and o.status in ('open', 'reviewing')),
    case when r.target_type = 'event'
      then (select ev.review_status = 'rejected' from events ev where ev.id = r.target_id) end
  from reports r
  join profiles rp on rp.id = r.reporter_id
  left join profiles s on s.id = r.subject_id
  where rp.institution_id = public.my_institution()
    and (case when p_open then r.status in ('open', 'reviewing') else r.status in ('actioned', 'dismissed') end)
  order by case when p_open then r.created_at end asc, r.resolved_at desc nulls last
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- Dismiss, suspend the person responsible, or hide the event. Acting closes
-- every open report about the same person or event.
create or replace function public.admin_resolve_report(p_report uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rep reports;
  inst uuid := public.my_institution();
begin
  perform public.require_admin();
  select r.* into rep from reports r
  join profiles rp on rp.id = r.reporter_id
  where r.id = p_report and rp.institution_id = inst
  for update of r;
  if rep.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if rep.status not in ('open', 'reviewing') then
    raise exception 'already_resolved' using errcode = 'P0001';
  end if;

  if p_action = 'dismiss' then
    update reports set status = 'dismissed', resolution = 'dismissed', resolved_by = auth.uid(), resolved_at = now()
    where id = rep.id;
    insert into moderation_actions (admin_id, report_id, action, target_type, target_id, note)
    -- A chat message is logged as the person who sent it, so the log reads well.
    values (
      auth.uid(), rep.id, 'dismiss',
      case when rep.target_type = 'message' and rep.subject_id is not null then 'profile' else rep.target_type end,
      case when rep.target_type = 'message' then coalesce(rep.subject_id, rep.target_id) else rep.target_id end,
      left(nullif(btrim(p_note), ''), 280));
  elsif p_action = 'suspend_user' then
    if rep.subject_id is null then
      raise exception 'no_person' using errcode = 'P0001';
    end if;
    perform public.admin_set_status(rep.subject_id, 'suspended', p_note);
    update reports r set status = 'actioned', resolution = 'suspended', resolved_by = auth.uid(), resolved_at = now()
    from profiles rp
    where rp.id = r.reporter_id and rp.institution_id = inst
      and r.status in ('open', 'reviewing')
      and (r.id = rep.id or r.subject_id = rep.subject_id);
  elsif p_action = 'hide_event' then
    if rep.target_type <> 'event' then
      raise exception 'bad_action' using errcode = 'P0001';
    end if;
    perform public.admin_event_action(rep.target_id, 'hide_event', p_note);
    update reports r set status = 'actioned', resolution = 'event_hidden', resolved_by = auth.uid(), resolved_at = now()
    from profiles rp
    where rp.id = r.reporter_id and rp.institution_id = inst
      and r.status in ('open', 'reviewing')
      and r.target_type = 'event' and r.target_id = rep.target_id;
  else
    raise exception 'bad_action' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Live updates and grants
-- ---------------------------------------------------------------------------

-- Realtime applies messages_read, so each student only receives their chats.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

revoke execute on function public.is_active_peer(uuid) from public, anon, authenticated;
revoke execute on function public.connect_from_request(uuid) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'send_connection_request(uuid, text)', 'respond_connection_request(uuid, boolean)',
    'cancel_connection_request(uuid)', 'remove_connection(uuid)', 'relationship_with(uuid)',
    'my_connection_requests()', 'send_message(uuid, text, uuid)', 'mark_chat_read(uuid)',
    'my_chats()', 'chat_badge()', 'block_profile(uuid)', 'unblock_profile(uuid)', 'my_blocks()',
    'file_report(text, uuid, text, text)', 'admin_reports(boolean, int)',
    'admin_resolve_report(uuid, text, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

