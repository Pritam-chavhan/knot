-- Founder dashboard: activity counts and admin controls.
--
-- Activity is recorded as one row per student per day they open the app,
-- nothing finer. It powers daily, weekly and monthly active counts.

alter table public.profiles add column if not exists last_seen_at timestamptz;

create table public.daily_activity (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  primary key (profile_id, day)
);
create index daily_activity_day on public.daily_activity (day);
alter table public.daily_activity enable row level security;
-- No policies: only the functions below read or write it.
revoke all on public.daily_activity from authenticated, anon;

-- Called when a signed-in student opens the app. Writes at most once an hour.
create or replace function public.touch_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
  if found then
    insert into public.daily_activity (profile_id, day)
    values (auth.uid(), (now() at time zone 'Asia/Kolkata')::date)
    on conflict do nothing;
  end if;
end;
$$;

-- Admin actions now include role changes and event controls.
alter table public.moderation_actions drop constraint if exists moderation_actions_action_check;
alter table public.moderation_actions add constraint moderation_actions_action_check
  check (action in ('dismiss', 'warn', 'hide_event', 'cancel_event', 'restore_event', 'suspend_user', 'restore', 'make_admin', 'remove_admin'));

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
end;
$$;

-- All the founder numbers in one call.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inst uuid := public.my_institution();
  today date := (now() at time zone 'Asia/Kolkata')::date;
  result jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'students', (select count(*) from profiles where institution_id = inst),
    'onboarded', (select count(*) from profiles where institution_id = inst and onboarded_at is not null),
    'suspended', (select count(*) from profiles where institution_id = inst and status = 'suspended'),
    'signups_today', (select count(*) from profiles where institution_id = inst and (created_at at time zone 'Asia/Kolkata')::date = today),
    'signups_7d', (select count(*) from profiles where institution_id = inst and created_at > now() - interval '7 days'),
    'active_today', (select count(*) from daily_activity a join profiles p on p.id = a.profile_id where p.institution_id = inst and a.day = today),
    'active_7d', (select count(distinct a.profile_id) from daily_activity a join profiles p on p.id = a.profile_id where p.institution_id = inst and a.day > today - 7),
    'active_30d', (select count(distinct a.profile_id) from daily_activity a join profiles p on p.id = a.profile_id where p.institution_id = inst and a.day > today - 30),
    'events_upcoming', (select count(*) from events where institution_id = inst and status in ('published', 'full') and starts_at > now()),
    'events_added', (select count(*) from events where institution_id = inst and source_type in ('official', 'community')),
    'plans_hosted', (select count(*) from events where institution_id = inst and source_type = 'student_hosted'),
    'going_taps', (select count(*) from event_participation ep join events e on e.id = ep.event_id where e.institution_id = inst and ep.state = 'going'),
    'interested_taps', (select count(*) from event_participation ep join events e on e.id = ep.event_id where e.institution_id = inst and ep.state = 'interested'),
    'join_requests', (select count(*) from event_join_requests r join events e on e.id = r.event_id where e.institution_id = inst),
    'join_accepted', (select count(*) from event_join_requests r join events e on e.id = r.event_id where e.institution_id = inst and r.status = 'accepted'),
    'open_reports', (select count(*) from reports where status in ('open', 'reviewing')),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'signups', s.n, 'active', a.n) order by d), '[]'::jsonb)
      from generate_series(today - 29, today, interval '1 day') d
      cross join lateral (
        select count(*) n from profiles where institution_id = inst and (created_at at time zone 'Asia/Kolkata')::date = d::date
      ) s
      cross join lateral (
        select count(*) n from daily_activity x join profiles p on p.id = x.profile_id where p.institution_id = inst and x.day = d::date
      ) a
    )
  ) into result;
  return result;
end;
$$;

-- Search students by name or email.
create or replace function public.admin_people(p_query text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, email text, display_name text, programme text, batch_year int, role text, status text,
  created_at timestamptz, last_seen_at timestamptz, onboarded boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := nullif(trim(coalesce(p_query, '')), '');
begin
  perform public.require_admin();
  return query
    select p.id, p.email, p.display_name, p.programme, p.batch_year, p.role, p.status,
           p.created_at, p.last_seen_at, p.onboarded_at is not null
    from profiles p
    where p.institution_id = public.my_institution()
      and (q is null
           or p.email ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
           or p.display_name ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%')
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

-- Suspend or restore a student. Suspended students are signed out of every
-- page and hidden from everyone.
create or replace function public.admin_set_status(p_profile uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles;
begin
  perform public.require_admin();
  if p_status not in ('active', 'suspended') then
    raise exception 'bad_status' using errcode = 'P0001';
  end if;
  if p_profile = auth.uid() then
    raise exception 'not_yourself' using errcode = 'P0001';
  end if;
  select * into target from profiles where id = p_profile and institution_id = public.my_institution() for update;
  if target.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if target.status = p_status then
    return;
  end if;
  update profiles set status = p_status where id = target.id;
  insert into moderation_actions (admin_id, action, target_type, target_id, note)
  values (auth.uid(), case when p_status = 'suspended' then 'suspend_user' else 'restore' end, 'profile', target.id, nullif(trim(p_note), ''));
end;
$$;

-- Give or remove admin rights. You can't remove your own, so the app always
-- keeps at least the person making the change.
create or replace function public.admin_set_role(p_profile uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles;
begin
  perform public.require_admin();
  if p_role not in ('student', 'admin') then
    raise exception 'bad_role' using errcode = 'P0001';
  end if;
  if p_profile = auth.uid() then
    raise exception 'not_yourself' using errcode = 'P0001';
  end if;
  select * into target from profiles where id = p_profile and institution_id = public.my_institution() for update;
  if target.id is null or target.status <> 'active' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if target.role = p_role then
    return;
  end if;
  update profiles set role = p_role where id = target.id;
  insert into moderation_actions (admin_id, action, target_type, target_id)
  values (auth.uid(), case when p_role = 'admin' then 'make_admin' else 'remove_admin' end, 'profile', target.id);
end;
$$;

-- Events across the institution, with counts, newest start first.
create or replace function public.admin_events(p_limit int default 100)
returns table (
  id uuid, title text, source_type text, status text, review_status text, starts_at timestamptz,
  venue text, host_name text, going bigint, interested bigint, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return query
    select e.id, e.title, e.source_type, e.status, e.review_status, e.starts_at, e.venue, h.display_name,
      (select count(*) from event_participation p where p.event_id = e.id and p.state = 'going'),
      (select count(*) from event_participation p where p.event_id = e.id and p.state = 'interested'),
      e.created_at
    from events e
    left join profiles h on h.id = e.host_id
    where e.institution_id = public.my_institution()
      and e.starts_at > now() - interval '14 days'
    order by e.starts_at desc
    limit least(greatest(p_limit, 1), 200);
end;
$$;

-- Cancel, hide or restore any event.
create or replace function public.admin_event_action(p_event uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.events;
begin
  perform public.require_admin();
  select * into e from events where id = p_event and institution_id = public.my_institution() for update;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_action = 'cancel_event' then
    update events set status = 'cancelled' where id = e.id;
  elsif p_action = 'hide_event' then
    update events set review_status = 'rejected' where id = e.id;
  elsif p_action = 'restore_event' then
    update events set review_status = 'approved',
      status = case when e.status = 'cancelled' then 'published' else e.status end
    where id = e.id;
    perform public.refresh_event_fullness(e.id);
  else
    raise exception 'bad_action' using errcode = 'P0001';
  end if;
  insert into moderation_actions (admin_id, action, target_type, target_id, note)
  values (auth.uid(), p_action, 'event', e.id, nullif(trim(p_note), ''));
end;
$$;

-- Recent admin actions with names, for the log.
create or replace function public.admin_log(p_limit int default 50)
returns table (id uuid, created_at timestamptz, action text, admin_name text, target_type text, target_id uuid, target_label text, note text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return query
    select m.id, m.created_at, m.action, a.display_name, m.target_type, m.target_id,
      coalesce(
        case when m.target_type = 'profile' then (select coalesce(p.display_name, p.email) from profiles p where p.id = m.target_id) end,
        case when m.target_type = 'event' then (select ev.title from events ev where ev.id = m.target_id) end,
        'Removed'
      ),
      m.note
    from moderation_actions m
    join profiles a on a.id = m.admin_id
    where a.institution_id = public.my_institution()
    order by m.created_at desc
    limit least(greatest(p_limit, 1), 200);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'touch_activity()', 'require_admin()', 'admin_stats()', 'admin_people(text, int, int)',
    'admin_set_status(uuid, text, text)', 'admin_set_role(uuid, text)', 'admin_events(int)',
    'admin_event_action(uuid, text, text)', 'admin_log(int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Hardening (from the dashboard security review)
-- ---------------------------------------------------------------------------

-- 1. Classmates see only public profile fields. Email, last seen, role and
--    founder flag are readable only through functions.
revoke select, update on public.profiles from authenticated;
grant select (id, institution_id, display_name, programme, batch_year, bio, status, onboarded_at) on public.profiles to authenticated;
grant update (display_name, programme, batch_year, bio, onboarded_at) on public.profiles to authenticated;

-- Admins change roles and status only through the logged functions.
drop policy if exists profiles_admin on public.profiles;

-- The founder can't be demoted or suspended, and only the founder can
-- demote or suspend another admin.
alter table public.profiles add column if not exists is_founder boolean not null default false;
-- Whoever is an admin when this runs (the founder, at launch) becomes the founder.
update public.profiles set is_founder = true where role = 'admin';

create or replace function public.my_profile()
returns table (
  id uuid, email text, display_name text, programme text, batch_year int, bio text,
  role text, status text, onboarded_at timestamptz, is_founder boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.display_name, p.programme, p.batch_year, p.bio, p.role, p.status, p.onboarded_at, p.is_founder
  from public.profiles p where p.id = auth.uid();
$$;

-- 2. The admin log is append-only: written by functions, read by admins of
--    the same institution, never edited or deleted.
drop policy if exists moderation_admin on public.moderation_actions;
revoke insert, update, delete on public.moderation_actions from authenticated;
create policy moderation_read on public.moderation_actions for select to authenticated
  using (
    public.is_admin()
    and exists (select 1 from public.profiles a where a.id = admin_id and a.institution_id = public.my_institution())
  );
create or replace function public.moderation_log_is_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log_is_append_only' using errcode = 'P0001';
end;
$$;
drop trigger if exists moderation_append_only on public.moderation_actions;
create trigger moderation_append_only before update or delete on public.moderation_actions
  for each row execute function public.moderation_log_is_append_only();

-- 3. Admin rights stop at the institution boundary.
drop policy if exists events_admin on public.events;
create policy events_admin on public.events for all to authenticated
  using (public.is_admin() and institution_id = public.my_institution())
  with check (public.is_admin() and institution_id = public.my_institution());
drop policy if exists announcements_admin on public.source_announcements;
create policy announcements_admin on public.source_announcements for all to authenticated
  using (public.is_admin() and institution_id = public.my_institution())
  with check (public.is_admin() and institution_id = public.my_institution());
drop policy if exists blocked_patterns_admin on public.blocked_email_patterns;
create policy blocked_patterns_admin on public.blocked_email_patterns for all to authenticated
  using (public.is_admin() and institution_id = public.my_institution())
  with check (public.is_admin() and institution_id = public.my_institution());
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or (public.is_admin() and exists (select 1 from public.profiles r where r.id = reporter_id and r.institution_id = public.my_institution()))
  );
drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports for update to authenticated
  using (public.is_admin() and exists (select 1 from public.profiles r where r.id = reporter_id and r.institution_id = public.my_institution()))
  with check (public.is_admin());

-- 4. Suspended students lose access to chats right away.
create or replace function public.is_connection_member(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member() and exists (
    select 1 from public.connections c
    where c.id = p_connection_id
      and auth.uid() in (c.profile_a, c.profile_b)
      and not public.is_blocked_between(c.profile_a, c.profile_b)
  );
$$;

-- 5. Activity: count every day a student opens the app (not only hourly),
--    and never for suspended accounts.
create or replace function public.touch_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member() then
    return;
  end if;
  insert into public.daily_activity (profile_id, day)
  values (auth.uid(), (now() at time zone 'Asia/Kolkata')::date)
  on conflict do nothing;
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
end;
$$;

-- 6. Tighter admin functions.
create or replace function public.admin_set_status(p_profile uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles;
  me public.profiles;
begin
  perform public.require_admin();
  if p_status is null or p_status not in ('active', 'suspended') then
    raise exception 'bad_status' using errcode = 'P0001';
  end if;
  if p_profile = auth.uid() then
    raise exception 'not_yourself' using errcode = 'P0001';
  end if;
  select * into me from profiles where id = auth.uid();
  select * into target from profiles where id = p_profile and institution_id = me.institution_id for update;
  if target.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if target.is_founder or (target.role = 'admin' and not me.is_founder) then
    raise exception 'protected_admin' using errcode = 'P0001';
  end if;
  if target.status = p_status then
    return;
  end if;
  update profiles set status = p_status where id = target.id;
  insert into moderation_actions (admin_id, action, target_type, target_id, note)
  values (auth.uid(), case when p_status = 'suspended' then 'suspend_user' else 'restore' end, 'profile', target.id, left(nullif(trim(p_note), ''), 280));
end;
$$;

create or replace function public.admin_set_role(p_profile uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles;
  me public.profiles;
begin
  perform public.require_admin();
  if p_role is null or p_role not in ('student', 'admin') then
    raise exception 'bad_role' using errcode = 'P0001';
  end if;
  if p_profile = auth.uid() then
    raise exception 'not_yourself' using errcode = 'P0001';
  end if;
  select * into me from profiles where id = auth.uid();
  select * into target from profiles where id = p_profile and institution_id = me.institution_id for update;
  if target.id is null or target.status <> 'active' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if target.is_founder or (target.role = 'admin' and not me.is_founder) then
    raise exception 'protected_admin' using errcode = 'P0001';
  end if;
  if target.role = p_role then
    return;
  end if;
  update profiles set role = p_role where id = target.id;
  insert into moderation_actions (admin_id, action, target_type, target_id)
  values (auth.uid(), case when p_role = 'admin' then 'make_admin' else 'remove_admin' end, 'profile', target.id);
end;
$$;

create or replace function public.admin_event_action(p_event uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.events;
begin
  perform public.require_admin();
  select * into e from events where id = p_event and institution_id = public.my_institution() for update;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_action = 'cancel_event' then
    update events set status = 'cancelled' where id = e.id;
  elsif p_action = 'hide_event' then
    update events set review_status = 'rejected' where id = e.id;
  elsif p_action = 'restore_event' then
    update events set review_status = 'approved',
      status = case when e.status = 'cancelled' then 'published' else e.status end
    where id = e.id;
    perform public.refresh_event_fullness(e.id);
  else
    raise exception 'bad_action' using errcode = 'P0001';
  end if;
  insert into moderation_actions (admin_id, action, target_type, target_id, note)
  values (auth.uid(), p_action, 'event', e.id, left(nullif(trim(p_note), ''), 280));
end;
$$;

-- People search: escape LIKE wildcards (backslash first) and cap the length;
-- include the founder flag so the dashboard can show it.
drop function if exists public.admin_people(text, int, int);
create or replace function public.admin_people(p_query text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, email text, display_name text, programme text, batch_year int, role text, status text,
  created_at timestamptz, last_seen_at timestamptz, onboarded boolean, is_founder boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := left(nullif(trim(coalesce(p_query, '')), ''), 80);
  pat text;
begin
  perform public.require_admin();
  pat := '%' || replace(replace(replace(coalesce(q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select p.id, p.email, p.display_name, p.programme, p.batch_year, p.role, p.status,
           p.created_at, p.last_seen_at, p.onboarded_at is not null, p.is_founder
    from profiles p
    where p.institution_id = public.my_institution()
      and (q is null or p.email ilike pat or p.display_name ilike pat)
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

-- Stats: reports scoped to this institution; dates computed without relying
-- on the session time zone.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inst uuid := public.my_institution();
  today date := (now() at time zone 'Asia/Kolkata')::date;
  result jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'students', (select count(*) from profiles where institution_id = inst),
    'onboarded', (select count(*) from profiles where institution_id = inst and onboarded_at is not null),
    'suspended', (select count(*) from profiles where institution_id = inst and status = 'suspended'),
    'signups_today', (select count(*) from profiles where institution_id = inst and (created_at at time zone 'Asia/Kolkata')::date = today),
    'signups_7d', (select count(*) from profiles where institution_id = inst and created_at > now() - interval '7 days'),
    'active_today', (select count(*) from daily_activity a join profiles p on p.id = a.profile_id where p.institution_id = inst and a.day = today),
    'active_7d', (select count(distinct a.profile_id) from daily_activity a join profiles p on p.id = a.profile_id where p.institution_id = inst and a.day > today - 7),
    'active_30d', (select count(distinct a.profile_id) from daily_activity a join profiles p on p.id = a.profile_id where p.institution_id = inst and a.day > today - 30),
    'events_upcoming', (select count(*) from events where institution_id = inst and status in ('published', 'full') and starts_at > now()),
    'events_added', (select count(*) from events where institution_id = inst and source_type in ('official', 'community')),
    'plans_hosted', (select count(*) from events where institution_id = inst and source_type = 'student_hosted'),
    'going_taps', (select count(*) from event_participation ep join events e on e.id = ep.event_id where e.institution_id = inst and ep.state = 'going'),
    'interested_taps', (select count(*) from event_participation ep join events e on e.id = ep.event_id where e.institution_id = inst and ep.state = 'interested'),
    'join_requests', (select count(*) from event_join_requests r join events e on e.id = r.event_id where e.institution_id = inst),
    'join_accepted', (select count(*) from event_join_requests r join events e on e.id = r.event_id where e.institution_id = inst and r.status = 'accepted'),
    'open_reports', (select count(*) from reports r join profiles p on p.id = r.reporter_id where p.institution_id = inst and r.status in ('open', 'reviewing')),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'signups', s.n, 'active', a.n) order by d), '[]'::jsonb)
      from (select (today - g) as d from generate_series(0, 29) g) days(d)
      cross join lateral (
        select count(*) n from profiles where institution_id = inst and (created_at at time zone 'Asia/Kolkata')::date = days.d
      ) s
      cross join lateral (
        select count(*) n from daily_activity x join profiles p on p.id = x.profile_id where p.institution_id = inst and x.day = days.d
      ) a
    )
  ) into result;
  return result;
end;
$$;

revoke execute on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;
revoke execute on function public.admin_people(text, int, int) from public, anon;
grant execute on function public.admin_people(text, int, int) to authenticated;
revoke execute on function public.moderation_log_is_append_only() from public, anon, authenticated;
