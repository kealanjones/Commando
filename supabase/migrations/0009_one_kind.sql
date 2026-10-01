-- ═══════════════════════════════════════════════════════════════════
-- 0009 — one kind of item
--
-- The register had two kinds of thing (a task, and a "watch" item with no
-- checkbox) and a third state on top (parked as unclear). Each was argued
-- for on its own; together they made the app hard to read. There is now
-- one kind of item: something in a section, open or done, with a date or
-- an urgent flag if it has earned one.
--
-- Watch items become ordinary items in the same section. They carry no
-- date, so they never reach Today; they sit in their section until they
-- are ticked or deleted. Parked-as-unclear items go back into play.
--
-- The columns stay, so nothing older breaks and nothing is lost; the app
-- simply no longer writes 'watch' or unclear = true.
-- ═══════════════════════════════════════════════════════════════════

-- Watch items sat at positions 0..n alongside the tasks in the same section.
-- Move them after the section's tasks so the order still reads tasks first.
with last_task as (
  select section_id, owner_id, coalesce(max(position), -1) as top
    from public.tasks
   where kind = 'task'
   group by section_id, owner_id
)
update public.tasks t
   set kind = 'task',
       position = coalesce(l.top, -1) + 1 + t.position
  from (select distinct section_id, owner_id from public.tasks where kind = 'watch') s
  left join last_task l using (section_id, owner_id)
 where t.kind = 'watch'
   and t.section_id = s.section_id
   and t.owner_id = s.owner_id;

update public.intake_items set kind = 'task' where kind = 'watch';

update public.tasks set unclear = false where unclear;

comment on column public.tasks.kind is
  'Always task since 0009. Kept so older rows and clients stay valid.';
comment on column public.tasks.unclear is
  'Always false since 0009. Kept so older rows and clients stay valid.';
