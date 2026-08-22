-- ═══════════════════════════════════════════════════════════════════
-- Work Register — schema
--
-- Single user today, modelled for two. Every row is owned by a profile;
-- access is granted either by ownership or by a row in stream_members,
-- so sharing one stream with an EA later is a row insert, not a migration.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── profiles ───────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now()
);

-- New auth users get a profile automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── streams ────────────────────────────────────────────────────────
-- Natural text ids ('cttl', 'isodp', …) so the seed file stays readable
-- and re-seeding is stable.
create table if not exists public.streams (
  id         text not null,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,   -- full name
  short      text not null,   -- display name, used where space is tight
  code       text not null default '',  -- the pill on a task row
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);

-- ── stream_members ─────────────────────────────────────────────────
-- The whole of the future multi-user story. Empty today.
create table if not exists public.stream_members (
  owner_id   uuid not null,
  stream_id  text not null,
  member_id  uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'editor' check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (owner_id, stream_id, member_id),
  foreign key (owner_id, stream_id) references public.streams(owner_id, id) on delete cascade
);

-- ── sections ───────────────────────────────────────────────────────
create table if not exists public.sections (
  id         text not null,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  stream_id  text not null,
  title      text not null,
  -- tracked but not driven: a section the user watches rather than works
  monitor    boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, stream_id) references public.streams(owner_id, id) on delete cascade
);

-- ── tasks ──────────────────────────────────────────────────────────
-- kind='task'  → something to do. Has a checkbox.
-- kind='watch' → something to remember. Has no checkbox, ever.
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  stream_id   text not null,
  section_id  text not null,

  -- Stable natural key: '<section_id>:<slug(title)>'. NULL for rows the
  -- user created in the app, which the seed must never touch.
  natural_key text,

  title       text not null,
  kind        text not null default 'task' check (kind in ('task', 'watch')),

  -- context: supplied by the seed file, replaced on every re-seed.
  -- note:    written by the user, never touched by the seed.
  context     text,
  note        text,

  done        boolean not null default false,
  done_at     timestamptz,
  do_now      boolean not null default false,
  due         date,

  position    int not null default 0,

  -- Set true the moment the user edits a seeded row, which freezes the
  -- seed out of that row's title/context/flags forever.
  user_edited boolean not null default false,

  -- Staleness. Deliberately NOT updated_at: seeding writes every row and
  -- would otherwise make every stream look freshly touched. Only genuine
  -- user activity sets this.
  touched_at  timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  foreign key (owner_id, stream_id)  references public.streams(owner_id, id)  on delete cascade,
  foreign key (owner_id, section_id) references public.sections(owner_id, id) on delete cascade
);

create unique index if not exists tasks_natural_key_uniq
  on public.tasks (owner_id, natural_key)
  where natural_key is not null;

create index if not exists tasks_owner_live_idx
  on public.tasks (owner_id, stream_id, done)
  where deleted_at is null;

create index if not exists tasks_touched_idx
  on public.tasks (owner_id, stream_id, touched_at desc)
  where deleted_at is null;

create index if not exists tasks_due_idx
  on public.tasks (owner_id, due)
  where deleted_at is null and done = false and due is not null;

-- ── people ─────────────────────────────────────────────────────────
-- "Chase X for Y" is a large part of the job, so who-you-are-waiting-on
-- is a real dimension rather than a substring of the title.
create table if not exists public.people (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  role       text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.task_people (
  task_id   uuid not null references public.tasks(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  owner_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, person_id)
);

create index if not exists task_people_person_idx on public.task_people (owner_id, person_id);

-- ── updated_at ─────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ── stream health ──────────────────────────────────────────────────
-- Staleness is computed, never stored. This is the view behind the dial.
create or replace view public.stream_health
with (security_invoker = true) as
select
  s.owner_id,
  s.id                                                as stream_id,
  s.title,
  s.short,
  s.code,
  s.position,
  count(t.id) filter (where t.kind = 'task' and t.done = false)  as open_tasks,
  count(t.id) filter (where t.kind = 'task' and t.done = true)   as done_tasks,
  count(t.id) filter (where t.kind = 'watch')                    as watch_items,
  count(t.id) filter (where t.kind = 'task' and t.done = false and t.do_now)  as do_now_count,
  count(t.id) filter (where t.kind = 'task' and t.done = false and t.due is not null) as dated_count,
  max(t.touched_at)                                   as last_touched_at,
  case
    when max(t.touched_at) is null then null
    else greatest(0, extract(day from (now() - max(t.touched_at)))::int)
  end                                                 as days_quiet
from public.streams s
left join public.tasks t
  on t.owner_id = s.owner_id
 and t.stream_id = s.id
 and t.deleted_at is null
group by s.owner_id, s.id, s.title, s.short, s.code, s.position;
