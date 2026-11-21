-- Some IITGN addresses refuse mail from outside IITGN outright ("554 5.7.1
-- Recipient address rejected: Access denied"), so a sign-in code sent from
-- the KNOT Gmail never arrives, not even in spam. The sign-up helper sends
-- from an IITGN account, which those addresses do accept, and now carries
-- a fresh sign-in code itself. So it steps in after 5 quiet minutes instead
-- of 15. Everything else is unchanged.

-- Claims the help emails that are due now. A claim that isn't confirmed
-- within 30 minutes (the sender failed midway) becomes due again.
create or replace function public.claim_signup_nudges(p_institution uuid, p_limit int default 20)
returns table (nudge_id uuid, email text, display_name text, stage text, attempt int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update institutions set helper_seen_at = now() where id = p_institution;
  delete from signup_nudges where status = 'claimed' and claimed_at < now() - interval '30 minutes';

  return query
  with progress as (
    select * from public.signup_progress(p_institution) s
    where s.started_at > now() - interval '2 days'
  ),
  due as (
    select s.profile_id, s.email, s.display_name, s.stage,
      case
        when not exists (select 1 from signup_nudges n where n.profile_id = s.profile_id and n.stage = s.stage and n.attempt = 1)
          and s.since < now() - case when s.stage = 'code_sent' then interval '5 minutes' else interval '20 minutes' end
          then 1
        when exists (
            select 1 from signup_nudges n where n.profile_id = s.profile_id and n.stage = s.stage and n.attempt = 1
              and n.status = 'sent' and n.sent_at < now() - interval '60 minutes')
          and not exists (select 1 from signup_nudges n where n.profile_id = s.profile_id and n.stage = s.stage and n.attempt = 2)
          and s.since < now() - interval '60 minutes'
          then 2
      end as attempt
    from progress s
    -- Skip an address when someone with a near-identical one (same first six
    -- characters, same domain) has since got in: almost always a typo.
    where not exists (
      select 1 from profiles o
      left join auth.users ou on ou.id = o.id
      where o.id <> s.profile_id
        and o.institution_id = p_institution
        and split_part(o.email, '@', 2) = split_part(s.email, '@', 2)
        and left(split_part(o.email, '@', 1), 6) = left(split_part(s.email, '@', 1), 6)
        and (o.onboarded_at is not null or ou.email_confirmed_at is not null or ou.last_sign_in_at is not null)
    )
  ),
  claimed as (
    insert into signup_nudges (profile_id, stage, attempt)
    select d.profile_id, d.stage, d.attempt from due d
    where d.attempt is not null
    order by d.attempt, d.profile_id
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    on conflict on constraint signup_nudges_profile_id_stage_attempt_key do nothing
    returning signup_nudges.id, signup_nudges.profile_id, signup_nudges.stage, signup_nudges.attempt
  )
  select c.id, p.email, p.display_name, c.stage, c.attempt
  from claimed c join profiles p on p.id = c.profile_id;
end;
$$;

