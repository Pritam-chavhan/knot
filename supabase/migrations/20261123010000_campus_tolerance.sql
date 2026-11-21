-- The map said some students on campus were outside it. Two causes:
--   1. The outline missed campus land north along the river and east up to
--      the highway.
--   2. Phone locations drift, by 100 m or more indoors, so a reading near
--      the edge can land outside, and one bad reading stopped sharing.
--
-- Fixes:
--   - A wider outline (still leaving out Palaj village and the settlements
--     north and south-west of campus).
--   - A reading just outside the edge, within the phone's own stated
--     accuracy (at least 50 m, at most 200 m), counts as on campus and is
--     pinned to the edge, so an off-campus home is never shown.
--   - Sharing stops only if the location stays off campus for 3 minutes.

update public.institutions
set map_bounds = jsonb_set(
  jsonb_set(map_bounds, '{polygon}', '[
    [23.2204, 72.6873], [23.2204, 72.6931], [23.218, 72.6952], [23.2142, 72.6935],
    [23.2117, 72.6922], [23.20906, 72.69083], [23.20577, 72.68855], [23.2045, 72.6865],
    [23.2045, 72.68394], [23.20718, 72.68305], [23.20883, 72.68113], [23.21212, 72.68113],
    [23.21447, 72.68279], [23.2165, 72.6843], [23.2185, 72.686]
  ]'::jsonb),
  '{north}', '23.2204'::jsonb) || '{"east": 72.6952}'::jsonb
where email_domain = 'iitgn.ac.in';

alter table public.location_sessions add column if not exists off_campus_since timestamptz;

-- Where a reading lands relative to the caller's campus:
-- {ok, lat, lng, distance_m}. ok means on campus (or within tolerance);
-- lat/lng is the spot to store, pinned to the edge when it was just outside.
create or replace function public.campus_fix(p_lat double precision, p_lng double precision, p_accuracy real)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  b jsonb;
  poly jsonb;
  n int;
  kx float8;
  ky float8 := 110540;
  best float8 := 'infinity';
  best_lat float8;
  best_lng float8;
  ax float8; ay float8; bx float8; by_ float8; px float8; py float8;
  t float8; cx float8; cy float8; d float8;
  tol float8;
begin
  if p_lat is null or p_lng is null then
    return jsonb_build_object('ok', false, 'distance_m', null);
  end if;
  select i.map_bounds into b from institutions i where i.id = public.my_institution();
  if b is null then
    return jsonb_build_object('ok', false, 'distance_m', null);
  end if;
  poly := b->'polygon';
  if jsonb_typeof(poly) <> 'array' then
    -- Colleges with only a box: inside or not.
    return jsonb_build_object('ok', public.location_in_bounds(p_lat, p_lng), 'lat', p_lat, 'lng', p_lng, 'distance_m', 0);
  end if;
  if public.point_in_polygon(p_lat, p_lng, poly) then
    return jsonb_build_object('ok', true, 'lat', p_lat, 'lng', p_lng, 'distance_m', 0);
  end if;

  -- Nearest point on the outline, measured in metres on a flat projection
  -- (accurate to well under a metre at this scale).
  kx := 111320 * cos(radians(p_lat));
  px := p_lng * kx;
  py := p_lat * ky;
  n := jsonb_array_length(poly);
  for i in 0 .. n - 1 loop
    ay := (poly->i->>0)::float8 * ky;
    ax := (poly->i->>1)::float8 * kx;
    by_ := (poly->((i + 1) % n)->>0)::float8 * ky;
    bx := (poly->((i + 1) % n)->>1)::float8 * kx;
    t := ((px - ax) * (bx - ax) + (py - ay) * (by_ - ay)) / nullif((bx - ax) ^ 2 + (by_ - ay) ^ 2, 0);
    t := greatest(0, least(1, coalesce(t, 0)));
    cx := ax + t * (bx - ax);
    cy := ay + t * (by_ - ay);
    d := sqrt((px - cx) ^ 2 + (py - cy) ^ 2);
    if d < best then
      best := d;
      best_lat := cy / ky;
      best_lng := cx / kx;
    end if;
  end loop;

  tol := least(greatest(coalesce(p_accuracy, 0), 50), 200);
  if best <= tol then
    return jsonb_build_object('ok', true, 'lat', best_lat, 'lng', best_lng, 'distance_m', round(best));
  end if;
  return jsonb_build_object('ok', false, 'distance_m', round(best));
end;
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
declare
  fix jsonb;
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
  fix := public.campus_fix(p_lat, p_lng, p_accuracy);
  if not (fix->>'ok')::boolean then
    -- The distance helps the student (and bug reports) understand why.
    raise exception 'off_campus:%', coalesce(fix->>'distance_m', '?') using errcode = 'P0001';
  end if;
  perform public.check_rate_limit('map_start', 30, interval '1 day');
  delete from location_sessions where expires_at < now();
  insert into location_sessions (profile_id, lat, lng, accuracy_m, started_at, expires_at, visibility, precise, off_campus_since)
  values (auth.uid(), (fix->>'lat')::float8, (fix->>'lng')::float8, least(greatest(coalesce(p_accuracy, 0), 0), 5000),
          now(), now() + make_interval(mins => p_minutes), p_visibility, coalesce(p_precise, true), null)
  on conflict (profile_id) do update set
    lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m,
    started_at = excluded.started_at, expires_at = excluded.expires_at,
    visibility = excluded.visibility, precise = excluded.precise, off_campus_since = null;
  return public.my_sharing();
end;
$$;

-- Moves the caller's spot. A reading off campus keeps the last good spot;
-- sharing stops only if readings stay off campus for 3 minutes.
create or replace function public.update_location(p_lat double precision, p_lng double precision, p_accuracy real)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s location_sessions;
  fix jsonb;
begin
  select * into s from location_sessions where profile_id = auth.uid() for update;
  if s.profile_id is null or s.expires_at <= now() or not public.is_member() then
    delete from location_sessions where profile_id = auth.uid();
    return jsonb_build_object('stopped', 'ended');
  end if;
  fix := public.campus_fix(p_lat, p_lng, p_accuracy);
  if not (fix->>'ok')::boolean then
    if s.off_campus_since is not null and s.off_campus_since < now() - interval '3 minutes' then
      delete from location_sessions where profile_id = auth.uid();
      return jsonb_build_object('stopped', 'off_campus');
    end if;
    if s.off_campus_since is null then
      update location_sessions set off_campus_since = now() where profile_id = auth.uid();
    end if;
    return public.my_sharing() || jsonb_build_object('off_campus', true);
  end if;
  -- At most one move every 10 seconds (coming back on campus always counts).
  if s.updated_at > now() - interval '10 seconds' and s.off_campus_since is null then
    return public.my_sharing();
  end if;
  update location_sessions
  set lat = (fix->>'lat')::float8, lng = (fix->>'lng')::float8,
      accuracy_m = least(greatest(coalesce(p_accuracy, 0), 0), 5000), off_campus_since = null
  where profile_id = auth.uid();
  return public.my_sharing();
end;
$$;

revoke execute on function public.campus_fix(double precision, double precision, real) from public, anon, authenticated;
