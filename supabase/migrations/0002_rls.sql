-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- The anon key ships to the browser, so RLS is the entire access
-- control story. Enabled on every table, forced on, with no policy
-- granting anything to anon.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles       enable row level security;
alter table public.streams        enable row level security;
alter table public.stream_members enable row level security;
alter table public.sections       enable row level security;
alter table public.tasks          enable row level security;
alter table public.people         enable row level security;
alter table public.task_people    enable row level security;

-- FORCE also applies policies to the table owner, so a mistake in a
-- security-definer function cannot quietly read the whole table.
alter table public.profiles       force row level security;
alter table public.streams        force row level security;
alter table public.stream_members force row level security;
alter table public.sections       force row level security;
alter table public.tasks          force row level security;
alter table public.people         force row level security;
alter table public.task_people    force row level security;

-- ── helpers ────────────────────────────────────────────────────────
-- Can the caller see this owner's stream? Either they own it, or someone
-- shared it with them.
--
-- Security INVOKER, not definer. stream_members already exposes exactly the
-- row this needs through its own stream_members_self_read policy, so there is
-- nothing to elevate for — and a definer function against a FORCE-RLS table
-- has subtle enough semantics that it is not worth relying on.
create or replace function public.can_read_stream(p_owner uuid, p_stream text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select p_owner = auth.uid()
      or exists (
        select 1 from public.stream_members m
        where m.owner_id = p_owner
          and m.stream_id = p_stream
          and m.member_id = auth.uid()
      );
$$;

create or replace function public.can_write_stream(p_owner uuid, p_stream text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select p_owner = auth.uid()
      or exists (
        select 1 from public.stream_members m
        where m.owner_id = p_owner
          and m.stream_id = p_stream
          and m.member_id = auth.uid()
          and m.role = 'editor'
      );
$$;

revoke execute on function public.can_read_stream(uuid, text)  from anon;
revoke execute on function public.can_write_stream(uuid, text) from anon;
grant  execute on function public.can_read_stream(uuid, text)  to authenticated;
grant  execute on function public.can_write_stream(uuid, text) to authenticated;

-- ── profiles ───────────────────────────────────────────────────────
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- A shared stream is useless if you cannot see who owns it.
drop policy if exists profiles_visible_collaborators on public.profiles;
create policy profiles_visible_collaborators on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.stream_members m
      where (m.member_id = auth.uid() and m.owner_id = profiles.id)
         or (m.owner_id  = auth.uid() and m.member_id = profiles.id)
    )
  );

-- ── streams ────────────────────────────────────────────────────────
drop policy if exists streams_read on public.streams;
create policy streams_read on public.streams
  for select to authenticated
  using (public.can_read_stream(owner_id, id));

drop policy if exists streams_write on public.streams;
create policy streams_write on public.streams
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── stream_members ─────────────────────────────────────────────────
-- Only the owner grants access. A member can see that they are a member.
drop policy if exists stream_members_owner on public.stream_members;
create policy stream_members_owner on public.stream_members
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists stream_members_self_read on public.stream_members;
create policy stream_members_self_read on public.stream_members
  for select to authenticated
  using (member_id = auth.uid());

-- ── sections ───────────────────────────────────────────────────────
drop policy if exists sections_read on public.sections;
create policy sections_read on public.sections
  for select to authenticated
  using (public.can_read_stream(owner_id, stream_id));

drop policy if exists sections_write on public.sections;
create policy sections_write on public.sections
  for all to authenticated
  using (public.can_write_stream(owner_id, stream_id))
  with check (public.can_write_stream(owner_id, stream_id));

-- ── tasks ──────────────────────────────────────────────────────────
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select to authenticated
  using (public.can_read_stream(owner_id, stream_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.can_write_stream(owner_id, stream_id));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.can_write_stream(owner_id, stream_id))
  with check (public.can_write_stream(owner_id, stream_id));

-- Deliberately no DELETE policy. Deletion is soft, via deleted_at, so
-- undo always works and a fat-fingered tap on a phone loses nothing.
-- Hard deletes are an admin operation with the service role.

-- ── people ─────────────────────────────────────────────────────────
drop policy if exists people_owner on public.people;
create policy people_owner on public.people
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists task_people_owner on public.task_people;
create policy task_people_owner on public.task_people
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── grants ─────────────────────────────────────────────────────────
-- Supabase's default privileges usually cover this, but relying on them is
-- fragile: state them. RLS is what restricts rows; these grants only decide
-- which roles may reach the tables at all.
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- No DELETE for anyone. Deletion is soft, via deleted_at, so undo always
-- works and a fat-fingered tap on a phone loses nothing.
revoke delete on all tables in schema public from authenticated;

-- ── nothing for anon ───────────────────────────────────────────────
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
