-- The email feed runs on the server with the service role and reads and
-- writes a few tables directly. This project doesn't grant new tables to the
-- service role automatically, so grant exactly what the feed needs.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.institutions to service_role;
    grant select, insert, update on public.events to service_role;
    grant select, update, delete on public.source_announcements to service_role;
  end if;
end $$;
