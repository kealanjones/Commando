/** The plan: the grid, the bands, the days you reach for, the queue. */
import {
  monthGrid, loadOf, loadByDay, quickTargets, weekAhead, undated, isoOf, startOfDay, fmtDay, monthName,
} from '/home/user/Commando/src/lib/plan.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

// Wednesday 26 August 2026, fixed so nothing here drifts with the calendar.
const TODAY = new Date(2026, 7, 26);
const on = (iso) => iso;

const T = (id, extra = {}) => ({
  id, title: `task ${id}`, kind: 'task', done: false, deleted_at: null, do_now: false, due: null,
  context: null, note: null, section_id: 'spons', stream_id: 'isodp',
  owner_id: '', natural_key: null, done_at: null, position: 0, user_edited: false,
  touched_at: null, reviewed_at: null, unclear: false,
  created_at: '2026-01-01', updated_at: '2026-01-01', ...extra,
});

const tasks = [
  T('a', { due: on('2026-09-01') }),
  T('b', { due: on('2026-09-01') }),
  T('c', { due: on('2026-09-01'), do_now: true }),
  T('d', { due: on('2026-09-02') }),
  T('e', { due: on('2026-09-10') }), T('f', { due: on('2026-09-10') }),
  T('g', { due: on('2026-09-10') }), T('h', { due: on('2026-09-10') }),
  T('i', { due: on('2026-09-10') }), T('j', { due: on('2026-09-10') }),
  T('k', { due: on('2026-09-10') }), T('l', { due: on('2026-09-10') }),
  T('done', { due: on('2026-09-01'), done: true }),
  T('gone', { due: on('2026-09-01'), deleted_at: '2026-08-01' }),
  T('watch', { due: on('2026-09-01'), kind: 'watch' }),
  T('u1'), T('u2', { do_now: true }), T('u3', { unclear: true }),
  T('u4', { section_id: 'quiet' }),
];

// ── the bands ───────────────────────────────────────────────────────
ok(loadOf(0) === 0, 'an empty day is empty');
ok(loadOf(1) === 1 && loadOf(2) === 2 && loadOf(3) === 3,
  'one, two and three things are three different days');
ok(loadOf(5) === 4 && loadOf(7) === 5 && loadOf(40) === 5,
  'and the scale tops out rather than running away');
ok(loadOf(4) === 4, 'four sits in the same band as five');

const load = loadByDay(tasks);
ok(load.get('2026-09-01').count === 3,
  `a day counts only its open, actionable items (${load.get('2026-09-01').count})`);
ok(load.get('2026-09-01').pressing === 1, 'and how many of them are flagged');
ok(!load.has('2026-08-15'), 'a day with nothing on it is absent rather than zeroed');

// ── the grid ────────────────────────────────────────────────────────
const grid = monthGrid(2026, 8, tasks, TODAY);   // September 2026
const days = grid.flatMap((w) => w.days);

ok(grid.every((w) => w.days.length === 7), 'every week is a full week');
ok(grid.length >= 4 && grid.length <= 6, `a month is four to six rows (${grid.length})`);
ok(days[0].date.getDay() === 1, 'the grid starts on a Monday, as this register reads');
ok(days.filter((d) => d.inMonth).length === 30, 'September has its thirty days');
ok(days.some((d) => !d.inMonth), 'padded out of the neighbouring months so it stays rectangular');

const sep1 = days.find((d) => d.iso === '2026-09-01');
ok(sep1.count === 3 && sep1.load === 3, `the first is loaded three deep (load ${sep1.load})`);
ok(days.find((d) => d.iso === '2026-09-10').load === 5, 'the tenth is as dark as it goes');
ok(days.find((d) => d.iso === '2026-09-03').load === 0, 'and an empty day carries no colour');

const aug = monthGrid(2026, 7, tasks, TODAY);
const augDays = aug.flatMap((w) => w.days);
ok(augDays.find((d) => d.iso === '2026-08-26').isToday, 'today knows it is today');
ok(augDays.find((d) => d.iso === '2026-08-25').isPast, 'and yesterday knows it has gone');
ok(!augDays.find((d) => d.iso === '2026-08-27').isPast, 'while tomorrow has not');
ok(augDays.find((d) => d.iso === '2026-08-29').isWeekend, 'a Saturday is marked as one');
ok(!augDays.find((d) => d.iso === '2026-08-28').isWeekend, 'a Friday is not');

// A month that would need a sixth row of purely next-month days does not get one.
for (const m of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
  const g = monthGrid(2026, m, [], TODAY);
  const last = g[g.length - 1];
  if (!last.days.some((d) => d.inMonth)) {
    ok(false, `${monthName(2026, m)} ends with a row belonging to nobody`);
    break;
  }
  if (m === 11) ok(true, 'no month ends with a row that belongs entirely to the next one');
}

// ── the days you reach for ──────────────────────────────────────────
const quick = quickTargets(TODAY);
ok(quick[0].label === 'Today' && quick[0].iso === '2026-08-26', 'Today comes first');
ok(quick[1].label === 'Tomorrow' && quick[1].iso === '2026-08-27', 'then tomorrow');
ok(quick[2].label === 'Friday' && quick[2].iso === '2026-08-28',
  `then the rest of the week by name (${quick[2].label})`);
ok(!quick.some((q) => /Saturday|Sunday/.test(q.label)), 'nobody plans a Sunday');
ok(quick.some((q) => q.label === 'Next week' && q.iso === '2026-08-31'),
  'next week means the Monday');
ok(quick.some((q) => q.label === 'Next month'), 'and there is a longer throw');
ok(new Set(quick.map((q) => q.iso)).size === quick.length,
  'no two chips land on the same day');

// On a Friday the named-weekday chips run out rather than spilling sideways.
const friday = quickTargets(new Date(2026, 7, 28));
ok(friday.map((q) => q.label).filter((l) => /day$/.test(l)).length <= 2,
  `late in the week there is little left to name (${friday.map((q) => q.label).join(', ')})`);
ok(friday.some((q) => q.label === 'Next week'), 'but next week is always there');

// ── the week ahead ──────────────────────────────────────────────────
const week = weekAhead(tasks, TODAY);
ok(week.length === 7 && week[0].label === 'Today', 'the strip is seven days from today');
ok(week[1].label === 'Thu', `and names the rest (${week.map((w) => w.label).join(' ')})`);
ok(week.every((w) => typeof w.count === 'number'), 'each carrying its own count');

// ── what still needs a date ─────────────────────────────────────────
const queue = undated(tasks);
const ids = queue.map((t) => t.id);
ok(ids.includes('u1') && ids.includes('u2'), 'undated open work is queued');
ok(!ids.includes('a'), 'anything already dated is not');
ok(!ids.includes('done') && !ids.includes('gone') && !ids.includes('watch'),
  'nor is anything finished, deleted or only being watched');
ok(!ids.includes('u3'), 'and something parked as unclear is left out of a dating queue');
ok(ids[0] === 'u2', 'a flagged item comes first');
ok(ids.indexOf('u1') < ids.indexOf('u4'),
  'then the one with more queued behind it in the same section');

// ── formatting ──────────────────────────────────────────────────────
ok(/Tuesday 1 September/.test(fmtDay('2026-09-01')), `a day reads in full (${fmtDay('2026-09-01')})`);
ok(monthName(2026, 8) === 'September 2026', 'and a month by name');
ok(isoOf(startOfDay(new Date(2026, 7, 26, 23, 30))) === '2026-08-26',
  'late in the evening is still the same day');

// ── nothing at all ──────────────────────────────────────────────────
ok(monthGrid(2026, 8, [], TODAY).flatMap((w) => w.days).every((d) => d.load === 0),
  'an empty register draws an empty month rather than throwing');
ok(undated([]).length === 0 && weekAhead([], TODAY).length === 7, 'and an empty queue is empty');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
