-- Fence the live map to the campus itself, not a rectangle around it.
--
-- The outline follows IITGN from the river bank round the academic block,
-- sports fields, the housing block along the main road and the security
-- gate, with a small margin. It leaves out Palaj village and the farmland
-- across the road, so nobody living there can share their home by mistake.
-- Points are [lat, lng]. Adjust here if a real campus spot is refused.

create or replace function public.point_in_polygon(p_lat double precision, p_lng double precision, p_poly jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  n int := coalesce(jsonb_array_length(p_poly), 0);
  j int;
  inside boolean := false;
  yi float8; xi float8; yj float8; xj float8;
begin
  if n < 3 or p_lat is null or p_lng is null then
    return false;
  end if;
  j := n - 1;
  for i in 0 .. n - 1 loop
    yi := (p_poly->i->>0)::float8; xi := (p_poly->i->>1)::float8;
    yj := (p_poly->j->>0)::float8; xj := (p_poly->j->>1)::float8;
    if ((yi > p_lat) <> (yj > p_lat)) and (p_lng < (xj - xi) * (p_lat - yi) / (yj - yi) + xi) then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end;
$$;

-- An outline wins over the box; a college with neither can't share.
create or replace function public.location_in_bounds(p_lat double precision, p_lng double precision)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case
      when i.map_bounds is null then false
      when jsonb_typeof(i.map_bounds->'polygon') = 'array' then public.point_in_polygon(p_lat, p_lng, i.map_bounds->'polygon')
      else p_lat between (i.map_bounds->>'south')::float8 and (i.map_bounds->>'north')::float8
       and p_lng between (i.map_bounds->>'west')::float8 and (i.map_bounds->>'east')::float8
    end
    from public.institutions i where i.id = public.my_institution()
  ), false);
$$;

update public.institutions
set map_bounds = '{
  "south": 23.2045, "north": 23.2178, "west": 72.6811, "east": 72.6922,
  "center_lat": 23.2112, "center_lng": 72.6866,
  "polygon": [
    [23.2178, 72.6865], [23.2176, 72.68829], [23.21589, 72.6911], [23.21423, 72.69212],
    [23.21165, 72.69174], [23.20906, 72.69059], [23.20577, 72.68855], [23.2045, 72.6865],
    [23.2045, 72.68394], [23.20718, 72.68305], [23.20883, 72.68113], [23.21212, 72.68113],
    [23.21447, 72.68279], [23.21635, 72.68471]
  ]
}'::jsonb
where email_domain = 'iitgn.ac.in';

revoke execute on function public.point_in_polygon(double precision, double precision, jsonb) from public, anon, authenticated;
revoke execute on function public.location_in_bounds(double precision, double precision) from public, anon, authenticated;
