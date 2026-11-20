-- KNOT initial schema.
-- Every table has row-level security enabled. Access rules live here, in the
-- database, so a bug in application code cannot leak private data.

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Institutions and identity
-- ---------------------------------------------------------------------------

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email_domain text not null unique,
  -- Optional bounding box for the live map: {"south":..,"west":..,"north":..,"east":..}
  map_bounds jsonb,
  created_at timestamptz not null default now()
);

create table public.blocked_email_patterns (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  -- SQL LIKE pattern matched against the local part of the address, e.g. 'dean%'
  pattern text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (institution_id, pattern)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id),
  email text not null unique,
  display_name text check (char_length(display_name) between 1 and 40),
  programme text check (char_length(programme) <= 60),
  batch_year int check (batch_year between 2000 and 2100),
  bio text check (char_length(bio) <= 280),
  role text not null default 'student' check (role in ('student', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.interests (
  id serial primary key,
  name text not null unique
);

create table public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id int not null references public.interests(id) on delete cascade,
  primary key (profile_id, interest_id)
);

create table public.privacy_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  show_going_default boolean not null default true,
  allow_requests boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger privacy_settings_updated_at before update on public.privacy_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions used by policies (security definer, fixed search_path)
-- ---------------------------------------------------------------------------

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active' and p.role = 'admin'
  );
$$;

create or replace function public.my_institution()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institution_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Safety tables (needed by later policies)
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup on public.rate_limit_events (profile_id, action, created_at desc);

-- Records an action and raises if the caller is over the limit.
create or replace function public.check_rate_limit(p_action text, p_max int, p_window interval)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  select count(*) into n from public.rate_limit_events
  where profile_id = auth.uid() and action = p_action and created_at > now() - p_window;
  if n >= p_max then
    raise exception 'rate_limited:%', p_action using errcode = 'P0001';
  end if;
  insert into public.rate_limit_events (profile_id, action) values (auth.uid(), p_action);
end;
$$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.source_announcements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  received_at timestamptz not null default now(),
  from_address text,
  subject text,
  raw_text text not null,
  submitted_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'parsed', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  source_type text not null check (source_type in ('official', 'community', 'student_hosted')),
  source_announcement_id uuid references public.source_announcements(id) on delete set null,
  host_id uuid references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  verified_by uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 4000),
  category text not null check (category in
    ('talk', 'workshop', 'tech', 'sports', 'cultural', 'music', 'games', 'study', 'club', 'social', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text check (char_length(venue) <= 120),
  organiser text check (char_length(organiser) <= 120),
  registration_url text check (registration_url ~ '^https?://'),
  image_url text,
  capacity int check (capacity > 0),
  join_mode text not null default 'none' check (join_mode in ('none', 'open', 'request')),
  status text not null default 'published' check (status in ('draft', 'published', 'full', 'cancelled', 'completed')),
  review_status text not null default 'approved' check (review_status in ('pending', 'approved', 'rejected')),
  extraction_confidence numeric check (extraction_confidence between 0 and 1),
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (source_type <> 'student_hosted' or host_id is not null),
  check (source_type <> 'official' or verified_by is not null),
  check (source_type = 'student_hosted' or join_mode = 'none')
);
create unique index events_dedupe on public.events (institution_id, dedupe_key) where dedupe_key is not null;
create index events_feed on public.events (institution_id, status, starts_at);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_participation (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  state text not null check (state in ('interested', 'going')),
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
create trigger event_participation_updated_at before update on public.event_participation
  for each row execute function public.set_updated_at();

create table public.event_join_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note text check (char_length(note) <= 280),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id)
);
create trigger event_join_requests_updated_at before update on public.event_join_requests
  for each row execute function public.set_updated_at();

-- Aggregate counts without exposing who is attending.
create or replace function public.event_counts(p_event_id uuid)
returns table (interested bigint, going bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where state = 'interested'),
    count(*) filter (where state = 'going')
  from public.event_participation
  where event_id = p_event_id and public.is_member();
$$;

-- ---------------------------------------------------------------------------
-- Connections and messages
-- ---------------------------------------------------------------------------

create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  context text not null check (context in ('event', 'people', 'map')),
  note text check (char_length(note) <= 140),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create unique index connection_requests_one_pending
  on public.connection_requests (from_id, to_id) where status = 'pending';
create trigger connection_requests_updated_at before update on public.connection_requests
  for each row execute function public.set_updated_at();

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  profile_a uuid not null references public.profiles(id) on delete cascade,
  profile_b uuid not null references public.profiles(id) on delete cascade,
  context text not null check (context in ('event', 'people', 'map')),
  created_from_request uuid references public.connection_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  check (profile_a < profile_b),
  unique (profile_a, profile_b)
);

create or replace function public.is_connection_member(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.connections c
    where c.id = p_connection_id
      and auth.uid() in (c.profile_a, c.profile_b)
      and not public.is_blocked_between(c.profile_a, c.profile_b)
  );
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_thread on public.messages (connection_id, created_at);

-- Accepting a request creates the connection atomically.
create or replace function public.accept_connection_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.connection_requests;
  a uuid;
  b uuid;
  cid uuid;
begin
  select * into r from public.connection_requests where id = p_request_id for update;
  if r.id is null or r.to_id <> auth.uid() or r.status <> 'pending' then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if public.is_blocked_between(r.from_id, r.to_id) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  update public.connection_requests set status = 'accepted' where id = r.id;
  a := least(r.from_id, r.to_id);
  b := greatest(r.from_id, r.to_id);
  insert into public.connections (profile_a, profile_b, context, created_from_request)
  values (a, b, r.context, r.id)
  on conflict (profile_a, profile_b) do update set context = excluded.context
  returning id into cid;
  return cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports and moderation
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'event', 'message')),
  target_id uuid not null,
  reason text not null check (reason in ('harassment', 'unsafe', 'fake', 'spam', 'inappropriate', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  report_id uuid references public.reports(id) on delete set null,
  action text not null check (action in ('dismiss', 'warn', 'hide_event', 'suspend_user', 'restore')),
  target_type text not null,
  target_id uuid not null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Live map: one current position per student, no history
-- ---------------------------------------------------------------------------

create table public.location_sessions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real check (accuracy_m >= 0),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (expires_at > started_at and expires_at <= started_at + interval '8 hours')
);
create trigger location_sessions_updated_at before update on public.location_sessions
  for each row execute function public.set_updated_at();

create table public.waves (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index waves_pair on public.waves (from_id, to_id, created_at desc);

-- Keeps the map clean: expired sessions are deleted (no history kept).
create or replace function public.purge_expired_locations()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.location_sessions where expires_at < now();
$$;

-- ---------------------------------------------------------------------------
-- New users: only addresses on an institution domain, never blocked patterns
-- ---------------------------------------------------------------------------

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
  select id into inst from public.institutions where email_domain = domain_part;
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inst uuid;
begin
  inst := public.email_is_allowed(new.email);
  if inst is null then
    raise exception 'email_not_allowed' using errcode = 'P0001';
  end if;
  insert into public.profiles (id, institution_id, email)
  values (new.id, inst, lower(new.email));
  insert into public.privacy_settings (profile_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.institutions enable row level security;
alter table public.blocked_email_patterns enable row level security;
alter table public.profiles enable row level security;
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.privacy_settings enable row level security;
alter table public.blocks enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.source_announcements enable row level security;
alter table public.events enable row level security;
alter table public.event_participation enable row level security;
alter table public.event_join_requests enable row level security;
alter table public.connection_requests enable row level security;
alter table public.connections enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.location_sessions enable row level security;
alter table public.waves enable row level security;

-- Institutions and interests: readable by members; admins manage.
create policy institutions_read on public.institutions for select to authenticated
  using (public.is_member());
create policy interests_read on public.interests for select to authenticated
  using (public.is_member());
create policy interests_admin on public.interests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy blocked_patterns_admin on public.blocked_email_patterns for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Profiles: members see members of their institution, except across a block.
create policy profiles_read on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (
      public.is_member()
      and institution_id = public.my_institution()
      and status = 'active'
      and not public.is_blocked_between(auth.uid(), id)
    )
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Students cannot promote themselves or change their own status or email.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server-side maintenance (no signed-in user) is allowed; signed-in
  -- students may never change these columns on their own profile.
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.email is distinct from old.email
       or new.institution_id is distinct from old.institution_id then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

create policy profile_interests_read on public.profile_interests for select to authenticated
  using (public.is_member());
create policy profile_interests_write on public.profile_interests for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy privacy_self on public.privacy_settings for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Blocks: you manage your own.
create policy blocks_self on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid() and public.is_member());

-- Rate limit log: written only through check_rate_limit().
create policy rate_limit_none on public.rate_limit_events for select to authenticated
  using (false);

-- Announcements: admins only.
create policy announcements_admin on public.source_announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Events.
create policy events_read on public.events for select to authenticated
  using (
    public.is_member()
    and institution_id = public.my_institution()
    and (
      (status in ('published', 'full', 'cancelled', 'completed') and review_status = 'approved'
        and (host_id is null or not public.is_blocked_between(auth.uid(), host_id)))
      or host_id = auth.uid()
      or public.is_admin()
    )
  );
create policy events_insert_host on public.events for insert to authenticated
  with check (
    public.is_member()
    and source_type = 'student_hosted'
    and host_id = auth.uid()
    and created_by = auth.uid()
    and institution_id = public.my_institution()
    and verified_by is null
  );
create policy events_update_host on public.events for update to authenticated
  using (host_id = auth.uid() and source_type = 'student_hosted')
  with check (host_id = auth.uid() and source_type = 'student_hosted' and verified_by is null);
create policy events_admin on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Participation: your own rows; others only when visible and not blocked.
create policy participation_read on public.event_participation for select to authenticated
  using (
    profile_id = auth.uid()
    or (
      public.is_member()
      and is_visible
      and state = 'going'
      and not public.is_blocked_between(auth.uid(), profile_id)
      and exists (select 1 from public.events e where e.id = event_id)
    )
  );
create policy participation_write on public.event_participation for insert to authenticated
  with check (
    profile_id = auth.uid()
    and public.is_member()
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.status in ('published', 'full')
    )
  );
create policy participation_update on public.event_participation for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy participation_delete on public.event_participation for delete to authenticated
  using (profile_id = auth.uid());

-- Join requests: requester and host.
create policy join_requests_read on public.event_join_requests for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  );
create policy join_requests_insert on public.event_join_requests for insert to authenticated
  with check (
    profile_id = auth.uid()
    and public.is_member()
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.join_mode = 'request' and e.status = 'published'
        and not public.is_blocked_between(auth.uid(), e.host_id)
    )
  );
create policy join_requests_withdraw on public.event_join_requests for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and status = 'withdrawn');
create policy join_requests_host on public.event_join_requests for update to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()))
  with check (status in ('accepted', 'declined'));

create or replace function public.accepts_requests(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select allow_requests from public.privacy_settings where profile_id = p_profile), false);
$$;

-- Connection requests: the two parties only.
create policy conn_req_read on public.connection_requests for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy conn_req_insert on public.connection_requests for insert to authenticated
  with check (
    from_id = auth.uid()
    and status = 'pending'
    and public.is_member()
    and not public.is_blocked_between(from_id, to_id)
    and public.accepts_requests(to_id)
  );
create policy conn_req_cancel on public.connection_requests for update to authenticated
  using (from_id = auth.uid()) with check (from_id = auth.uid() and status = 'cancelled');
create policy conn_req_decline on public.connection_requests for update to authenticated
  using (to_id = auth.uid()) with check (to_id = auth.uid() and status = 'declined');

-- Connections: members of the pair; created only via accept_connection_request().
create policy connections_read on public.connections for select to authenticated
  using (auth.uid() in (profile_a, profile_b));
create policy connections_delete on public.connections for delete to authenticated
  using (auth.uid() in (profile_a, profile_b));

-- Messages: only inside a live (unblocked) connection.
create policy messages_read on public.messages for select to authenticated
  using (public.is_connection_member(connection_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_member() and public.is_connection_member(connection_id));

-- Reports: you file and see your own; admins see all.
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_member());
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy moderation_admin on public.moderation_actions for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and admin_id = auth.uid());

-- Live map: you write only your own row; others see live, unblocked sessions.
create or replace function public.location_in_bounds(p_lat double precision, p_lng double precision)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select i.map_bounds is null or (
      p_lat between (i.map_bounds->>'south')::float8 and (i.map_bounds->>'north')::float8
      and p_lng between (i.map_bounds->>'west')::float8 and (i.map_bounds->>'east')::float8
    )
    from public.institutions i where i.id = public.my_institution()
  ), false);
$$;

create policy location_read on public.location_sessions for select to authenticated
  using (
    profile_id = auth.uid()
    or (
      public.is_member()
      and expires_at > now()
      and not public.is_blocked_between(auth.uid(), profile_id)
    )
  );
create policy location_insert on public.location_sessions for insert to authenticated
  with check (profile_id = auth.uid() and public.is_member() and public.location_in_bounds(lat, lng));
create policy location_update on public.location_sessions for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.location_in_bounds(lat, lng));
create policy location_delete on public.location_sessions for delete to authenticated
  using (profile_id = auth.uid());

-- Waves: sender and recipient.
create policy waves_read on public.waves for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy waves_insert on public.waves for insert to authenticated
  with check (
    from_id = auth.uid()
    and public.is_member()
    and not public.is_blocked_between(from_id, to_id)
  );

-- ---------------------------------------------------------------------------
-- Grants (Supabase roles). RLS above decides which rows are visible.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.rate_limit_events from authenticated;
grant execute on function public.event_counts(uuid) to authenticated;
grant execute on function public.check_rate_limit(text, int, interval) to authenticated;
grant execute on function public.accept_connection_request(uuid) to authenticated;
revoke execute on function public.email_is_allowed(text) from public;
grant execute on function public.email_is_allowed(text) to service_role;
