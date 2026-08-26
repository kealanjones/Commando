/**
 * Emit the register as a single idempotent SQL file.
 *
 * This exists so the register can be seeded entirely from the Supabase
 * dashboard's SQL editor, with no terminal, no npm, and — importantly — no
 * service role key anywhere on anyone's machine. The SQL editor is already
 * authenticated, so it needs no credential of its own.
 *
 * The reconcile semantics match scripts/seed.ts exactly:
 *   • new items inserted
 *   • changed items updated, unless the user has edited that row
 *   • items removed from the seed soft-deleted, unless done or edited
 *   • user-created rows (natural_key is null) never touched
 *   • done state, notes, due dates and touched_at always survive
 *
 *   npm run seed:sql        writes supabase/seed.sql
 */
import { writeFileSync } from 'node:fs';
import { GROUPS, SECTIONS, STREAMS, type Item } from '../data/register.seed.js';
import { KNOWN_PEOPLE } from '../data/people.js';
import { naturalKey } from '../src/lib/slug.js';

/** Single-quote a value for SQL, or emit NULL. */
const q = (v: string | null | undefined) =>
  v === null || v === undefined ? 'null' : `'${v.replace(/'/g, "''")}'`;

const norm = (i: string | Item): Item => (typeof i === 'string' ? { t: i } : i);

function mentioned(text: string): string[] {
  const hits: string[] = [];
  for (const p of KNOWN_PEOPLE) {
    for (const name of [p.name, ...(p.aliases ?? [])]) {
      const re = new RegExp(
        `(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`,
        'u',
      );
      if (re.test(text)) { hits.push(p.name); break; }
    }
  }
  return hits;
}

type Row = {
  key: string; stream: string; section: string; title: string;
  kind: 'task' | 'watch'; context: string | null; doNow: boolean;
  due: string | null; pos: number; people: string[];
};

const rows: Row[] = [];
const seen = new Set<string>();

for (const s of SECTIONS) {
  const push = (raw: string | Item, kind: 'task' | 'watch', pos: number) => {
    const it = norm(raw);
    const key = naturalKey(s.id, it.t);
    if (seen.has(key)) throw new Error(`Duplicate natural key: ${key}`);
    seen.add(key);
    rows.push({
      key, stream: s.stream, section: s.id, title: it.t, kind,
      context: it.note ?? null, doNow: it.p === 1, due: it.due ?? null, pos,
      people: mentioned(`${it.t} ${it.note ?? ''}`),
    });
  };
  (s.items ?? []).forEach((i, n) => push(i, 'task', n));
  (s.watch ?? []).forEach((i, n) => push(i, 'watch', n));
}

const tasks = rows.filter((r) => r.kind === 'task').length;
const watch = rows.length - tasks;

const sql = `-- ═══════════════════════════════════════════════════════════════════
-- Work Register — seed
--
-- ${rows.length} items across ${SECTIONS.length} sections (${tasks} tasks, ${watch} to watch).
-- Generated from data/register.seed.ts by scripts/seed-sql.ts. Do not edit
-- this file by hand — edit the seed source and regenerate.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste the whole file → Run.
--   Change the email on the ONE marked line below to the account you sign in
--   with. That is the only edit needed.
--
-- Safe to run as many times as you like. It reconciles rather than replaces:
-- anything you have edited, completed, or added yourself is left alone.
-- ═══════════════════════════════════════════════════════════════════

do $seed$
declare
  -- ↓↓↓ CHANGE THIS to the email you sign in with ↓↓↓
  owner_email text := 'you@example.com';
  -- ↑↑↑ the only line you need to edit ↑↑↑

  owner uuid;
  n_ins int; n_upd int; n_ret int;
begin
  select id into owner from auth.users
   where lower(email) = lower(owner_email) limit 1;

  if owner is null then
    raise exception
      'No account found for %. Invite it under Authentication -> Users, then run this again.',
      owner_email;
  end if;

  insert into public.profiles (id, email, display_name)
  values (owner, owner_email, split_part(owner_email, '@', 1))
  on conflict (id) do nothing;

  -- ── streams ──────────────────────────────────────────────────────
  insert into public.streams (id, owner_id, title, short, code, position) values
${Object.entries(STREAMS)
  .map(([id, s], i) => `    (${q(id)}, owner, ${q(s.title)}, ${q(s.short)}, ${q(s.code)}, ${i})`)
  .join(',\n')}
  on conflict (owner_id, id) do update
     set title = excluded.title, short = excluded.short,
         code = excluded.code, position = excluded.position;

  -- ── groups ───────────────────────────────────────────────────────
  -- The middle level, written first so the sections below can point at it.
  insert into public.sections (id, owner_id, stream_id, title, parent_id, monitor, position, deleted_at) values
${GROUPS.map((g, i) =>
  `    (${q(g.id)}, owner, ${q(g.stream)}, ${q(g.title)}, null, false, ${i}, null)`,
).join(',\n')}
  on conflict (owner_id, id) do update
     set stream_id = excluded.stream_id, title = excluded.title,
         parent_id = null, monitor = false, position = excluded.position,
         deleted_at = null;

  -- ── sections ─────────────────────────────────────────────────────
  insert into public.sections (id, owner_id, stream_id, title, parent_id, monitor, position, deleted_at) values
${SECTIONS.map((s, i) =>
  `    (${q(s.id)}, owner, ${q(s.stream)}, ${q(s.title)}, ${q(s.group ?? null)}, ${s.monitor ? 'true' : 'false'}, ${i}, null)`,
).join(',\n')}
  on conflict (owner_id, id) do update
     set stream_id = excluded.stream_id, title = excluded.title,
         parent_id = excluded.parent_id,
         monitor = excluded.monitor, position = excluded.position,
         deleted_at = null;

  -- ── people ───────────────────────────────────────────────────────
  insert into public.people (owner_id, name, role) values
${KNOWN_PEOPLE.map((p) => `    (owner, ${q(p.name)}, ${q(p.role ?? null)})`).join(',\n')}
  on conflict (owner_id, name) do update set role = excluded.role;

  -- ── the register itself ──────────────────────────────────────────
  create temp table _seed (
    natural_key text primary key, stream_id text, section_id text,
    title text, kind text, context text, do_now boolean, due date, position int
  ) on commit drop;

  insert into _seed values
${rows.map((r) =>
  `    (${q(r.key)}, ${q(r.stream)}, ${q(r.section)}, ${q(r.title)}, ${q(r.kind)}, ` +
  `${q(r.context)}, ${r.doNow}, ${r.due ? q(r.due) : 'null'}, ${r.pos})`,
).join(',\n')};

  -- Changed items — but never a row you have edited.
  with upd as (
    update public.tasks t
       set stream_id = s.stream_id, section_id = s.section_id, title = s.title,
           kind = s.kind, context = s.context, do_now = s.do_now,
           due = s.due, position = s.position, deleted_at = null
      from _seed s
     where t.owner_id = owner
       and t.natural_key = s.natural_key
       and t.user_edited = false
    returning 1)
  select count(*) into n_upd from upd;

  -- New items.
  with ins as (
    insert into public.tasks
      (owner_id, stream_id, section_id, natural_key, title, kind, context, do_now, due, position)
    select owner, s.stream_id, s.section_id, s.natural_key, s.title, s.kind,
           s.context, s.do_now, s.due, s.position
      from _seed s
     where not exists (
       select 1 from public.tasks t
        where t.owner_id = owner and t.natural_key = s.natural_key)
    returning 1)
  select count(*) into n_ins from ins;

  -- Gone from the seed — retired, unless you finished or edited it.
  with ret as (
    update public.tasks t
       set deleted_at = now()
     where t.owner_id = owner
       and t.natural_key is not null
       and t.deleted_at is null
       and t.user_edited = false
       and t.done = false
       and not exists (select 1 from _seed s where s.natural_key = t.natural_key)
    returning 1)
  select count(*) into n_ret from ret;

  -- ── who you are waiting on ───────────────────────────────────────
  create temp table _links (natural_key text, person text) on commit drop;
  insert into _links values
${rows
  .flatMap((r) => r.people.map((p) => `    (${q(r.key)}, ${q(p)})`))
  .join(',\n')};

  delete from public.task_people tp
   using public.tasks t
   where tp.task_id = t.id and t.owner_id = owner and t.natural_key is not null;

  insert into public.task_people (task_id, person_id, owner_id)
  select t.id, p.id, owner
    from _links l
    join public.tasks t on t.owner_id = owner and t.natural_key = l.natural_key
    join public.people p on p.owner_id = owner and p.name = l.person
  on conflict do nothing;

  raise notice 'Seeded as %: % inserted, % updated, % retired.',
    owner_email, n_ins, n_upd, n_ret;
end
$seed$;

-- Confirm. Expect ${tasks} tasks and ${watch} to watch.
select kind, count(*) as items
  from public.tasks
 where deleted_at is null
 group by kind
 order by kind;
`;

writeFileSync('supabase/seed.sql', sql);
console.log(
  `supabase/seed.sql  ${rows.length} items (${tasks} tasks, ${watch} watch) ` +
    `across ${SECTIONS.length} sections in ${GROUPS.length} groups`,
);
