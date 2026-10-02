-- ═══════════════════════════════════════════════════════════════════
-- 0010 — done stays on the page until you clear it
--
-- Ticking something off used to take it off the list a few seconds
-- later. Now it stays where it was, struck through, as a record of what
-- got done, until you clear the done ones yourself. Clearing is a
-- timestamp, not a delete: the item is still done, still in the history
-- and the brief, just no longer on the page.
-- ═══════════════════════════════════════════════════════════════════

alter table public.tasks add column if not exists cleared_at timestamptz;

-- Everything already done counts as cleared, so the register does not
-- open on a page of old crossings-out.
update public.tasks set cleared_at = coalesce(done_at, now())
 where done and cleared_at is null;

comment on column public.tasks.cleared_at is
  'When a done item was cleared off the page. Null on a done item means it still shows, struck through.';
