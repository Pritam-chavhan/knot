-- The sign-up helper: a small sender (the campus mail script, running in the
-- founder's IITGN Gmail) asks KNOT every 10 minutes who is stuck signing up,
-- emails them help, and reports back. KNOT keeps the rules:
--
--   code_sent  asked for a code, never entered one: first email after 15
--              minutes of quiet, a follow-up an hour after that
--   verified   entered the code, never finished their profile: first email
--              after 20 minutes, a follow-up an hour after that
--
-- At most two emails per step, never once they've joined, never for sign-ups
-- more than two days old, and never for an address that looks like a typo of
-- someone who then got in. If both emails go unanswered for another hour, the
-- founder is told so they can reach out personally.

create table if not exists public.signup_nudges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stage text not null check (stage in ('code_sent', 'verified')),
  attempt int not null check (attempt in (1, 2)),
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  escalated_at timestamptz,
  unique (profile_id, stage, attempt)
);
create index if not exists signup_nudges_profile on public.signup_nudges (profile_id, sent_at desc);
alter table public.signup_nudges enable row level security;
revoke all on public.signup_nudges from anon, authenticated;
grant select, insert, update, delete on public.signup_nudges to service_role;

alter table public.institutions add column if not exists helper_seen_at timestamptz;

-- Where each unfinished sign-up stands, and since when.
create or replace function public.signup_progress(p_institution uuid)
returns table (profile_id uuid, email text, display_name text, stage text, since timestamptz, started_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.email,
    p.display_name,
    case when u.email_confirmed_at is not null or u.last_sign_in_at is not null then 'verified' else 'code_sent' end,
    case
      when u.email_confirmed_at is not null or u.last_sign_in_at is not null then coalesce(u.last_sign_in_at, u.email_confirmed_at)
      else greatest(p.created_at, coalesce(u.confirmation_sent_at, p.created_at))
    end,
    p.created_at
  from profiles p
  left join auth.users u on u.id = p.id
  where p.institution_id = p_institution
    and p.status = 'active'
    and p.onboarded_at is null;
$$;

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
          and s.since < now() - case when s.stage = 'code_sent' then interval '15 minutes' else interval '20 minutes' end
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

-- The sender reports what happened to each email it was given.
create or replace function public.finish_signup_nudges(p_institution uuid, p_sent uuid[], p_failed uuid[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update signup_nudges n set status = 'sent', sent_at = now()
  from profiles p
  where n.id = any(coalesce(p_sent, '{}')) and p.id = n.profile_id and p.institution_id = p_institution and n.status = 'claimed';
  update signup_nudges n set status = 'failed'
  from profiles p
  where n.id = any(coalesce(p_failed, '{}')) and p.id = n.profile_id and p.institution_id = p_institution and n.status = 'claimed';
$$;

-- Students still stuck an hour after their second email, not yet flagged to
-- the founder. Marks them flagged.
create or replace function public.escalate_signup_nudges(p_institution uuid)
returns table (profile_id uuid, email text, stage text)
language sql
security definer
set search_path = public, pg_temp
as $$
  update signup_nudges n set escalated_at = now()
  from public.signup_progress(p_institution) s
  where n.profile_id = s.profile_id and n.stage = s.stage and n.attempt = 2
    and n.status = 'sent' and n.sent_at < now() - interval '60 minutes'
    and n.escalated_at is null
  returning n.profile_id, s.email, n.stage;
$$;

revoke execute on function public.signup_progress(uuid) from public, anon, authenticated;
revoke execute on function public.claim_signup_nudges(uuid, int) from public, anon, authenticated;
revoke execute on function public.finish_signup_nudges(uuid, uuid[], uuid[]) from public, anon, authenticated;
revoke execute on function public.escalate_signup_nudges(uuid) from public, anon, authenticated;
grant execute on function public.signup_progress(uuid) to service_role;
grant execute on function public.claim_signup_nudges(uuid, int) to service_role;
grant execute on function public.finish_signup_nudges(uuid, uuid[], uuid[]) to service_role;
grant execute on function public.escalate_signup_nudges(uuid) to service_role;

-- The founder's sign-up list now also shows the helper's emails.
drop function if exists public.admin_signups(int);
create function public.admin_signups(p_limit int default 300)
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
  last_seen_at timestamptz,
  help_emails int,
  last_help_at timestamptz
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
    p.last_seen_at,
    (select count(*)::int from signup_nudges n where n.profile_id = p.id and n.status = 'sent'),
    (select max(n.sent_at) from signup_nudges n where n.profile_id = p.id and n.status = 'sent')
  from profiles p
  left join auth.users u on u.id = p.id
  where p.institution_id = public.my_institution()
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end;
$$;
revoke execute on function public.admin_signups(int) from public, anon;
grant execute on function public.admin_signups(int) to authenticated;

-- When the helper last checked in, for the dashboard.
create or replace function public.admin_helper_status()
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when public.is_admin() then (select helper_seen_at from institutions where id = public.my_institution()) end;
$$;
revoke execute on function public.admin_helper_status() from public, anon;
grant execute on function public.admin_helper_status() to authenticated;
