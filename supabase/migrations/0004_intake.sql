-- ═══════════════════════════════════════════════════════════════════
-- Intake: paste a meeting record, get proposed items.
--
-- Extraction never writes to tasks. It writes candidates here, the user
-- triages them, and only an accepted candidate becomes a task. An LLM
-- reading a transcript is a good first pass and a bad final authority.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.intakes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,

  label        text,                     -- "SMT, 14 August"
  source_text  text not null,            -- the transcript, kept for evidence
  summary      text,                     -- one paragraph, from the model

  status       text not null default 'pending'
                 check (status in ('pending', 'extracting', 'ready', 'failed')),
  error        text,

  model        text,
  input_tokens  int,
  output_tokens int,

  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  deleted_at   timestamptz
);

create index if not exists intakes_owner_idx
  on public.intakes (owner_id, created_at desc) where deleted_at is null;

-- One proposed item. Everything here is a suggestion until accepted.
create table if not exists public.intake_items (
  id          uuid primary key default gen_random_uuid(),
  intake_id   uuid not null references public.intakes(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,

  title       text not null,
  kind        text not null default 'task' check (kind in ('task', 'watch')),
  context     text,

  -- Proposed routing. Null stream/section means the model could not place
  -- it, which is surfaced rather than guessed at.
  stream_id   text,
  section_id  text,
  do_now      boolean not null default false,
  due         date,
  waiting_on  text[] not null default '{}',

  -- Why the model thinks so. The quote is what makes the proposal
  -- checkable in two seconds instead of needing the transcript re-read.
  evidence    text,
  confidence  text not null default 'medium'
                check (confidence in ('high', 'medium', 'low')),

  -- Set when the model believes this restates an existing open task.
  duplicate_of uuid references public.tasks(id) on delete set null,

  status      text not null default 'pending'
                check (status in ('pending', 'accepted', 'rejected')),
  task_id     uuid references public.tasks(id) on delete set null,

  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists intake_items_intake_idx
  on public.intake_items (intake_id, position);

create index if not exists intake_items_pending_idx
  on public.intake_items (owner_id, status) where status = 'pending';

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.intakes       enable row level security;
alter table public.intake_items  enable row level security;
alter table public.intakes       force row level security;
alter table public.intake_items  force row level security;

-- Intake is personal. A shared stream does not share the transcript it
-- came from: a meeting record routinely contains more than the one
-- workstream someone was given access to.
drop policy if exists intakes_owner on public.intakes;
create policy intakes_owner on public.intakes
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists intake_items_owner on public.intake_items;
create policy intake_items_owner on public.intake_items
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update on public.intakes      to authenticated;
grant select, insert, update on public.intake_items to authenticated;
revoke delete on public.intakes      from authenticated;
revoke delete on public.intake_items from authenticated;
revoke all on public.intakes      from anon;
revoke all on public.intake_items from anon;

-- Tasks gain a back-reference, so a task can say where it came from.
alter table public.tasks
  add column if not exists intake_item_id uuid references public.intake_items(id) on delete set null;
