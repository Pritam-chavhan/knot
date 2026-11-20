-- Any IITGN subdomain can sign up (name@caa.iitgn.ac.in, name@alumni.iitgn.ac.in
-- and so on). The institution domain itself is fixed at the end: the address
-- must be exactly iitgn.ac.in or end in ".iitgn.ac.in", with up to three
-- properly formed labels in front. Look-alikes such as eviliitgn.ac.in or
-- iitgn.ac.in.example.com never match. Blocked shared mailboxes still apply.

create or replace function public.email_is_allowed(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  local_part text;
  domain_part text;
  inst uuid;
begin
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+$' or length(p_email) > 254 then
    return null;
  end if;
  local_part := lower(split_part(p_email, '@', 1));
  domain_part := lower(split_part(p_email, '@', 2));

  select i.id into inst
  from public.institutions i
  where domain_part = i.email_domain
     or domain_part = any(i.extra_domains)
     or domain_part ~ ('^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.){1,3}' || regexp_replace(i.email_domain, '([.])', '\\\1', 'g') || '$')
  order by length(i.email_domain) desc
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

revoke execute on function public.email_is_allowed(text) from public, anon, authenticated;
grant execute on function public.email_is_allowed(text) to service_role;
