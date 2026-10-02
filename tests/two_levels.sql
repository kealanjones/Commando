-- ═══════════════════════════════════════════════════════════════════
-- 0011 on a register that still has three levels.
--
-- Run by tests/rls.sh against a database migrated up to 0010, before
-- 0011 is applied; this file applies it and checks what it did.
-- ═══════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\set QUIET on

create or replace function assert(claim boolean, what text) returns void
language plpgsql as $$
begin
  if claim then raise notice 'PASS  %', what;
  else raise exception 'FAIL  %', what;
  end if;
end $$;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'kealan@example.com');
insert into public.profiles (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'kealan@example.com');
insert into public.streams (id, owner_id, title, short, code, position) values
  ('isodp', '11111111-1111-1111-1111-111111111111', 'ISODP 2027', 'ISODP 2027', 'ISODP', 0);
insert into public.sections (id, owner_id, stream_id, title, parent_id, position) values
  ('g-spons', '11111111-1111-1111-1111-111111111111', 'isodp', 'Sponsorship', null, 0),
  ('pipe',    '11111111-1111-1111-1111-111111111111', 'isodp', 'Pipeline', 'g-spons', 1),
  ('organox', '11111111-1111-1111-1111-111111111111', 'isodp', 'OrganOx', 'g-spons', 2),
  ('board',   '11111111-1111-1111-1111-111111111111', 'isodp', 'Congress Board', null, 3);

insert into public.tasks (owner_id, stream_id, section_id, natural_key, title, position) values
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'pipe',    'p0', 'Chase Medtronic', 0),
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'pipe',    'p1', 'Send prospectus', 1),
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'organox', 'o0', 'Signed letter', 0),
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'board',   'b0', 'Board papers', 0);

insert into public.intakes (id, owner_id, source_text) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'notes');
insert into public.intake_items (owner_id, intake_id, title, section_id, stream_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'From a meeting', 'organox', 'isodp');

\i supabase/migrations/0011_two_levels.sql

select assert(
  (select count(*) from public.tasks where section_id in ('pipe', 'organox')) = 0,
  'nothing is left in a folded section');
select assert(
  (select count(*) from public.tasks where section_id = 'g-spons') = 3,
  'their items are in the group, now a sub-focus');
select assert(
  (select string_agg(title, ' | ' order by position) from public.tasks where section_id = 'g-spons')
    = 'Chase Medtronic | Send prospectus | Signed letter',
  'in the order the sections and items were in');
select assert(
  (select tag from public.tasks where natural_key = 'o0') = 'OrganOx',
  'each moved item keeps its old section as a tag');
select assert(
  (select section_id from public.tasks where natural_key = 'b0') = 'board'
    and (select tag from public.tasks where natural_key = 'b0') is null,
  'a section with no group is untouched');
select assert(
  (select count(*) from public.sections where deleted_at is null) = 2,
  'two sub-focuses remain: the group and the ungrouped section');
select assert(
  (select count(*) from public.sections) = 4,
  'the folded sections are soft-deleted, not dropped');
select assert(
  (select section_id from public.intake_items limit 1) = 'g-spons',
  'meeting proposals follow their section into the group');

\i supabase/migrations/0011_two_levels.sql
select assert(
  (select string_agg(title || '@' || coalesce(tag, '-'), ' | ' order by position) from public.tasks where section_id = 'g-spons')
    = 'Chase Medtronic@Pipeline | Send prospectus@Pipeline | Signed letter@OrganOx',
  'running it twice changes nothing');
