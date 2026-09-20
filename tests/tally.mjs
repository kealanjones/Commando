/** The tally: what counts as today, what counts as the week, and the ring. */
import { tally, compareWeeks, ringSegments, mondayOf, RING_SLOTS } from '/home/user/Commando/src/lib/tally.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

// Wednesday 26 August 2026, mid-afternoon, fixed so nothing drifts.
const NOW = new Date(2026, 7, 26, 15, 30);
const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).toISOString();

const T = (id, extra = {}) => ({
  id, title: `task ${id}`, kind: 'task', done: true, deleted_at: null, do_now: false, due: null,
  context: null, note: null, section_id: 'spons', stream_id: 'isodp',
  owner_id: '', natural_key: null, done_at: null, position: 0, user_edited: false,
  touched_at: null, reviewed_at: null, unclear: false,
  created_at: '2026-01-01', updated_at: '2026-01-01', ...extra,
});

// ── the week ────────────────────────────────────────────────────────
ok(mondayOf(NOW).getDate() === 24, 'the week holding a Wednesday starts on the Monday before it');
ok(mondayOf(new Date(2026, 7, 24)).getDate() === 24, 'a Monday is its own week start');
ok(mondayOf(new Date(2026, 7, 30)).getDate() === 24, 'a Sunday belongs to the week before it, not the one after');

const tasks = [
  T('a', { done_at: at(2026, 8, 26, 9) }),           // today, morning
  T('b', { done_at: at(2026, 8, 26, 14), stream_id: 'dir' }), // today, afternoon
  T('c', { done_at: at(2026, 8, 25) }),              // yesterday
  T('d', { done_at: at(2026, 8, 24) }),              // Monday
  T('e', { done_at: at(2026, 8, 24) }),
  T('f', { done_at: at(2026, 8, 24) }),
  T('g', { done_at: at(2026, 8, 23) }),              // Sunday — last week
  T('h', { done_at: at(2026, 8, 19) }),              // last week
  T('i', { done_at: at(2026, 8, 16) }),              // the Sunday before last week's Monday: two weeks ago
  T('j', { done_at: at(2026, 8, 28) }),              // Friday — ahead of now (a clock skew); still this week
  T('k', { done: false }),                           // open
  T('l', { done_at: at(2026, 8, 26), kind: 'watch' }), // periphery, never counts
  T('m', { done_at: at(2026, 8, 26), deleted_at: '2026-08-26' }), // deleted
  T('n', { done: true, done_at: null }),             // seeded as done: no day to count it on
];
const t = tally(tasks, NOW);

ok(t.today.length === 2, `two things done today (${t.today.length})`);
ok(t.today.map((x) => x.id).join('') === 'ab', 'in the order they were ticked');
ok(t.days.length === 7, 'the week is always seven days');
ok(t.days[0].name === 'Monday' && t.days[6].name === 'Sunday', 'Monday to Sunday');
ok(t.days.map((d) => d.items.length).join('') === '3120100',
  `each day counts its own ticks (${t.days.map((d) => d.items.length).join(' ')})`);
ok(t.days[2].isToday && !t.days[1].isToday, 'today is marked');
ok(t.days[3].isFuture && !t.days[2].isFuture, 'the days after today are marked as ahead');
ok(t.weekTotal === 7, `the week total is this week only (${t.weekTotal})`);
ok(t.lastWeekTotal === 2, `last week counts Monday to Sunday too (${t.lastWeekTotal})`);
ok(t.best?.name === 'Monday', `the fullest day is named (${t.best?.name})`);
ok(t.days.every((d) => d.items.every((x) => x.kind === 'task' && !x.deleted_at)),
  'the periphery and the deleted never count');
ok(!tasks.some((x) => x.id === 'n' && t.days.some((d) => d.items.includes(x))),
  'a seeded done row with no done_at is not a day\'s work');

// ── an empty week ───────────────────────────────────────────────────
const e = tally([T('z', { done: false })], NOW);
ok(e.today.length === 0 && e.weekTotal === 0 && e.best === null, 'nothing done is nothing, not an error');
ok(compareWeeks(0, 0) === '', 'and there is nothing to compare an empty pair of weeks with');

// ── the comparison ──────────────────────────────────────────────────
ok(compareWeeks(7, 2) === '5 more than last week', 'up reads as more');
ok(compareWeeks(2, 7) === '5 fewer than last week', 'down reads as fewer');
ok(compareWeeks(4, 4) === 'level with last week', 'the same reads as level');
ok(compareWeeks(4, 0) === '', 'a first week has nothing to compare with');

// ── the ring ────────────────────────────────────────────────────────
const one = ringSegments(1);
ok(one.length === 1 && Math.abs(one[0].length - (1 / RING_SLOTS - 0.02)) < 1e-9,
  'one thing done is one slot of the ring, not a full circle');
const eight = ringSegments(8);
ok(eight[7].start + eight[7].length < 1 && eight[7].start > eight[6].start, 'eight fill it, with gaps kept');
const twelve = ringSegments(12);
ok(twelve.length === 12 && twelve[11].start + twelve[11].length <= 1,
  'past the slots the wedges divide rather than overlap');
ok(twelve[0].length < eight[0].length, 'and each gets thinner');
ok(ringSegments(0).length === 0, 'nothing done draws nothing');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
