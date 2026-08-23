-- ═══════════════════════════════════════════════════════════════════
-- RLS proof.
--
-- Two users, one shared stream, one anonymous caller. Every assertion
-- below is a claim the README makes; this is what checks it is true.
-- Run with tests/rls.sh.
-- ═══════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\set QUIET on

-- Note on roles: postgres is a superuser and superusers bypass RLS even
-- when it is FORCEd, so every assertion below runs after SET ROLE to a
-- non-superuser. Session-level SET, never SET LOCAL — see above.

create or replace function assert(claim boolean, what text) returns void
language plpgsql as $$
begin
  if claim then raise notice 'PASS  %', what;
  else raise exception 'FAIL  %', what;
  end if;
end $$;

-- Two accounts.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'kealan@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'steph@example.com');

insert into public.profiles (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'kealan@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'steph@example.com');

insert into public.streams (id, owner_id, title, short, code, position) values
  ('cttl',  '11111111-1111-1111-1111-111111111111', 'Commonwealth Tribute to Life', 'Commonwealth', 'CTtL', 0),
  ('isodp', '11111111-1111-1111-1111-111111111111', 'ISODP 2027', 'ISODP 2027', 'ISODP', 1);

insert into public.sections (id, owner_id, stream_id, title, position) values
  ('cttl-gov',    '11111111-1111-1111-1111-111111111111', 'cttl',  'Governance and meetings', 0),
  ('isodp-spons', '11111111-1111-1111-1111-111111111111', 'isodp', 'Sponsorship', 1);

insert into public.tasks (owner_id, stream_id, section_id, natural_key, title) values
  ('11111111-1111-1111-1111-111111111111', 'cttl',  'cttl-gov',    'cttl-gov:invitations', 'Send Custodian Board invitations'),
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'isodp-spons', 'isodp-spons:anthony', 'Send Anthony the priority sponsor list');

-- ── the owner sees their own register ──────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assert((select count(*) from public.tasks) = 2, 'owner sees their own tasks');
select assert((select count(*) from public.streams) = 2, 'owner sees their own streams');

-- ── a second user sees nothing at all ──────────────────────────────
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert((select count(*) from public.tasks) = 0, 'another user sees no tasks');
select assert((select count(*) from public.streams) = 0, 'another user sees no streams');
select assert((select count(*) from public.sections) = 0, 'another user sees no sections');

-- ── and cannot write into someone else's stream ────────────────────
do $$
begin
  insert into public.tasks (owner_id, stream_id, section_id, title)
  values ('11111111-1111-1111-1111-111111111111', 'cttl', 'cttl-gov', 'Injected');
  raise exception 'FAIL  another user was able to insert into a stream they do not own';
exception
  when insufficient_privilege then raise notice 'PASS  another user cannot insert into a stream they do not own';
end $$;

-- ── an anonymous caller sees nothing ───────────────────────────────
reset role;
set role anon;
set request.jwt.claim.sub = '';
do $$
declare n int;
begin
  begin
    select count(*) into n from public.tasks;
  exception when insufficient_privilege then
    n := -1;
  end;
  perform assert(n <= 0, 'anonymous caller gets nothing from tasks (n=' || n || ')');
end $$;

-- ── sharing one stream grants exactly that stream ──────────────────
reset role;
insert into public.stream_members (owner_id, stream_id, member_id, role)
values ('11111111-1111-1111-1111-111111111111', 'isodp',
        '22222222-2222-2222-2222-222222222222', 'editor');

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert((select count(*) from public.tasks) = 1, 'shared user sees only the shared stream''s tasks');
select assert((select count(*) from public.tasks where stream_id = 'cttl') = 0, 'shared user still cannot see the unshared stream');

insert into public.tasks (owner_id, stream_id, section_id, title)
values ('11111111-1111-1111-1111-111111111111', 'isodp', 'isodp-spons', 'Added by the EA');
select assert((select count(*) from public.tasks) = 2, 'shared editor can add to the shared stream');

-- ── nobody can hard-delete ─────────────────────────────────────────
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  delete from public.tasks where natural_key = 'cttl-gov:invitations';
  raise exception 'FAIL  a hard delete succeeded — deletion must be soft';
exception
  when insufficient_privilege then raise notice 'PASS  hard delete is refused; deletion is soft only';
end $$;

-- ── the seed's upsert can actually infer the unique index ──────────
reset role;
insert into public.tasks (owner_id, stream_id, section_id, natural_key, title)
values ('11111111-1111-1111-1111-111111111111', 'cttl', 'cttl-gov',
        'cttl-gov:invitations', 'Send Custodian Board invitations (reworded)')
on conflict (owner_id, natural_key) do update set title = excluded.title;
select assert(
  (select title from public.tasks where natural_key = 'cttl-gov:invitations')
    = 'Send Custodian Board invitations (reworded)',
  'seed upsert resolves ON CONFLICT (owner_id, natural_key)');

-- ── many user-created rows may share a null natural key ────────────
insert into public.tasks (owner_id, stream_id, section_id, title) values
  ('11111111-1111-1111-1111-111111111111', 'cttl', 'cttl-gov', 'Something I typed'),
  ('11111111-1111-1111-1111-111111111111', 'cttl', 'cttl-gov', 'Something else I typed');
select assert((select count(*) from public.tasks where natural_key is null) >= 2,
  'multiple user-created rows coexist with a null natural key');

-- ── staleness is computed, and seeding does not fake it ────────────
select assert((select count(*) from public.stream_health where days_quiet is not null) = 0,
  'a freshly seeded register reports no false recent activity');

update public.tasks set touched_at = now() where stream_id = 'isodp';
select assert((select days_quiet from public.stream_health where stream_id = 'isodp') = 0,
  'touching a task sets its stream to zero days quiet');
select assert((select days_quiet from public.stream_health where stream_id = 'cttl') is null,
  'an untouched stream reports no recency rather than a wrong one');

-- ── intake is personal, even where a stream is shared ──────────────
reset role;
insert into public.intakes (id, owner_id, label, source_text, status)
values ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111', 'SMT, 14 August',
        'Anthony asked about the ISODP payment route.', 'ready');

insert into public.intake_items (intake_id, owner_id, title, kind, stream_id, section_id, evidence)
values ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        'Send Isaac the revised registration numbers', 'task', 'isodp', 'isodp-spons',
        'Isaac needs the revised numbers.');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assert((select count(*) from public.intakes) = 1, 'owner sees their own intake');
select assert((select count(*) from public.intake_items) = 1, 'owner sees their own proposals');

-- Steph is an editor on isodp. She must still not see the transcript the
-- proposals came from: a meeting record routinely covers more than the one
-- stream someone was given.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert((select count(*) from public.intakes) = 0,
  'a shared-stream collaborator cannot read the transcript');
select assert((select count(*) from public.intake_items) = 0,
  'a shared-stream collaborator cannot read the proposals');

-- ── RLS is on and forced everywhere ────────────────────────────────
select assert(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (not c.relrowsecurity or not c.relforcerowsecurity)) = 0,
  'every table has RLS enabled and forced');
