-- ═══════════════════════════════════════════════════════════════════
-- 0009 on a register that already has watch items and parked ones.
--
-- Run by tests/rls.sh against a database migrated up to 0008, before
-- 0009 is applied; this file applies it and checks what it did.
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
insert into public.sections (id, owner_id, stream_id, title, position) values
  ('isodp-pay',   '11111111-1111-1111-1111-111111111111', 'isodp', 'Finance', 0),
  ('isodp-watch', '11111111-1111-1111-1111-111111111111', 'isodp', 'Only watched', 1);

insert into public.tasks (owner_id, stream_id, section_id, natural_key, title, kind, position, unclear) values
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'isodp-pay', 'pay:t0', 'Send Isaac the numbers', 'task', 0, false),
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'isodp-pay', 'pay:t1', 'Work out what Stripe costs', 'task', 1, true),
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'isodp-pay', 'pay:w0', 'VAT treatment', 'watch', 0, false),
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'isodp-pay', 'pay:w1', 'Currency process', 'watch', 1, false),
  ('11111111-1111-1111-1111-111111111111', 'isodp', 'isodp-watch', 'watch:w0', 'HotelMap', 'watch', 0, false);

\i supabase/migrations/0009_one_kind.sql

select assert(
  (select count(*) from public.tasks where kind = 'watch') = 0,
  'every watch item is an ordinary item now');
select assert(
  (select count(*) from public.tasks) = 5,
  'and nothing was lost on the way');
select assert(
  (select count(*) from public.tasks where unclear) = 0,
  'parked items are back in play');
select assert(
  (select string_agg(title, ' | ' order by position) from public.tasks where section_id = 'isodp-pay')
    = 'Send Isaac the numbers | Work out what Stripe costs | VAT treatment | Currency process',
  'former watch items follow the section''s tasks, in their old order');
select assert(
  (select position from public.tasks where natural_key = 'watch:w0') = 0,
  'a section that only had watch items keeps them from the top');

-- Running it twice changes nothing.
\i supabase/migrations/0009_one_kind.sql
select assert(
  (select string_agg(title || '@' || position, ' | ' order by position) from public.tasks where section_id = 'isodp-pay')
    = 'Send Isaac the numbers@0 | Work out what Stripe costs@1 | VAT treatment@2 | Currency process@3',
  'and it is safe to run again');
