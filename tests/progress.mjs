import { msToMidnight, doneToday, tallyGroups, stampFor, verdict, receipt, receiptText } from '../src/lib/progress.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const now = new Date(2026, 9, 2, 17, 0);
const at = (h, m, day = 2) => new Date(2026, 9, day, h, m).toISOString();
let seq = 0;
const t = (extra) => ({
  id: `t${seq++}`, stream_id: 'isodp', section_id: 's', position: seq, title: `item ${seq}`,
  done: false, done_at: null, cleared_at: null, do_now: false, due: null, deleted_at: null, ...extra,
});

const tasks = [
  t({ id: 'late', title: 'Late one', done: true, done_at: at(10, 40), due: '2026-09-28' }),
  t({ id: 'early', title: 'Early one', done: true, done_at: at(9, 5), stream_id: 'dir' }),
  t({ id: 'cleared', done: true, done_at: at(10, 10), cleared_at: at(11, 0) }),
  t({ id: 'yesterday', done: true, done_at: at(16, 0, 1) }),
  t({ id: 'open' }),
  t({ id: 'binned', done: true, done_at: at(12, 0), deleted_at: at(12, 5) }),
];

const done = doneToday(tasks, now);
ok(JSON.stringify(done.map((x) => x.id)) === JSON.stringify(['early', 'cleared', 'late']),
  `today's ticks, in the order they were ticked, cleared ones included (${done.map((x) => x.id)})`);

ok(JSON.stringify(tallyGroups(13)) === '[5,5,3]', 'tally: gates of five, then the rest');
ok(JSON.stringify(tallyGroups(0)) === '[]', 'tally: nothing drawn for nothing done');
ok(JSON.stringify(tallyGroups(5)) === '[5]', 'tally: the fifth closes the gate');

ok(stampFor(4, 5, 0)?.text === 'Good start', 'the fifth tick earns a stamp');
ok(stampFor(9, 10, 5)?.text === 'On a roll', 'so does the tenth');
ok(stampFor(5, 6, 5) === null, 'ticks between milestones do not');
ok(stampFor(4, 5, 5) === null, 'undo and tick again does not stamp twice');
ok(stampFor(0, 12, 0) === null, 'a jump (data arriving, switching life) does not stamp');
ok(stampFor(6, 5, 0) === null, 'nor does a drop');

ok(verdict(0).includes('young') && verdict(25).includes('earned'), 'the sign-off fits the day');

const r = receipt(done, (id) => ({ isodp: 'ISODP', dir: 'DIR' })[id] ?? '');
ok(r.total === 3, 'receipt totals the day');
ok(r.overdue === 1, 'and counts what was overdue when it was done');
ok(r.lines[0].code === 'DIR' && r.lines[0].time === '09:05', 'each line has its time and stream code');
ok(r.first === '09:05', 'first tick of the day');
ok(r.busiest === '10:00', `busiest hour (${r.busiest})`);
ok(receipt([], () => '').busiest === null, 'no busiest hour on an empty day');

const text = receiptText(r, now);
ok(text.includes('09:05  Early one (DIR)') && text.includes('Total done: 3') && text.includes('Overdue, now done: 1'),
  'the copied text reads as a list');

ok(msToMidnight(new Date(2026, 9, 2, 23, 59, 0)) === 60_000, 'a minute to midnight is a minute');
ok(msToMidnight(new Date(2026, 9, 25, 12, 0)) > 0, 'midnight is always ahead, clocks changing or not');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
