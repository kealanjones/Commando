-- ═══════════════════════════════════════════════════════════════════
-- Threads: the strands the section structure misses.
--
-- Sections are a filing system — one item, one place. Work does not arrive
-- that way: Satya's trip is in Commonwealth and in Directorate, sponsorship
-- runs across five ISODP sections. A thread is an overlay, not a move: an
-- item keeps its section and gains a strand.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.threads (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  -- The word the suggestion was built on, kept so the thread can explain
  -- itself and so re-running does not offer the same strand again.
  anchor     text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists threads_owner_idx
  on public.threads (owner_id, created_at desc) where deleted_at is null;

create table if not exists public.task_threads (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  thread_id  uuid not null references public.threads(id) on delete cascade,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, thread_id)
);

create index if not exists task_threads_thread_idx on public.task_threads (owner_id, thread_id);

-- A suggestion turned down must not come back next week. Storing the
-- signature rather than the items means it stays dismissed even as the
-- register changes around it.
create table if not exists public.dismissed_groupings (
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  signature  text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, signature)
);

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.threads             enable row level security;
alter table public.task_threads        enable row level security;
alter table public.dismissed_groupings enable row level security;
alter table public.threads             force row level security;
alter table public.task_threads        force row level security;
alter table public.dismissed_groupings force row level security;

drop policy if exists threads_owner on public.threads;
create policy threads_owner on public.threads
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists task_threads_owner on public.task_threads;
create policy task_threads_owner on public.task_threads
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists dismissed_owner on public.dismissed_groupings;
create policy dismissed_owner on public.dismissed_groupings
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update on public.threads             to authenticated;
grant select, insert, update on public.dismissed_groupings to authenticated;
-- Removing an item from a thread is not destroying anything, so this is the
-- one place a real delete is the right verb.
grant select, insert, update, delete on public.task_threads to authenticated;

revoke delete on public.threads             from authenticated;
revoke delete on public.dismissed_groupings from authenticated;
revoke all on public.threads             from anon;
revoke all on public.task_threads        from anon;
revoke all on public.dismissed_groupings from anon;
