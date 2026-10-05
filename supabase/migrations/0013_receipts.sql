-- ═══════════════════════════════════════════════════════════════════
-- 0013 — receipts: the till roll
--
-- Every tick prints a line. The lines are the record of a day: what was
-- rung through, when, from which project, and how long you stayed with
-- it. Un-ticking prints a RETURNED line and deleting prints VOID, the way
-- a real till never un-prints. An Undo within a few seconds marks the
-- line undone instead, so a slip never litters the roll.
--
-- Lines are kept for ever. A task renamed or deleted later does not
-- change what the receipt said that day: the title and code are copied.
--
-- The roll is back-filled from every item already ticked, so the past
-- is there the moment this runs. Days are local to the UK: the app sets
-- `day` from the device clock, and the back-fill uses Europe/London.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.receipt_lines (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  task_id    uuid references public.tasks(id) on delete set null,
  kind       text not null check (kind in ('done', 'returned', 'void')),
  title      text not null,
  code       text not null default '',
  stream_id  text,
  -- Minutes spent staying with it in Check out, if any.
  minutes    integer,
  at         timestamptz not null default now(),
  -- The local day the line belongs to, as the device saw it.
  day        date not null,
  -- Set when the action was undone in time. Such a line is not shown.
  undone_at  timestamptz
);

create index if not exists receipt_lines_day_idx
  on public.receipt_lines (owner_id, day, at) where undone_at is null;

-- The past, from what is already ticked. Cleared and deleted items count:
-- they were done that day.
insert into public.receipt_lines (owner_id, task_id, kind, title, code, stream_id, at, day)
select t.owner_id, t.id, 'done', t.title, coalesce(s.code, ''), t.stream_id, t.done_at,
       (t.done_at at time zone 'Europe/London')::date
from public.tasks t
left join public.streams s on s.id = t.stream_id
where t.done and t.done_at is not null
  and not exists (select 1 from public.receipt_lines r where r.task_id = t.id and r.kind = 'done');

alter table public.receipt_lines enable row level security;
alter table public.receipt_lines force row level security;

drop policy if exists receipt_lines_owner on public.receipt_lines;
create policy receipt_lines_owner on public.receipt_lines
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- A receipt is a record: lines are added and marked undone, never removed.
grant select, insert, update on public.receipt_lines to authenticated;
revoke delete on public.receipt_lines from authenticated;
revoke all on public.receipt_lines from anon;

comment on table public.receipt_lines is
  'The till roll: one line per tick, return or void, kept for ever. undone_at hides a line whose action was undone in time.';
