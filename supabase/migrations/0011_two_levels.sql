-- ═══════════════════════════════════════════════════════════════════
-- 0011 — two levels: a project and its sub-focuses
--
-- The register had three levels under a stream: a group (Sponsorship),
-- the sections inside it (OrganOx, Collateral, …) and then the items.
-- Picking where an item goes meant choosing from forty-odd sections.
-- Now there are two: a project, and the sub-focuses inside it.
--
-- Each group becomes a sub-focus and the sections inside it fold in.
-- A section with no group is already a sub-focus and stays as it is.
-- Nothing is lost: an item that moves keeps its old section's name as a
-- tag ("OrganOx"), and the folded sections are soft-deleted, not dropped.
--
-- Projects can now be deleted from the app. Deleting one is a timestamp,
-- like everything else, because a hard delete would cascade to its items.
-- ═══════════════════════════════════════════════════════════════════

alter table public.tasks   add column if not exists tag text;
alter table public.streams add column if not exists deleted_at timestamptz;

comment on column public.tasks.tag is
  'A short label kept from the section an item sat in before 0011 (e.g. OrganOx). Free text.';
comment on column public.streams.deleted_at is
  'When the project was deleted. The app only deletes a project with nothing left in it.';

-- Items in a folded section move to its group, after anything already
-- there, keeping the order the sections and items were in.
with base as (
  select owner_id, section_id, max(position) as top
    from public.tasks
   group by owner_id, section_id
),
moved as (
  select t.id,
         s.parent_id as to_section,
         s.title     as from_title,
         coalesce(b.top, -1)
           + row_number() over (partition by t.owner_id, s.parent_id order by s.position, t.position)
           as pos
    from public.tasks t
    join public.sections s on s.owner_id = t.owner_id and s.id = t.section_id
    left join base b on b.owner_id = t.owner_id and b.section_id = s.parent_id
   where s.parent_id is not null
)
update public.tasks t
   set section_id = m.to_section,
       tag        = coalesce(t.tag, m.from_title),
       position   = m.pos
  from moved m
 where t.id = m.id;

-- Meeting proposals that pointed at a folded section point at its group.
update public.intake_items i
   set section_id = s.parent_id
  from public.sections s
 where s.owner_id = i.owner_id and s.id = i.section_id and s.parent_id is not null;

-- The folded sections are empty now. Keep the rows, out of sight.
update public.sections
   set deleted_at = coalesce(deleted_at, now())
 where parent_id is not null;

comment on column public.sections.parent_id is
  'Unused since 0011: sub-focuses sit straight under their project. Kept so older rows stay valid.';
