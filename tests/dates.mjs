/** Reading dates back out of what was already written down. */
import { findDate, findDates, findDeadlineHints, fmtDate } from '/home/user/Commando/src/lib/dates.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

// A fixed "today" so nothing here depends on when the suite runs.
const TODAY = new Date(2026, 7, 26);           // Wednesday 26 August 2026

const T = (id, extra = {}) => ({
  id, title: `task ${id}`, kind: 'task', done: false, deleted_at: null, do_now: false, due: null,
  context: null, note: null, section_id: 'sec', stream_id: 'isodp',
  owner_id: '', natural_key: null, done_at: null, position: 0, user_edited: false,
  touched_at: null, reviewed_at: null, unclear: false,
  created_at: '2026-01-01', updated_at: '2026-01-01', ...extra,
});

// ── the shapes that actually appear in the register ─────────────────
const d = (text) => findDate(text, TODAY);

ok(d('9 October, 1-2pm. Agenda to follow.')?.due === '2026-10-09',
  `"9 October, 1-2pm" reads as 9 October (${d('9 October, 1-2pm.')?.due})`);
ok(d('Emirates. Birmingham to Sydney outbound 14 September, return 25 September via Singapore')?.due
  === '2026-09-14', 'the first date in a sentence with two wins');
ok(d('Submit by 28 August 2026')?.due === '2026-08-28', 'an explicit year is taken as given');
ok(d('Board meets 1st May')?.due === '2027-05-01',
  `a day that has gone this year means the next one (${d('Board meets 1st May')?.due})`);
ok(d('Deadline Sep 30')?.due === '2026-09-30', 'month-first reads too');
ok(d('due 2026-12-01')?.due === '2026-12-01', 'an ISO date is exact');
ok(d('the paperwork is due 03/09/2026')?.due === '2026-09-03',
  `a slashed date is read day-first, as this register is written (${d('due 03/09/2026')?.due})`);

ok(d('9 October')?.certainty === 'likely' && d('9 October 2026')?.certainty === 'exact',
  'a year makes the difference between likely and exact');
ok(d('9 October 2026').reason === 'a date, spelled out'
  && /next one/.test(d('9 October').reason),
  'and each carries its own explanation, not a label from a lookup table');

const fri = d('Send it to Isaac by Friday');
ok(fri?.due === '2026-08-28', `"by Friday" is the coming Friday (${fri?.due})`);
// A weekday names a day, never a week. "on Wednesday morning" in a note
// about a trip means that trip's Wednesday, so it is never treated as sure.
ok(fri.certainty === 'vague' && /check it is the right one/.test(fri.reason),
  `and says so rather than pretending (${fri.reason})`);
const wed = d("Share Satya's taxi to the hotel on Wednesday morning");
ok(wed.certainty === 'vague', 'a weekday inside a note about a trip is never a sure thing');
const eow = d('Get this out by end of the week');
ok(eow?.due === '2026-08-28' && eow.certainty === 'vague',
  `"end of the week" is the same Friday, less certainly (${eow?.due})`);
ok(d('wrap up by the end of the month')?.due === '2026-08-31', 'end of the month is its last day');

ok(d('31 February') === null, 'a day that does not exist is not invented');
ok(d('Chase the sponsorship pack') === null, 'text with no date in it yields nothing');
ok(d('') === null && d(null ?? '') === null, 'empty text is safe');
ok(d('Clarify the €1,085 payment') === null, 'a number that is not a date is left alone');

// ── which items get proposed ────────────────────────────────────────
const tasks = [
  T('a', { title: 'Send invitations', context: '9 October, 1-2pm. Agenda to follow.' }),
  T('b', { title: 'Book flights for 14 September' }),
  T('c', { title: 'Already dated', due: '2026-09-01', context: 'meets 9 October' }),
  T('d', { title: 'Finished', done: true, context: 'was 9 October' }),
  T('e', { title: 'Watching something', kind: 'watch', context: 'due 9 October' }),
  T('f', { title: 'Gone', deleted_at: '2026-08-01', context: '9 October' }),
  T('g', { title: 'Mail leaflets to Dale ahead of the Australia trip' }),
  T('h', { title: 'Get European outreach underway before Sydney' }),
  T('i', { title: 'Nothing doing here at all' }),
  T('j', { title: 'Speak to Sinead before she proceeds too far with recruitment' }),
  T('k', { title: 'Note carries it', note: 'agreed with Anthony: by Friday' }),
];

const found = findDates(tasks, TODAY);
const ids = found.map((f) => f.task.id);

ok(ids.includes('a') && ids.includes('b'), 'items with a date in their own words are proposed');
ok(!ids.includes('c'), 'an item that already has a date is left alone');
ok(!ids.includes('d'), 'so is one that is finished');
ok(!ids.includes('e'), 'and one you are only keeping tabs on');
ok(!ids.includes('f'), 'and one that has been deleted');
ok(ids.includes('k'), 'a date in your own note counts');

ok(found.find((f) => f.task.id === 'a').where === 'context',
  'the find says which field carried it');
ok(found.find((f) => f.task.id === 'a').evidence === '9 October',
  `and shows the words it came from (${found.find((f) => f.task.id === 'a').evidence})`);
ok(found.find((f) => f.task.id === 'b').where === 'title', 'a title beats a note');

const order = found.map((f) => f.certainty);
ok(order.indexOf('vague') === -1 || order.indexOf('vague') >= order.lastIndexOf('likely'),
  'the ones you can accept without thinking come first');

// ── deadlines with no day ───────────────────────────────────────────
const hints = findDeadlineHints(tasks, TODAY);
const hintIds = hints.map((h) => h.task.id);
ok(hintIds.includes('g') && hintIds.includes('h'),
  'a promise with no day is gathered rather than guessed at');
ok(!hintIds.includes('a') && !hintIds.includes('k'),
  'an item that already gave up a date is not asked about twice');
ok(!hintIds.includes('i'), 'and one that promises nothing is left out');
ok(!hintIds.includes('j'), '"before she proceeds" is not a deadline');
ok(!hintIds.includes('c'), 'nor is anything already dated');

const g = hints.find((h) => h.task.id === 'g');
ok(/ahead of the Australia trip/.test(g.evidence),
  `the hint quotes your own clause (${g.evidence})`);
ok(g.evidence.length <= 90, 'and keeps it to a readable length');

// ── nothing is written by any of this ───────────────────────────────
ok(tasks.every((t) => t.due === null || t.id === 'c'), 'reading proposes; it never sets anything');

ok(/9 October 2026/.test(fmtDate('2026-10-09')), `dates read back in full (${fmtDate('2026-10-09')})`);

ok(findDates([], TODAY).length === 0 && findDeadlineHints([], TODAY).length === 0,
  'an empty register proposes nothing');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
