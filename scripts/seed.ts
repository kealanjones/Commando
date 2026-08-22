/**
 * Seed / re-seed the register from data/register.seed.ts.
 *
 * Reconciles rather than replaces:
 *   • new seed items are inserted
 *   • seed items whose title, context, flag or due date changed are updated,
 *     UNLESS the user has edited that row (user_edited = true)
 *   • seed items that disappeared from the file are soft-deleted, unless
 *     they are done or user-edited
 *   • user-created rows (natural_key is null) are never touched
 *   • done state, user notes, touched_at and reschedules always survive
 *
 * Usage:  npm run seed          apply
 *         npm run seed:dry      report what would change, write nothing
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SECTIONS, STREAMS, type Item, type Section } from '../data/register.seed.js';
import { KNOWN_PEOPLE } from '../data/people.js';
import { naturalKey } from '../src/lib/slug.js';

const DRY = process.argv.includes('--dry-run');

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.SEED_OWNER_EMAIL;

if (!URL || !KEY || !EMAIL) {
  console.error(
    'Missing environment. Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and\n' +
      'SEED_OWNER_EMAIL. Copy .env.example to .env and fill it in.',
  );
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

const norm = (i: string | Item): Item => (typeof i === 'string' ? { t: i } : i);

/** Which known people a title or note mentions. */
function mentioned(text: string): string[] {
  const hits: string[] = [];
  for (const p of KNOWN_PEOPLE) {
    for (const name of [p.name, ...(p.aliases ?? [])]) {
      const re = new RegExp(`(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u');
      if (re.test(text)) { hits.push(p.name); break; }
    }
  }
  return hits;
}

async function ownerId(): Promise<string> {
  // listUsers is paginated; the register is single-user so page 1 suffices,
  // but loop anyway so this keeps working if a second account appears.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === EMAIL!.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  throw new Error(
    `No Supabase Auth user with email ${EMAIL}.\n` +
      'Sign in to the app once with that address (magic link) and re-run the seed.',
  );
}

async function main() {
  const owner = await ownerId();
  console.log(`${DRY ? 'DRY RUN — ' : ''}seeding as ${EMAIL} (${owner})\n`);

  // Make sure a profile row exists even if the auth trigger predates this user.
  if (!DRY) {
    await db.from('profiles').upsert({ id: owner, email: EMAIL }, { onConflict: 'id' });
  }

  // ── streams ──────────────────────────────────────────────────────
  const streamRows = Object.entries(STREAMS).map(([id, s], i) => ({
    id, owner_id: owner, title: s.title, short: s.short, code: s.code, position: i,
  }));
  if (!DRY) {
    const { error } = await db.from('streams').upsert(streamRows, { onConflict: 'owner_id,id' });
    if (error) throw error;
  }
  console.log(`streams   ${streamRows.length}`);

  // ── sections ─────────────────────────────────────────────────────
  const sectionRows = SECTIONS.map((s: Section, i) => ({
    id: s.id, owner_id: owner, stream_id: s.stream, title: s.title,
    monitor: s.monitor ?? false, position: i, deleted_at: null,
  }));
  if (!DRY) {
    const { error } = await db.from('sections').upsert(sectionRows, { onConflict: 'owner_id,id' });
    if (error) throw error;
  }
  console.log(`sections  ${sectionRows.length}`);

  // ── people ───────────────────────────────────────────────────────
  if (!DRY) {
    const { error } = await db.from('people').upsert(
      KNOWN_PEOPLE.map((p) => ({ owner_id: owner, name: p.name, role: p.role ?? null })),
      { onConflict: 'owner_id,name' },
    );
    if (error) throw error;
  }
  const { data: peopleRows } = await db.from('people').select('id,name').eq('owner_id', owner);
  const personId = new Map((peopleRows ?? []).map((p) => [p.name, p.id]));

  // ── flatten the seed file ────────────────────────────────────────
  type Flat = {
    natural_key: string; owner_id: string; stream_id: string; section_id: string;
    title: string; kind: 'task' | 'watch'; context: string | null;
    do_now: boolean; due: string | null; position: number;
  };

  const flat: Flat[] = [];
  const seen = new Set<string>();
  let dupes = 0;

  for (const s of SECTIONS) {
    const push = (raw: string | Item, kind: 'task' | 'watch', idx: number) => {
      const it = norm(raw);
      const key = naturalKey(s.id, it.t);
      if (seen.has(key)) {
        dupes++;
        console.warn(`  ! duplicate natural key, skipping: ${key}`);
        return;
      }
      seen.add(key);
      flat.push({
        natural_key: key, owner_id: owner, stream_id: s.stream, section_id: s.id,
        title: it.t, kind, context: it.note ?? null,
        do_now: it.p === 1, due: it.due ?? null, position: idx,
      });
    };
    (s.items ?? []).forEach((i, idx) => push(i, 'task', idx));
    (s.watch ?? []).forEach((i, idx) => push(i, 'watch', idx));
  }

  const tasks = flat.filter((f) => f.kind === 'task').length;
  const watch = flat.filter((f) => f.kind === 'watch').length;
  console.log(`items     ${flat.length}  (${tasks} tasks, ${watch} watch)${dupes ? `  ${dupes} duplicates skipped` : ''}`);

  // ── reconcile ────────────────────────────────────────────────────
  const { data: existing, error: exErr } = await db
    .from('tasks')
    .select('id,natural_key,user_edited,done,deleted_at,title')
    .eq('owner_id', owner)
    .not('natural_key', 'is', null);
  if (exErr) throw exErr;

  const byKey = new Map((existing ?? []).map((r) => [r.natural_key as string, r]));

  const toInsert = flat.filter((f) => !byKey.has(f.natural_key));
  const toUpdate = flat.filter((f) => {
    const cur = byKey.get(f.natural_key);
    return cur && !cur.user_edited;
  });
  const frozen = flat.length - toInsert.length - toUpdate.length;

  const liveKeys = new Set(flat.map((f) => f.natural_key));
  const toRetire = (existing ?? []).filter(
    (r) => !liveKeys.has(r.natural_key as string) && !r.deleted_at && !r.user_edited && !r.done,
  );
  const keptOrphans = (existing ?? []).filter(
    (r) => !liveKeys.has(r.natural_key as string) && !r.deleted_at && (r.user_edited || r.done),
  );

  console.log('');
  console.log(`  insert  ${toInsert.length}`);
  console.log(`  update  ${toUpdate.length}`);
  console.log(`  frozen  ${frozen}   (edited by you — seed will not overwrite)`);
  console.log(`  retire  ${toRetire.length}   (soft-deleted, recoverable)`);
  if (keptOrphans.length) {
    console.log(`  kept    ${keptOrphans.length}   (gone from seed but done or edited — left alone)`);
  }

  if (DRY) {
    console.log('\nDry run: nothing written.');
    return;
  }

  // Upsert in chunks. onConflict on the partial unique index over natural_key.
  const rows = [...toInsert, ...toUpdate].map((f) => ({ ...f, deleted_at: null }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db
      .from('tasks')
      .upsert(rows.slice(i, i + 200), { onConflict: 'owner_id,natural_key' });
    if (error) throw error;
  }

  if (toRetire.length) {
    const { error } = await db
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', toRetire.map((r) => r.id));
    if (error) throw error;
  }

  // ── waiting-on links ─────────────────────────────────────────────
  const { data: allTasks } = await db
    .from('tasks')
    .select('id,title,context,natural_key')
    .eq('owner_id', owner)
    .not('natural_key', 'is', null)
    .is('deleted_at', null);

  const links: { task_id: string; person_id: string; owner_id: string }[] = [];
  for (const t of allTasks ?? []) {
    for (const name of mentioned(`${t.title} ${t.context ?? ''}`)) {
      const pid = personId.get(name);
      if (pid) links.push({ task_id: t.id, person_id: pid, owner_id: owner });
    }
  }
  // Rebuild the links for seeded rows only; user-created rows keep theirs.
  const seededIds = (allTasks ?? []).map((t) => t.id);
  for (let i = 0; i < seededIds.length; i += 200) {
    await db.from('task_people').delete().in('task_id', seededIds.slice(i, i + 200));
  }
  for (let i = 0; i < links.length; i += 400) {
    const { error } = await db
      .from('task_people')
      .upsert(links.slice(i, i + 400), { onConflict: 'task_id,person_id' });
    if (error) throw error;
  }
  console.log(`  people  ${links.length} links across ${new Set(links.map((l) => l.person_id)).size} names`);

  // ── final count ──────────────────────────────────────────────────
  const { count } = await db
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', owner)
    .is('deleted_at', null);

  console.log(`\nDone. ${count} live items in the register.`);
}

main().catch((e) => {
  console.error('\nSeed failed:', e.message ?? e);
  process.exit(1);
});
