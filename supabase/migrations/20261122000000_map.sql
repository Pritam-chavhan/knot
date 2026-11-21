-- Live campus map.
--
-- Sharing is opt-in for a set time (15 minutes to 2 hours) and only works on
-- campus; leaving campus stops it. Each student has at most one current spot,
-- deleted when sharing ends, so no history is kept. You see others only while
-- you're sharing yourself, and only people who chose to be seen by you.

-- ---------------------------------------------------------------------------
-- 1. Campus box and session options
-- ---------------------------------------------------------------------------

-- IITGN, between the Sabarmati and the main road. Adjust here if needed.
update public.institutions
set map_bounds = '{"south": 23.2030, "north": 23.2300, "west": 72.6790, "east": 72.6960, "center_lat": 23.2125, "center_lng": 72.6855}'::jsonb
where email_domain = 'iitgn.ac.in' and map_bounds is null;

-- No campus box means no sharing (it used to mean anywhere).
create or replace function public.location_in_bounds(p_lat double precision, p_lng double precision)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select i.map_bounds is not null
      and p_lat between (i.map_bounds->>'south')::float8 and (i.map_bounds->>'north')::float8
      and p_lng between (i.map_bounds->>'west')::float8 and (i.map_bounds->>'east')::float8
    from public.institutions i where i.id = public.my_institution()
  ), false);
$$;

alter table public.location_sessions
  add column if not exists visibility text not null default 'connections' check (visibility in ('connections', 'campus')),
  add column if not exists precise boolean not null default true;
create index if not exists location_sessions_expires on public.location_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- 2. No direct access: everything goes through the functions below
-- ---------------------------------------------------------------------------

drop policy if exists location_read on public.location_sessions;
drop policy if exists location_insert on public.location_sessions;
drop policy if exists location_update on public.location_sessions;
drop policy if exists location_delete on public.location_sessions;
create policy location_read_own on public.location_sessions for select to authenticated
  using (profile_id = auth.uid());
revoke insert, update, delete on public.location_sessions from authenticated;

drop policy if exists waves_insert on public.waves;
revoke insert, update, delete on public.waves from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_connected(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from connections where profile_a = least(p_a, p_b) and profile_b = greatest(p_a, p_b));
$$;

-- Whether the caller may see this student's spot right now: both sharing,
-- same college, active, not blocked, and allowed by the student's choice.
create or replace function public.can_see_location(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_member()
    and p_other <> auth.uid()
    and exists (select 1 from location_sessions mine where mine.profile_id = auth.uid() and mine.expires_at > now())
    and exists (
      select 1 from location_sessions s
      join profiles p on p.id = s.profile_id
      where s.profile_id = p_other
        and s.expires_at > now()
        and p.status = 'active'
        and p.institution_id = public.my_institution()
        and (s.visibility = 'campus' or public.is_connected(auth.uid(), p_other))
    )
    and not public.is_blocked_between(auth.uid(), p_other);
$$;

-- ---------------------------------------------------------------------------
-- 4. Sharing
-- ---------------------------------------------------------------------------

create or replace function public.map_settings()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when public.is_member() then (select i.map_bounds from institutions i where i.id = public.my_institution()) end;
$$;

-- The caller's sharing session, or null.
create or replace function public.my_sharing()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('expires_at', s.expires_at, 'visibility', s.visibility, 'precise', s.precise, 'started_at', s.started_at)
  from location_sessions s
  where s.profile_id = auth.uid() and s.expires_at > now() and public.is_member();
$$;

create or replace function public.start_sharing(
  p_lat double precision, p_lng double precision, p_accuracy real,
  p_minutes int, p_visibility text, p_precise boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_member() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_minutes is null or p_minutes not in (15, 30, 60, 120) then
    raise exception 'bad_duration' using errcode = 'P0001';
  end if;
  if p_visibility is null or p_visibility not in ('connections', 'campus') then
    raise exception 'bad_visibility' using errcode = 'P0001';
  end if;
  if p_lat is null or p_lng is null or not public.location_in_bounds(p_lat, p_lng) then
    raise exception 'off_campus' using errcode = 'P0001';
  end if;
  perform public.check_rate_limit('map_start', 30, interval '1 day');
  delete from location_sessions where expires_at < now();
  insert into location_sessions (profile_id, lat, lng, accuracy_m, started_at, expires_at, visibility, precise)
  values (auth.uid(), p_lat, p_lng, least(greatest(coalesce(p_accuracy, 0), 0), 5000), now(), now() + make_interval(mins => p_minutes), p_visibility, coalesce(p_precise, true))
  on conflict (profile_id) do update set
    lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m,
    started_at = excluded.started_at, expires_at = excluded.expires_at,
    visibility = excluded.visibility, precise = excluded.precise;
  return public.my_sharing();
end;
$$;

-- Moves the caller's spot. Leaving campus ends sharing. Returns the session,
-- or {stopped: reason}.
create or replace function public.update_location(p_lat double precision, p_lng double precision, p_accuracy real)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s location_sessions;
begin
  select * into s from location_sessions where profile_id = auth.uid() for update;
  if s.profile_id is null or s.expires_at <= now() or not public.is_member() then
    delete from location_sessions where profile_id = auth.uid();
    return jsonb_build_object('stopped', 'ended');
  end if;
  if p_lat is null or p_lng is null or not public.location_in_bounds(p_lat, p_lng) then
    delete from location_sessions where profile_id = auth.uid();
    return jsonb_build_object('stopped', 'off_campus');
  end if;
  -- At most one move every 10 seconds.
  if s.updated_at > now() - interval '10 seconds' then
    return public.my_sharing();
  end if;
  update location_sessions
  set lat = p_lat, lng = p_lng, accuracy_m = least(greatest(coalesce(p_accuracy, 0), 0), 5000)
  where profile_id = auth.uid();
  return public.my_sharing();
end;
$$;

create or replace function public.stop_sharing()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from location_sessions where profile_id = auth.uid();
$$;

-- People the caller can see on the map. Rough spots are rounded to about
-- 100 metres here, so the exact position never leaves the database.
create or replace function public.map_people()
returns table (
  profile_id uuid, display_name text, programme text, avatar_path text,
  lat double precision, lng double precision, precise boolean,
  updated_at timestamptz, connected boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from location_sessions where expires_at < now();
  if not exists (select 1 from location_sessions where location_sessions.profile_id = auth.uid()) then
    return;
  end if;
  return query
  select
    s.profile_id, p.display_name, p.programme, p.avatar_path,
    case when s.precise then s.lat else round(s.lat::numeric, 3)::float8 end,
    case when s.precise then s.lng else round(s.lng::numeric, 3)::float8 end,
    s.precise,
    s.updated_at,
    public.is_connected(auth.uid(), s.profile_id)
  from location_sessions s
  join profiles p on p.id = s.profile_id
  where public.can_see_location(s.profile_id)
  order by s.updated_at desc
  limit 300;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Waves
-- ---------------------------------------------------------------------------

-- A wave goes only to someone you can see on the map, once per 30 minutes.
create or replace function public.send_wave(p_to uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_to is null or not public.can_see_location(p_to) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from waves where from_id = auth.uid() and to_id = p_to and created_at > now() - interval '30 minutes') then
    raise exception 'already_waved' using errcode = 'P0001';
  end if;
  perform public.check_rate_limit('wave', 40, interval '1 day');
  insert into waves (from_id, to_id) values (auth.uid(), p_to);
end;
$$;

-- Waves to the caller in the last two hours. Older waves are deleted.
create or replace function public.my_waves()
returns table (wave_id uuid, from_id uuid, display_name text, avatar_path text, created_at timestamptz, visible boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from waves w where w.created_at < now() - interval '1 day';
  return query
  select w.id, w.from_id, p.display_name, p.avatar_path, w.created_at, public.can_see_location(w.from_id)
  from waves w
  join profiles p on p.id = w.from_id
  where public.is_member()
    and w.to_id = auth.uid()
    and w.created_at > now() - interval '2 hours'
    and p.status = 'active'
    and not public.is_blocked_between(w.from_id, w.to_id)
  order by w.created_at desc
  limit 20;
end;
$$;

-- Blocking someone also stops waves between you (the map already hides you
-- from each other through can_see_location).

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.location_in_bounds(double precision, double precision) from public, anon, authenticated;
revoke execute on function public.is_connected(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_see_location(uuid) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'map_settings()', 'my_sharing()',
    'start_sharing(double precision, double precision, real, int, text, boolean)',
    'update_location(double precision, double precision, real)', 'stop_sharing()',
    'map_people()', 'send_wave(uuid)', 'my_waves()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
