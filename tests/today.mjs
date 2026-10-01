import { todayGroups, isoDay } from '../src/lib/today.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const now = new Date(2026, 9, 1, 9, 30); // Thu 1 Oct 2026, local time
const day = (n) => isoDay(new Date(2026, 9, 1 + n));
let seq = 0;
const t = (extra) => ({
  id: `t${seq++}`, stream_id: 'isodp', section_id: 's', position: seq, title: `item ${seq}`,
  done: false, done_at: null, do_now: false, due: null, deleted_at: null, ...extra,
});

ok(isoDay(now) === '2026-10-01', 'a day is written the way due is stored');

const items = [
  t({ id: 'late2', due: day(-2) }),
  t({ id: 'late9', due: day(-9) }),
  t({ id: 'today', due: day(0) }),
  t({ id: 'soon', due: day(3) }),
  t({ id: 'urgent', do_now: true }),
  t({ id: 'urgentSoon', do_now: true, due: day(5) }),
  t({ id: 'urgentLate', do_now: true, due: day(-1) }),
  t({ id: 'plain' }),
  t({ id: 'doneLate', due: day(-4), done: true, done_at: now.toISOString() }),
  t({ id: 'doneYesterday', done: true, done_at: new Date(2026, 8, 30, 12).toISOString() }),
  t({ id: 'gone', due: day(-1), deleted_at: now.toISOString() }),
];
const g = todayGroups(items, now);
const ids = (list) => list.map((x) => x.id);

ok(JSON.stringify(ids(g.overdue)) === JSON.stringify(['late9', 'late2', 'urgentLate']),
  `overdue holds every past date, oldest first (${ids(g.overdue)})`);
ok(JSON.stringify(ids(g.today)) === JSON.stringify(['today']), 'today holds what is due today');
ok(JSON.stringify(ids(g.urgent)) === JSON.stringify(['urgentSoon', 'urgent']),
  `urgent holds flagged items not already overdue or due, dated ones first (${ids(g.urgent)})`);
ok(!ids([...g.overdue, ...g.today, ...g.urgent]).includes('soon'), 'a future date alone is not Today');
ok(!ids([...g.overdue, ...g.today, ...g.urgent]).includes('plain'), 'an undated, unflagged item is not Today');
ok(!ids(g.overdue).includes('doneLate'), 'a finished item leaves');
ok(!ids(g.overdue).includes('gone'), 'a deleted item leaves');
ok(g.toDo === 6, `the count is what is still open across the three (${g.toDo})`);
ok(g.doneToday === 1, `done today counts only today's ticks (${g.doneToday})`);

const held = todayGroups(items, now, new Set(['doneLate']));
ok(ids(held.overdue).includes('doneLate'), 'a just-ticked item is held in place for the undo');
ok(held.toDo === 6, 'but it does not count as still to do');

const empty = todayGroups([t({}), t({ due: day(10) })], now);
ok(empty.overdue.length + empty.today.length + empty.urgent.length === 0, 'a calm register gives an empty Today');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
