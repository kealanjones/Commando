-- ═══════════════════════════════════════════════════════════════════
-- Realtime
--
-- Earns its place: the app is genuinely open on a laptop and a phone at
-- once, and a task ticked on one should appear on the other. Realtime
-- respects RLS, so a subscriber only receives rows they could SELECT.
-- ═══════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.sections;

-- Needed for realtime to deliver the previous row on UPDATE/DELETE,
-- which is what lets the client reconcile an optimistic update.
alter table public.tasks    replica identity full;
alter table public.sections replica identity full;
