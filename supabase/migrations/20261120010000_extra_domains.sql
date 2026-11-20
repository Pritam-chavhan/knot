-- Some students have addresses on an institution subdomain (for example
-- name@caa.iitgn.ac.in). Each institution lists the extra domains it accepts.

alter table public.institutions
  add column extra_domains text[] not null default '{}';

create or replace function public.email_is_allowed(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  local_part text;
  domain_part text;
  inst uuid;
begin
  if p_email is null or position('@' in p_email) = 0 then
    return null;
  end if;
  local_part := lower(split_part(p_email, '@', 1));
  domain_part := lower(split_part(p_email, '@', 2));
  select id into inst from public.institutions
  where email_domain = domain_part or domain_part = any(extra_domains)
  limit 1;
  if inst is null then
    return null;
  end if;
  if exists (
    select 1 from public.blocked_email_patterns
    where institution_id = inst and local_part like pattern
  ) then
    return null;
  end if;
  return inst;
end;
$$;

revoke execute on function public.email_is_allowed(text) from public;
grant execute on function public.email_is_allowed(text) to service_role;
