-- Day 2: the event feed, going/interested, and joining student-hosted plans.
--
-- Capacity on a student-hosted plan counts everyone going, the host included.
-- A plan with join_mode 'open' lets students mark Going until it is full;
-- 'request' means they ask and the host lets them in.

-- Feed rows with counts in one query (no per-event round trips).
create or replace function public.event_feed(
  p_after timestamptz default now() - interval '3 hours',
  p_limit int default 100
)
returns table (
  id uuid,
  title text,
  category text,
  source_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue text,
  organiser text,
  status text,
  join_mode text,
  capacity int,
  host_id uuid,
  host_name text,
  interested bigint,
  going bigint,
  my_state text,
  going_names text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.title, e.category, e.source_type, e.starts_at, e.ends_at, e.venue, e.organiser,
    e.status, e.join_mode, e.capacity, e.host_id, h.display_name,
    (select count(*) from public.event_participation p where p.event_id = e.id and p.state = 'interested'),
    (select count(*) from public.event_participation p where p.event_id = e.id and p.state = 'going'),
    (select p.state from public.event_participation p where p.event_id = e.id and p.profile_id = auth.uid()),
    array(
      select pr.display_name
      from public.event_participation p
      join public.profiles pr on pr.id = p.profile_id
      where p.event_id = e.id and p.state = 'going' and p.is_visible
        and pr.status = 'active' and pr.display_name is not null
        and not public.is_blocked_between(auth.uid(), p.profile_id)
      order by p.created_at
      limit 3
    )
  from public.events e
  left join public.profiles h on h.id = e.host_id
  where public.is_member()
    and e.institution_id = public.my_institution()
    and e.review_status = 'approved'
    and e.status in ('published', 'full', 'cancelled')
    and coalesce(e.ends_at, e.starts_at + interval '3 hours') >= p_after
    and (e.host_id is null or not public.is_blocked_between(auth.uid(), e.host_id))
  order by e.starts_at, e.id
  limit least(greatest(p_limit, 1), 200);
$$;

-- Keeps a hosted plan's status in step with how many are going.
create or replace function public.refresh_event_fullness(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.events;
  n bigint;
begin
  select * into e from public.events where id = p_event_id;
  if e.id is null or e.capacity is null or e.source_type <> 'student_hosted' then
    return;
  end if;
  select count(*) into n from public.event_participation where event_id = e.id and state = 'going';
  update public.events
  set status = case when n >= e.capacity then 'full' else 'published' end
  where id = e.id and status in ('published', 'full');
end;
$$;

-- Mark yourself interested or going, or clear it (p_state null).
-- p_visible null keeps your current visibility, or uses your default.
create or replace function public.set_my_participation(p_event_id uuid, p_state text, p_visible boolean default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.events;
  prev text;
  n bigint;
  vis boolean;
begin
  if not public.is_member() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_state is not null and p_state not in ('interested', 'going') then
    raise exception 'bad_state' using errcode = 'P0001';
  end if;

  -- Lock the event so two people can't take the last spot at once.
  select * into e from public.events where id = p_event_id for update;
  if e.id is null
     or e.institution_id <> public.my_institution()
     or e.review_status <> 'approved'
     or (e.status not in ('published', 'full', 'cancelled', 'completed') and e.host_id is distinct from auth.uid())
     or (e.host_id is not null and public.is_blocked_between(auth.uid(), e.host_id)) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select state into prev from public.event_participation where event_id = e.id and profile_id = auth.uid();

  if p_state is null then
    if e.host_id = auth.uid() then
      raise exception 'host_must_go' using errcode = 'P0001';
    end if;
    delete from public.event_participation where event_id = e.id and profile_id = auth.uid();
    perform public.refresh_event_fullness(e.id);
    return null;
  end if;

  if e.status not in ('published', 'full') then
    raise exception 'event_closed' using errcode = 'P0001';
  end if;
  if coalesce(e.ends_at, e.starts_at + interval '3 hours') < now() then
    raise exception 'event_over' using errcode = 'P0001';
  end if;

  perform public.check_rate_limit('participation', 60, interval '1 hour');

  if p_state = 'going' and prev is distinct from 'going'
     and e.source_type = 'student_hosted' and e.host_id <> auth.uid() then
    if e.join_mode = 'request' then
      raise exception 'request_required' using errcode = 'P0001';
    end if;
    if e.capacity is not null then
      select count(*) into n from public.event_participation where event_id = e.id and state = 'going';
      if n >= e.capacity then
        raise exception 'event_full' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if e.host_id = auth.uid() and p_state <> 'going' then
    raise exception 'host_must_go' using errcode = 'P0001';
  end if;

  vis := coalesce(p_visible, (select show_going_default from public.privacy_settings where profile_id = auth.uid()), false);
  insert into public.event_participation (event_id, profile_id, state, is_visible)
  values (e.id, auth.uid(), p_state, vis)
  on conflict (event_id, profile_id) do update
    set state = excluded.state,
        is_visible = coalesce(p_visible, public.event_participation.is_visible);

  perform public.refresh_event_fullness(e.id);
  return p_state;
end;
$$;

-- Ask to join a plan that needs the host's OK.
create or replace function public.request_to_join(p_event_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.events;
  rid uuid;
begin
  if not public.is_member() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_note is not null and char_length(p_note) > 280 then
    raise exception 'note_too_long' using errcode = 'P0001';
  end if;
  select * into e from public.events where id = p_event_id;
  if e.id is null
     or e.institution_id <> public.my_institution()
     or e.review_status <> 'approved'
     or e.host_id = auth.uid()
     or public.is_blocked_between(auth.uid(), e.host_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if e.join_mode <> 'request' then
    raise exception 'not_request_event' using errcode = 'P0001';
  end if;
  if e.status <> 'published' then
    raise exception 'event_closed' using errcode = 'P0001';
  end if;

  perform public.check_rate_limit('join_request', 20, interval '1 day');

  insert into public.event_join_requests (event_id, profile_id, note)
  values (e.id, auth.uid(), nullif(trim(p_note), ''))
  on conflict (event_id, profile_id) do update
    set status = 'pending', note = excluded.note
    where public.event_join_requests.status = 'withdrawn'
  returning id into rid;

  if rid is null then
    -- Already pending, accepted or declined: nothing changes.
    select id into rid from public.event_join_requests where event_id = e.id and profile_id = auth.uid();
  end if;
  return rid;
end;
$$;

-- The host lets someone in, or says no. Letting in adds them as going.
create or replace function public.respond_join_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.event_join_requests;
  e public.events;
  n bigint;
  vis boolean;
begin
  select * into r from public.event_join_requests where id = p_request_id for update;
  if r.id is null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into e from public.events where id = r.event_id for update;
  if e.host_id is distinct from auth.uid() or not public.is_member() or r.status <> 'pending' then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.event_join_requests set status = 'declined' where id = r.id;
    return 'declined';
  end if;

  if public.is_blocked_between(e.host_id, r.profile_id) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if e.status not in ('published', 'full') then
    raise exception 'event_closed' using errcode = 'P0001';
  end if;
  if e.capacity is not null then
    select count(*) into n from public.event_participation where event_id = e.id and state = 'going';
    if n >= e.capacity then
      raise exception 'event_full' using errcode = 'P0001';
    end if;
  end if;

  update public.event_join_requests set status = 'accepted' where id = r.id;
  vis := coalesce((select show_going_default from public.privacy_settings where profile_id = r.profile_id), true);
  insert into public.event_participation (event_id, profile_id, state, is_visible)
  values (e.id, r.profile_id, 'going', vis)
  on conflict (event_id, profile_id) do update set state = 'going';

  perform public.refresh_event_fullness(e.id);
  return 'accepted';
end;
$$;

create index if not exists event_join_requests_event on public.event_join_requests (event_id, status);

revoke execute on function public.event_feed(timestamptz, int) from public, anon;
revoke execute on function public.refresh_event_fullness(uuid) from public, anon, authenticated;
revoke execute on function public.set_my_participation(uuid, text, boolean) from public, anon;
revoke execute on function public.request_to_join(uuid, text) from public, anon;
revoke execute on function public.respond_join_request(uuid, boolean) from public, anon;
grant execute on function public.event_feed(timestamptz, int) to authenticated;
grant execute on function public.set_my_participation(uuid, text, boolean) to authenticated;
grant execute on function public.request_to_join(uuid, text) to authenticated;
grant execute on function public.respond_join_request(uuid, boolean) to authenticated;

-- Going/interested and join requests now change only through the functions
-- above, so capacity, host approval and rate limits can't be skipped.
drop policy if exists participation_write on public.event_participation;
drop policy if exists participation_update on public.event_participation;
drop policy if exists participation_delete on public.event_participation;
revoke insert, update, delete on public.event_participation from authenticated;

drop policy if exists join_requests_insert on public.event_join_requests;
drop policy if exists join_requests_host on public.event_join_requests;
revoke insert on public.event_join_requests from authenticated;

-- ---------------------------------------------------------------------------
-- Hardening (from the Day 2 security review)
-- ---------------------------------------------------------------------------

-- Rate limits: serialize per student and action so parallel calls can't race.
create or replace function public.check_rate_limit(p_action text, p_max int, p_window interval)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_action, 0));
  select count(*) into n from public.rate_limit_events
  where profile_id = auth.uid() and action = p_action and created_at > now() - p_window;
  if n >= p_max then
    raise exception 'rate_limited:%', p_action using errcode = 'P0001';
  end if;
  insert into public.rate_limit_events (profile_id, action) values (auth.uid(), p_action);
end;
$$;

-- Block checks only answer about the person asking, so nobody can probe
-- whether two other people have blocked each other.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.uid() in (a, b)) and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

revoke execute on function public.purge_expired_locations() from public, anon, authenticated;

-- Counts only for events you could open.
create or replace function public.event_counts(p_event_id uuid)
returns table (interested bigint, going bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where p.state = 'interested'),
    count(*) filter (where p.state = 'going')
  from public.event_participation p
  where p.event_id = p_event_id
    and public.is_member()
    and exists (
      select 1 from public.events e
      where e.id = p_event_id
        and e.institution_id = public.my_institution()
        and (
          (e.status in ('published', 'full', 'cancelled', 'completed') and e.review_status = 'approved'
            and (e.host_id is null or not public.is_blocked_between(auth.uid(), e.host_id)))
          or e.host_id = auth.uid()
          or public.is_admin()
        )
    );
$$;

-- Names show only when a student chooses to be visible.
alter table public.privacy_settings alter column show_going_default set default false;

-- Registration links must be https.
alter table public.events drop constraint if exists events_registration_url_check;
alter table public.events add constraint events_registration_url_check check (registration_url ~ '^https://\S+$');

-- Students host and cancel only through these functions; the event row is
-- otherwise writable by admins alone.
drop policy if exists events_insert_host on public.events;
drop policy if exists events_update_host on public.events;

create or replace function public.create_hosted_event(
  p_title text,
  p_category text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue text,
  p_description text,
  p_capacity int,
  p_join_mode text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  eid uuid;
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and status = 'active';
  if me.id is null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_join_mode not in ('open', 'request') then
    raise exception 'bad_join_mode' using errcode = 'P0001';
  end if;
  if p_capacity is not null and (p_capacity < 2 or p_capacity > 500) then
    raise exception 'bad_capacity' using errcode = 'P0001';
  end if;
  if p_starts_at < now() - interval '5 minutes' or p_starts_at > now() + interval '90 days' then
    raise exception 'bad_time' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_venue, '')) not between 2 and 120 then
    raise exception 'bad_venue' using errcode = 'P0001';
  end if;

  perform public.check_rate_limit('host_event', 5, interval '1 day');

  insert into public.events (
    institution_id, source_type, host_id, created_by, title, category, starts_at, ends_at,
    venue, organiser, description, capacity, join_mode, status, review_status
  ) values (
    me.institution_id, 'student_hosted', me.id, me.id, trim(p_title), p_category, p_starts_at, p_ends_at,
    trim(p_venue), me.display_name, nullif(trim(p_description), ''), p_capacity, p_join_mode, 'published', 'approved'
  )
  returning id into eid;

  -- The host is always going and always shown as the host.
  insert into public.event_participation (event_id, profile_id, state, is_visible)
  values (eid, me.id, 'going', true);
  perform public.refresh_event_fullness(eid);
  return eid;
end;
$$;

create or replace function public.cancel_my_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set status = 'cancelled'
  where id = p_event_id and host_id = auth.uid() and status in ('published', 'full');
  if not found then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
end;
$$;

-- Requesters can only withdraw a pending request; a host's answer stands.
drop policy if exists join_requests_withdraw on public.event_join_requests;
revoke update on public.event_join_requests from authenticated;

create or replace function public.withdraw_join_request(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_join_requests
  set status = 'withdrawn'
  where event_id = p_event_id and profile_id = auth.uid() and status = 'pending';
end;
$$;

-- Hosts don't see requests from people they've blocked (or who blocked them).
drop policy if exists join_requests_read on public.event_join_requests;
create policy join_requests_read on public.event_join_requests for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.host_id = auth.uid()
        and not public.is_blocked_between(auth.uid(), profile_id)
    )
  );

-- Tighter versions of the Day 2 functions.
create or replace function public.request_to_join(p_event_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.events;
  rid uuid;
begin
  if not public.is_member() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_note is not null and char_length(p_note) > 280 then
    raise exception 'note_too_long' using errcode = 'P0001';
  end if;
  select * into e from public.events where id = p_event_id;
  if e.id is null
     or e.institution_id <> public.my_institution()
     or e.review_status <> 'approved'
     or e.status not in ('published', 'full', 'cancelled', 'completed')
     or e.host_id = auth.uid()
     or public.is_blocked_between(auth.uid(), e.host_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if e.join_mode <> 'request' then
    raise exception 'not_request_event' using errcode = 'P0001';
  end if;
  if e.status <> 'published' then
    raise exception 'event_closed' using errcode = 'P0001';
  end if;
  if coalesce(e.ends_at, e.starts_at + interval '3 hours') < now() then
    raise exception 'event_over' using errcode = 'P0001';
  end if;

  perform public.check_rate_limit('join_request', 20, interval '1 day');

  insert into public.event_join_requests (event_id, profile_id, note)
  values (e.id, auth.uid(), nullif(trim(p_note), ''))
  on conflict (event_id, profile_id) do update
    set status = 'pending', note = excluded.note
    where public.event_join_requests.status = 'withdrawn'
  returning id into rid;

  if rid is null then
    select id into rid from public.event_join_requests where event_id = e.id and profile_id = auth.uid();
  end if;
  return rid;
end;
$$;

create or replace function public.respond_join_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.event_join_requests;
  e public.events;
  who public.profiles;
  n bigint;
  vis boolean;
begin
  select * into r from public.event_join_requests where id = p_request_id for update;
  if r.id is null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into e from public.events where id = r.event_id for update;
  if e.host_id is distinct from auth.uid() or not public.is_member() or r.status <> 'pending' then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.event_join_requests set status = 'declined' where id = r.id;
    return 'declined';
  end if;

  select * into who from public.profiles where id = r.profile_id;
  if who.id is null or who.status <> 'active' or who.institution_id <> e.institution_id
     or public.is_blocked_between(e.host_id, r.profile_id) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if e.review_status <> 'approved' or e.status not in ('published', 'full') then
    raise exception 'event_closed' using errcode = 'P0001';
  end if;
  if e.capacity is not null then
    select count(*) into n from public.event_participation where event_id = e.id and state = 'going';
    if n >= e.capacity then
      raise exception 'event_full' using errcode = 'P0001';
    end if;
  end if;

  update public.event_join_requests set status = 'accepted' where id = r.id;
  vis := coalesce((select show_going_default from public.privacy_settings where profile_id = r.profile_id), false);
  insert into public.event_participation (event_id, profile_id, state, is_visible)
  values (e.id, r.profile_id, 'going', vis)
  on conflict (event_id, profile_id) do update set state = 'going';

  perform public.refresh_event_fullness(e.id);
  return 'accepted';
end;
$$;

revoke execute on function public.create_hosted_event(text, text, timestamptz, timestamptz, text, text, int, text) from public, anon;
revoke execute on function public.cancel_my_event(uuid) from public, anon;
revoke execute on function public.withdraw_join_request(uuid) from public, anon;
grant execute on function public.create_hosted_event(text, text, timestamptz, timestamptz, text, text, int, text) to authenticated;
grant execute on function public.cancel_my_event(uuid) to authenticated;
grant execute on function public.withdraw_join_request(uuid) to authenticated;
