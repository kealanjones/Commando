-- ═══════════════════════════════════════════════════════════════════
-- 0008 — work and personal
--
-- Five streams, and two of them are not the job. Career and Personal sat
-- in the same list as the Directorate, so a Saturday morning showed a
-- sponsor chase between the allotment and the mortgage, and a Tuesday
-- showed the mortgage between two sponsor chases.
--
-- A stream now says which realm it belongs to. The app scopes every
-- screen by it — one switch, and the other realm is simply not there.
-- Two values only: a third bucket would be a third list.
-- ═══════════════════════════════════════════════════════════════════

alter table public.streams
  add column if not exists realm text not null default 'work';

alter table public.streams drop constraint if exists streams_realm_check;
alter table public.streams
  add constraint streams_realm_check check (realm in ('work', 'personal'));

-- The two streams that are yours rather than the office's. The seed sets
-- this too; this is for a register seeded before the column existed.
update public.streams set realm = 'personal' where id in ('career', 'per');

comment on column public.streams.realm is
  'work or personal. Every screen is scoped by it; nothing crosses between the two unless you ask to see both.';
