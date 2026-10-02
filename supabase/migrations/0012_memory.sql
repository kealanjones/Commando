-- ═══════════════════════════════════════════════════════════════════
-- 0012 — memory: what the meetings have taught it
--
-- Every meeting read in feeds a living memory of the work: a note per
-- project, per person and per recurring topic. Each note has a short
-- "now" (where things stand) and a dated timeline of what each meeting
-- added. Each timeline entry remembers the meeting it came from, so a
-- meeting can be forgotten exactly, and every fact can be traced.
--
-- It is personal, like intake: a shared project never shares the memory
-- built from meetings, which routinely cover more than that project.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.memory_notes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('project', 'person', 'topic')),
  -- A project's id, a person's name in lower case, or a topic slug.
  key        text not null,
  title      text not null,
  -- Where things stand, in a few sentences. Rewritten as meetings come in.
  now        text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, kind, key)
);

create table if not exists public.memory_entries (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  note_id     uuid not null references public.memory_notes(id) on delete cascade,
  -- The meeting it came from. Null for something typed in by hand.
  intake_id   uuid references public.intakes(id) on delete set null,
  happened_on date,
  text        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists memory_entries_note_idx
  on public.memory_entries (note_id, happened_on) where deleted_at is null;
create index if not exists memory_entries_intake_idx
  on public.memory_entries (intake_id) where deleted_at is null;

-- Which meetings feed the memory, and which it has already absorbed.
alter table public.intakes add column if not exists in_memory boolean not null default true;
alter table public.intakes add column if not exists remembered_at timestamptz;
-- From the Via Claude route: what Claude wrote for the memory, since the
-- record itself never reaches the app on that route.
alter table public.intakes add column if not exists memory_text text;

alter table public.memory_notes   enable row level security;
alter table public.memory_entries enable row level security;
alter table public.memory_notes   force row level security;
alter table public.memory_entries force row level security;

drop policy if exists memory_notes_owner on public.memory_notes;
create policy memory_notes_owner on public.memory_notes
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists memory_entries_owner on public.memory_entries;
create policy memory_entries_owner on public.memory_entries
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Deleting is a timestamp here too; Erase memory sets it on everything.
grant select, insert, update on public.memory_notes   to authenticated;
grant select, insert, update on public.memory_entries to authenticated;
revoke delete on public.memory_notes   from authenticated;
revoke delete on public.memory_entries from authenticated;
revoke all on public.memory_notes   from anon;
revoke all on public.memory_entries from anon;

comment on table public.memory_notes is
  'A living note per project, person or topic, built from meetings. Personal: never shared with a project.';
comment on table public.memory_entries is
  'One dated line a meeting added to a note. intake_id is how a meeting is forgotten exactly.';
