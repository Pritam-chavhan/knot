-- The founder's view of sign-ups: everyone who has started joining KNOT at
-- this college, and how far they got.
--   code_sent  asked for a sign-in code but hasn't entered it yet
--   verified   entered the code but hasn't finished their profile
--   joined     finished their profile
-- An account is created the moment a code is requested, so a student who
-- never gets past the email step still shows up here. Admins only.

create or replace function public.admin_signups(p_limit int default 300)
returns table (
  id uuid,
  email text,
  display_name text,
  programme text,
  batch_year int,
  status text,
  stage text,
  started_at timestamptz,
  verified_at timestamptz,
  joined_at timestamptz,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  return query
  select
    p.id,
    p.email,
    p.display_name,
    p.programme,
    p.batch_year,
    p.status,
    case
      when p.onboarded_at is not null then 'joined'
      when u.email_confirmed_at is not null or u.last_sign_in_at is not null then 'verified'
      else 'code_sent'
    end,
    p.created_at,
    coalesce(u.email_confirmed_at, u.last_sign_in_at),
    p.onboarded_at,
    p.last_seen_at
  from profiles p
  left join auth.users u on u.id = p.id
  where p.institution_id = public.my_institution()
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end;
$$;

revoke execute on function public.admin_signups(int) from public, anon;
grant execute on function public.admin_signups(int) to authenticated;
