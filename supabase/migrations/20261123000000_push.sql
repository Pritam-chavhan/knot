-- Push notifications.
--
-- Each phone that turns notifications on stores one subscription. The server
-- signs pushes with a key pair it creates itself on first use and keeps here,
-- readable only by the server. Each event notifies at most once (push_sent).

create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_profile on public.push_subscriptions (profile_id, created_at desc);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated
  using (profile_id = auth.uid());
grant select on public.push_subscriptions to authenticated;
revoke insert, update, delete on public.push_subscriptions from authenticated;

create table if not exists public.push_keys (
  id int primary key check (id = 1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
alter table public.push_keys enable row level security;
revoke all on public.push_keys from anon, authenticated;

create table if not exists public.push_sent (
  key text primary key check (char_length(key) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists push_sent_created on public.push_sent (created_at);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- This project doesn't grant new tables to the server role automatically.
grant select, delete on public.push_subscriptions to service_role;
grant select, insert on public.push_keys to service_role;
grant select, insert, delete on public.push_sent to service_role;

-- Saves this phone's subscription for the caller. A phone that changes
-- account moves to the new one; at most 10 phones per student.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_member() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or p_p256dh is null or char_length(p_p256dh) not between 20 and 200
     or p_auth is null or char_length(p_auth) not between 8 and 100 then
    raise exception 'bad_subscription' using errcode = 'P0001';
  end if;
  perform public.check_rate_limit('push_subscribe', 20, interval '1 day');
  insert into push_subscriptions (endpoint, profile_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  delete from push_subscriptions
  where profile_id = auth.uid()
    and endpoint not in (select endpoint from push_subscriptions where profile_id = auth.uid() order by created_at desc limit 10);
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from push_subscriptions where endpoint = p_endpoint and profile_id = auth.uid();
$$;

-- Records that an event was notified. Returns false if it already was, so
-- nothing is sent twice. Server only. Old records are cleared after 30 days.
create or replace function public.claim_push(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  delete from push_sent where created_at < now() - interval '30 days';
  insert into push_sent (key) values (left(p_key, 200)) on conflict do nothing;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

revoke execute on function public.claim_push(text) from public, anon, authenticated;
grant execute on function public.claim_push(text) to service_role;

do $$
declare
  f text;
begin
  foreach f in array array['save_push_subscription(text, text, text)', 'delete_push_subscription(text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
