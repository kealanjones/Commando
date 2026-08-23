-- ═══════════════════════════════════════════════════════════════════
-- Realtime
--
-- Earns its place: the app is genuinely open on a laptop and a phone at
-- once, and a task ticked on one should appear on the other. Realtime
-- respects RLS, so a subscriber only receives rows they could SELECT.
-- ═══════════════════════════════════════════════════════════════════

-- Idempotent: re-running the migration must not fail with
-- "relation is already member of publication".
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sections'
  ) then
    alter publication supabase_realtime add table public.sections;
  end if;
end
$$;

-- Needed for realtime to deliver the previous row on UPDATE/DELETE,
-- which is what lets the client reconcile an optimistic update.
alter table public.tasks    replica identity full;
alter table public.sections replica identity full;
