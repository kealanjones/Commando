-- Minimal stand-in for the Supabase platform objects the migrations touch,
-- so the migrations can be validated without a Supabase instance.
-- Roles are cluster-wide, so creating them must tolerate a re-run.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema if not exists auth;
create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- auth.uid() reads the JWT claim; here it reads a session GUC we can set.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Supabase grants the auth schema and uid() to the request roles; without
-- this every policy fails with "permission denied for schema auth".
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants these by default privilege; mirror that so the test
-- exercises RLS rather than missing grants.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
