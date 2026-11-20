-- Profile photos and optional links (GitHub, Instagram, LinkedIn).
--
-- Photos live in a private storage bucket. Students never touch it directly:
-- the server re-encodes each upload (which also strips location data from
-- phone photos) and serves photos only to signed-in members who can see that
-- profile. Links are stored as usernames, never as URLs, so a profile can't
-- carry a link to anywhere else.

alter table public.profiles
  add column if not exists avatar_path text
    check (avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{16,40}\.webp$'),
  add column if not exists github text
    check (github ~ '^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$'),
  add column if not exists instagram text
    check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column if not exists linkedin text
    check (linkedin ~ '^[A-Za-z0-9][A-Za-z0-9-]{2,99}$');

-- Classmates can see these; students edit their own links directly.
grant select (avatar_path, github, instagram, linkedin) on public.profiles to authenticated;
grant update (github, instagram, linkedin) on public.profiles to authenticated;

-- The photo path changes only through this function, which only the server
-- (service role) can call, right after it has stored the re-encoded file.
-- The path must be in that student's own folder. Returns the previous path so
-- the server can delete the old file.
create or replace function public.set_avatar(p_user uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_path text;
begin
  if p_path is not null and split_part(p_path, '/', 1) <> p_user::text then
    raise exception 'bad_path' using errcode = 'P0001';
  end if;
  select avatar_path into old_path from profiles where id = p_user and status = 'active' for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update profiles set avatar_path = p_path where id = p_user;
  return old_path;
end;
$$;
revoke execute on function public.set_avatar(uuid, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.set_avatar(uuid, text) to service_role;
  end if;
end $$;

-- Your own profile now includes your photo and links.
drop function if exists public.my_profile();
create function public.my_profile()
returns table (
  id uuid, email text, display_name text, programme text, batch_year int, bio text,
  role text, status text, onboarded_at timestamptz, is_founder boolean,
  avatar_path text, github text, instagram text, linkedin text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.email, p.display_name, p.programme, p.batch_year, p.bio, p.role, p.status,
         p.onboarded_at, p.is_founder, p.avatar_path, p.github, p.instagram, p.linkedin
  from public.profiles p where p.id = auth.uid();
$$;
revoke execute on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- Private bucket: 1 MB WebP files only. No policies for students, so only
-- the server (service role) can read or write it.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', false, 1048576, array['image/webp'])
    on conflict (id) do update
      set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/webp'];
  end if;
end $$;
