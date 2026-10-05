import {
  buildReceipt, code39, code39Width, dayLabel, linesFromTasks, receiptDays, receiptText, stepDay,
} from '../src/lib/receipt.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const at = (h, m, day = '2026-10-05') => new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();
let seq = 0;
const line = (extra) => ({
  id: `l${seq++}`, task_id: `t${seq}`, kind: 'done', title: `item ${seq}`, code: 'ISODP', stream_id: 'isodp',
  minutes: null, at: at(9, 0), day: '2026-10-05', undone_at: null, ...extra,
});

const lines = [
  line({ title: 'Sent the tiers', at: at(9, 5), code: 'ISODP', minutes: 12 }),
  line({ title: 'Booked the room', at: at(10, 10), code: 'ISODP' }),
  line({ title: 'Paid the fee', at: at(10, 40), code: 'PER' }),
  line({ title: 'Paid the fee', at: at(10, 41), kind: 'returned', code: 'PER' }),
  line({ title: 'Old thing', at: at(11, 0), kind: 'void', code: 'DIR' }),
  line({ title: 'A slip', at: at(11, 30), undone_at: at(11, 30) }),
  line({ title: 'Yesterday', at: at(14, 0, '2026-10-04'), day: '2026-10-04' }),
  line({ title: 'Last week', at: at(14, 0, '2026-09-29'), day: '2026-09-29', code: 'DIR' }),
];

const r = buildReceipt(lines, '2026-10-05');
ok(r.lines.length === 5, `today's lines, in order, an undone one left off (${r.lines.length})`);
ok(r.lines.map((l) => l.kind).join() === 'done,done,done,returned,void', 'returns and voids print where they happened');
ok(r.total === 2, `total is done less returned (${r.total})`);
ok(r.returned === 1 && r.voided === 1, 'and both are counted');
ok(r.minutes === 12, 'minutes stayed with things add up');
ok(JSON.stringify(r.subtotals) === JSON.stringify([{ code: 'ISODP', n: 2 }, { code: 'PER', n: 1 }]), 'a subtotal per project, most first');
ok(r.first === '09:05' && r.last === '10:40', 'first and last tick');
ok(r.busiest === '10:00', `busiest hour (${r.busiest})`);
ok(r.verdict === 'A start is a start.', 'the verdict reads the total');
ok(buildReceipt(lines, '2026-10-03').lines.length === 0 && buildReceipt(lines, '2026-10-03').total === 0, 'an empty day is empty');

ok(receiptDays(lines).join() === '2026-10-05,2026-10-04,2026-09-29', 'the roll lists its days, newest first');
ok(stepDay(receiptDays(lines), '2026-10-05', -1, '2026-10-05') === '2026-10-04', 'back one goes to the last day with a receipt');
ok(stepDay(receiptDays(lines), '2026-10-04', -1, '2026-10-05') === '2026-09-29', 'and skips the empty days between');
ok(stepDay(receiptDays(lines), '2026-09-29', -1, '2026-10-05') === null, 'the roll starts somewhere');
ok(stepDay(receiptDays(lines), '2026-09-29', 1, '2026-10-05') === '2026-10-04', 'forward goes the other way');
ok(stepDay([], '2026-10-05', 1, '2026-10-05') === null, 'nothing after today');
ok(stepDay(['2026-10-01'], '2026-10-05', -1, '2026-10-05') === '2026-10-01', 'today counts even with no lines yet');

ok(dayLabel('2026-10-05', '2026-10-05').startsWith('Today · Mon, 05 Oct 2026'), 'today is labelled so');
ok(dayLabel('2026-10-04', '2026-10-05').startsWith('Yesterday'), 'and yesterday');
ok(dayLabel('2026-09-29', '2026-10-05') === 'Tue, 29 Sept 2026' || dayLabel('2026-09-29', '2026-10-05') === 'Tue, 29 Sep 2026', 'older days are just the date');

const text = receiptText(r, '2026-10-05');
ok(text.includes('09:05  Sent the tiers (ISODP)  12 min') && text.includes('RETURNED  Paid the fee') && text.includes('VOID  Old thing'), 'the copied text says it all');
ok(text.includes('Total done: 2') && text.includes('  ISODP: 2'), 'with the sums');

const fromTasks = linesFromTasks([
  { id: 'a', title: 'A', stream_id: 'isodp', done: true, done_at: at(9, 0) },
  { id: 'b', title: 'B', stream_id: 'isodp', done: false, done_at: null },
], () => 'ISODP');
ok(fromTasks.length === 1 && fromTasks[0].kind === 'done' && fromTasks[0].day === '2026-10-05', 'without the roll, done items stand in');

// Code 39: a real barcode. Each character is five bars and four spaces,
// three of the nine wide; a narrow gap between characters.
const bars = code39('2026-10-05');
ok(bars.length === 12 * 5, `five bars a character, asterisks included (${bars.length})`);
ok(code39Width('2026-10-05') === 12 * 16 - 1, `each character 16 units wide (six narrow, three wide, a gap) less the last gap (${code39Width('2026-10-05')})`);
ok(bars[0].x === 0 && bars[0].w === 1 && bars[1].w === 1 && bars[2].w === 3, 'the start asterisk is narrow narrow wide bars');
ok(code39('') .length === 10, 'an empty message is just the two asterisks');
ok(code39('a!b').length === 20, 'unknown characters are skipped, letters are upper-cased');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
