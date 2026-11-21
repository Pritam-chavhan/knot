-- The first group sign-up showed two actions failing again and again:
-- * waving at someone you'd already waved at (44 errors in an hour), because
--   the button didn't remember it, so people kept tapping;
-- * saving a phone's notification subscription, which the app re-saved every
--   time Chats or Profile opened, until the daily limit blocked it and
--   notifications stopped working.
-- Both are now safe to repeat: a repeat is accepted quietly and changes
-- nothing, and only genuinely new subscriptions count toward the limit.

create or replace function public.send_wave(p_to uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_to is null or not public.can_see_location(p_to) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  -- Already waved in the last half hour: nothing more to do.
  if exists (select 1 from waves where from_id = auth.uid() and to_id = p_to and created_at > now() - interval '30 minutes') then
    return;
  end if;
  perform public.check_rate_limit('wave', 40, interval '1 day');
  insert into waves (from_id, to_id) values (auth.uid(), p_to);
end;
$$;

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
  -- This phone is already saved for this student: just refresh its keys.
  update push_subscriptions set p256dh = p_p256dh, auth = p_auth
  where endpoint = p_endpoint and profile_id = auth.uid();
  if found then
    return;
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

-- Students who hit the limit today can turn notifications back on.
delete from public.rate_limit_events where action = 'push_subscribe';

revoke execute on function public.send_wave(uuid) from public, anon;
grant execute on function public.send_wave(uuid) to authenticated;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
