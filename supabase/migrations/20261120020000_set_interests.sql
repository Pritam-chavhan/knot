-- Replaces a student's interests in one step, so a failure can never leave
-- them with none. Runs with the caller's rights: row-level security applies.

create or replace function public.set_my_interests(p_ids int[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 8 then
    raise exception 'too_many_interests' using errcode = 'P0001';
  end if;
  delete from public.profile_interests where profile_id = auth.uid();
  insert into public.profile_interests (profile_id, interest_id)
  select auth.uid(), distinct_id from (select distinct unnest(p_ids) as distinct_id) d;
end;
$$;

revoke execute on function public.set_my_interests(int[]) from public, anon;
grant execute on function public.set_my_interests(int[]) to authenticated;
