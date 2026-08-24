-- ═══════════════════════════════════════════════════════════════════
-- The weekly review.
--
-- The register only ever grew: intake adds items after every meeting and
-- nothing removed any. Worse, a fifth of the tasks begin with a verb that
-- cannot be finished — "keep the pipeline current", "continue seeking
-- sponsors" — so they would sit in the do-column for ever.
--
-- One column does the work. A decision stamps reviewed_at, which keeps the
-- item out of the queue for a while; without it the same cards return every
-- week and the ritual dies.
-- ═══════════════════════════════════════════════════════════════════

alter table public.tasks
  add column if not exists reviewed_at timestamptz;

-- "I do not know what this means or what the next step is."
--
-- Orthogonal to kind: an unclear item is still work, you just cannot act on
-- it yet. Marking it unclear takes it off Today so it stops nagging, without
-- pretending it is only something to watch.
alter table public.tasks
  add column if not exists unclear boolean not null default false;

create index if not exists tasks_review_idx
  on public.tasks (owner_id, reviewed_at)
  where deleted_at is null and done = false;

create index if not exists tasks_unclear_idx
  on public.tasks (owner_id)
  where unclear and deleted_at is null and done = false;

-- Staleness for review purposes measures from the last time you touched a
-- task, or from when it arrived if you never have. Without the fallback a
-- freshly seeded register would report every row as stale on day one.
create or replace view public.review_queue
with (security_invoker = true) as
select
  t.*,
  greatest(0, extract(day from (now() - coalesce(t.touched_at, t.created_at)))::int) as days_idle,
  case
    when t.due is not null and t.due < current_date then 'overdue'
    -- A standing concern wearing a task's clothes: no state of the world
    -- completes it.
    when t.kind = 'task' and t.title ~* '^(keep|track|continue|monitor|maintain|ensure|be alert)\M'
      then 'unfinishable'
    when t.unclear then 'unclear'
    when t.do_now and t.due is null then 'urgent_undated'
    when coalesce(t.touched_at, t.created_at) < now() - interval '21 days' then 'stale'
    else null
  end as review_reason
from public.tasks t
where t.deleted_at is null
  and t.done = false
  and t.kind = 'task';
