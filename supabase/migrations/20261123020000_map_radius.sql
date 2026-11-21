-- The map still refused students on campus: the logs showed readings about
-- 840 m outside the outline. Phones often share an approximate location
-- (iPhone's "Precise Location" off, Android's "Approximate"), blurred by a
-- kilometre or more. So sharing now works anywhere within 1.5 km of the
-- campus centre, which covers all of campus with room for blurred or
-- drifting locations. Sharing is always the student's own choice.

update public.institutions
set map_bounds = map_bounds || '{"radius_m": 1500}'::jsonb
where email_domain = 'iitgn.ac.in';

-- {ok, lat, lng, distance_m}: within the radius around the campus centre,
-- or inside the outline (or within the phone's accuracy of it). distance_m
-- is how far outside the allowed area a refused reading was.
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
  radius float8;
  from_centre float8;
begin
  if p_lat is null or p_lng is null then
    return jsonb_build_object('ok', false, 'distance_m', null);
  end if;
  select i.map_bounds into b from institutions i where i.id = public.my_institution();
  if b is null then
    return jsonb_build_object('ok', false, 'distance_m', null);
  end if;
  kx := 111320 * cos(radians(p_lat));

  -- 1. Within the radius around the campus centre.
  radius := (b->>'radius_m')::float8;
  if radius is not null and b ? 'center_lat' and b ? 'center_lng' then
    from_centre := sqrt(((p_lat - (b->>'center_lat')::float8) * ky) ^ 2 + ((p_lng - (b->>'center_lng')::float8) * kx) ^ 2);
    if from_centre <= radius then
      return jsonb_build_object('ok', true, 'lat', p_lat, 'lng', p_lng, 'distance_m', 0);
    end if;
  end if;

  poly := b->'polygon';
  if jsonb_typeof(poly) <> 'array' then
    if public.location_in_bounds(p_lat, p_lng) then
      return jsonb_build_object('ok', true, 'lat', p_lat, 'lng', p_lng, 'distance_m', 0);
    end if;
    return jsonb_build_object('ok', false, 'distance_m', round(greatest(coalesce(from_centre - radius, 0), 0)));
  end if;

  -- 2. Inside the outline.
  if public.point_in_polygon(p_lat, p_lng, poly) then
    return jsonb_build_object('ok', true, 'lat', p_lat, 'lng', p_lng, 'distance_m', 0);
  end if;

  -- 3. Just outside the outline, within the phone's accuracy: pin to the edge.
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
  return jsonb_build_object('ok', false, 'distance_m', round(least(best, coalesce(from_centre - radius, best))));
end;
$$;

-- How many people are sharing with everyone on campus right now, for the
-- Who's around card. Only a count: no names or places.
create or replace function public.map_live_count()
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when not public.is_member() then 0 else (
    select count(*)::int
    from location_sessions s
    join profiles p on p.id = s.profile_id
    where s.expires_at > now()
      and s.visibility = 'campus'
      and s.profile_id <> auth.uid()
      and p.status = 'active'
      and p.institution_id = public.my_institution()
      and not public.is_blocked_between(auth.uid(), s.profile_id)
  ) end;
$$;

revoke execute on function public.campus_fix(double precision, double precision, real) from public, anon, authenticated;
revoke execute on function public.map_live_count() from public, anon;
grant execute on function public.map_live_count() to authenticated;
