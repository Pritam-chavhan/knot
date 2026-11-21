-- People: find other students to connect with.
--
-- people_directory(query, limit) returns students at your college you can
-- see: active, set up, not blocked either way, never yourself.
-- * With a search, it matches name, programme, batch year or an interest.
-- * Without one, it suggests people you may know, best first: shared
--   interests, the same programme and batch, mutual connections and plans
--   you're both going to. People you're already connected with are left out
--   of suggestions (they still turn up in search).
-- Each row says where you stand (none, requested, incoming, connected,
-- closed), so the screen can show the right button.

create or replace function public.people_directory(p_query text default null, p_limit int default 30)
returns table (
  id uuid,
  display_name text,
  programme text,
  batch_year int,
  avatar_path text,
  bio text,
  shared_interests text[],
  mutual_connections int,
  shared_plans int,
  state text,
  score int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  inst uuid := public.my_institution();
  q text := nullif(btrim(coalesce(p_query, '')), '');
  pattern text;
  my_programme text;
  my_batch int;
begin
  if not public.is_member() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if q is not null and char_length(q) > 60 then
    raise exception 'bad_query' using errcode = 'P0001';
  end if;
  -- Search text is matched literally, never as a pattern.
  pattern := '%' || replace(replace(replace(coalesce(q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  select p.programme, p.batch_year into my_programme, my_batch from profiles p where p.id = me;

  return query
  with candidates as (
    select p.*
    from profiles p
    where p.institution_id = inst
      and p.id <> me
      and p.status = 'active'
      and p.onboarded_at is not null
      and not public.is_blocked_between(me, p.id)
      and (
        q is null
        or p.display_name ilike pattern
        or p.programme ilike pattern
        or (q ~ '^\d{4}$' and p.batch_year = q::int)
        or exists (
          select 1 from profile_interests pi join interests i on i.id = pi.interest_id
          where pi.profile_id = p.id and i.name ilike pattern
        )
      )
  ),
  my_conn as (
    select case when c.profile_a = me then c.profile_b else c.profile_a end as other
    from connections c where me in (c.profile_a, c.profile_b)
  ),
  scored as (
    select
      c.id,
      c.display_name,
      c.programme,
      c.batch_year,
      c.avatar_path,
      c.bio,
      c.created_at,
      coalesce((
        select array_agg(i.name order by i.name)
        from profile_interests a
        join profile_interests b on b.interest_id = a.interest_id and b.profile_id = me
        join interests i on i.id = a.interest_id
        where a.profile_id = c.id
      ), '{}') as shared_interests,
      (
        select count(*)::int from connections x
        where c.id in (x.profile_a, x.profile_b)
          and (case when x.profile_a = c.id then x.profile_b else x.profile_a end) in (select other from my_conn)
      ) as mutual_connections,
      (
        select count(distinct e.id)::int
        from event_participation a
        join event_participation b on b.event_id = a.event_id and b.profile_id = me
        join events e on e.id = a.event_id
        where a.profile_id = c.id and a.is_visible
          and e.status in ('published', 'full') and e.review_status = 'approved'
          and e.starts_at > now() - interval '30 days'
      ) as shared_plans,
      public.relationship_with(c.id)->>'state' as state
    from candidates c
  )
  select
    s.id, s.display_name, s.programme, s.batch_year, s.avatar_path,
    left(s.bio, 140),
    s.shared_interests, s.mutual_connections, s.shared_plans, s.state,
    (
      3 * cardinality(s.shared_interests)
      + 2 * s.mutual_connections
      + 2 * s.shared_plans
      + case when my_programme is not null and s.programme = my_programme then 2 else 0 end
      + case when my_batch is not null and s.batch_year = my_batch then 2 else 0 end
      + case when s.state = 'incoming' then 5 else 0 end
    )::int as score
  from scored s
  where q is not null or s.state <> 'connected'
  order by
    case when q is not null and s.display_name ilike (replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%') then 0 else 1 end,
    score desc,
    s.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
end;
$$;

-- How many students at your college you could meet (for the Discover card).
create or replace function public.people_count()
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when public.is_member() then (
    select count(*)::int from profiles p
    where p.institution_id = public.my_institution()
      and p.id <> auth.uid()
      and p.status = 'active'
      and p.onboarded_at is not null
      and not public.is_blocked_between(auth.uid(), p.id)
  ) else 0 end;
$$;

revoke execute on function public.people_directory(text, int) from public, anon;
grant execute on function public.people_directory(text, int) to authenticated;
revoke execute on function public.people_count() from public, anon;
grant execute on function public.people_count() to authenticated;
