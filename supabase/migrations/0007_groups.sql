-- ═══════════════════════════════════════════════════════════════════
-- 0007 — the middle level
--
-- Fifteen ISODP sections at one level is a list, not a structure, and
-- "Sponsorship — OrganOx" was a hierarchy smuggled into a string: nothing
-- could collapse, count or navigate by it because nothing could read it.
--
-- A section may now name a parent section. A parent holds sections; only
-- leaves hold tasks. Depth is optional — a stream with few enough sections
-- to read at a glance has no groups at all.
-- ═══════════════════════════════════════════════════════════════════

alter table public.sections
  add column if not exists parent_id text;

-- The parent must belong to the same owner: the key is composite, so a
-- section cannot be filed under somebody else's group.
--
-- Deleting a group leaves its sections in place, one level up. The column
-- list on SET NULL matters — without it Postgres nulls every column in the
-- key, owner_id included, and the delete fails on a not-null constraint
-- instead. Needs Postgres 15 or newer, which Supabase has been on for years.
do $$
begin
  alter table public.sections
    add constraint sections_parent_fkey
    foreign key (owner_id, parent_id)
    references public.sections(owner_id, id)
    on delete set null (parent_id);
exception
  when duplicate_object then null;
end $$;

alter table public.sections drop constraint if exists sections_parent_not_self;
alter table public.sections
  add constraint sections_parent_not_self
  check (parent_id is null or parent_id <> id);

comment on column public.sections.parent_id is
  'The group this section sits in. Null means it hangs directly off the stream. One level only: a group''s parent is always null.';
