/** The brief: what goes in it, what stays out, and what it reads like. */
import { buildBrief } from '/home/user/Commando/src/lib/brief.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const ago = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const day = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

const T = (id, title, extra = {}) => ({
  id, title, kind: 'task', done: false, deleted_at: null, do_now: false, due: null,
  context: null, note: null, section_id: 'spons', stream_id: 'isodp',
  owner_id: '', natural_key: null, done_at: null, position: 0, user_edited: false,
  touched_at: null, reviewed_at: null, unclear: false,
  created_at: ago(60), updated_at: ago(1), ...extra,
});
const S = (id, stream, title, parent = null) =>
  ({ id, title, stream_id: stream, owner_id: '', monitor: false, parent_id: parent, position: 0, deleted_at: null });

const sections = [
  S('g-spons', 'isodp', 'Sponsorship'),
  S('spons', 'isodp', 'Pipeline and outreach', 'g-spons'),
  S('pay', 'isodp', 'Sponsor payment process', 'g-spons'),
  S('aus', 'cttl', 'Australia and Sydney'),
];
const streams = [
  { id: 'isodp', title: 'ISODP 2027', short: 'ISODP 2027', code: 'ISODP', owner_id: '', position: 0 },
  { id: 'cttl', title: 'Commonwealth Tribute to Life', short: 'Commonwealth', code: 'CTtL', owner_id: '', position: 1 },
];
const people = [
  { id: 'anthony', name: 'Anthony', role: 'Director' },
  { id: 'dale', name: 'Dale', role: null },
];

const tasks = [
  T('late', 'Send the priority sponsor list', { due: day(-4), touched_at: ago(2) }),
  T('flag', 'Prepare a chasing text for priority sponsors', { do_now: true, touched_at: ago(1) }),
  T('soon', 'Draft the outreach email', { due: day(5), touched_at: ago(1) }),
  T('quiet', 'Follow up the OrganOx marketing manager', { touched_at: ago(40) }),
  T('plain', 'Share the sponsorship recap', { touched_at: ago(2) }),
  T('murky', 'Work out what TransNovo actually want', { unclear: true, touched_at: ago(3) }),
  T('closed', 'Confirmed the Getinge commitment', { done: true, done_at: ago(3), touched_at: ago(3) }),
  T('old', 'Something finished long ago', { done: true, done_at: ago(90), touched_at: ago(90) }),
  T('watch', 'Getinge are reorganising', { kind: 'watch', touched_at: ago(5) }),
  T('gone', 'Deleted thing', { deleted_at: ago(1) }),
  T('other', 'Chase Belaal about the Australia trip', { section_id: 'aus', stream_id: 'cttl', touched_at: ago(6) }),
];

const taskPeople = [
  { task_id: 'late', person_id: 'anthony' },
  { task_id: 'flag', person_id: 'anthony' },
  { task_id: 'quiet', person_id: 'anthony' },
  { task_id: 'closed', person_id: 'anthony' },
  { task_id: 'other', person_id: 'anthony' },
  { task_id: 'late', person_id: 'dale' },
  { task_id: 'plain', person_id: 'dale' },
];

const base = { tasks, sections, streams, people, taskPeople, since: 14 };
const forPerson = buildBrief({ ...base, subject: { kind: 'person', id: 'anthony' } });
const forStream = buildBrief({ ...base, subject: { kind: 'stream', id: 'isodp' } });

const block = (b, h) => b.blocks.find((x) => x.heading.toLowerCase().startsWith(h.toLowerCase()));
const titles = (blk) => (blk?.lines ?? []).map((l) => l.task.title);

// ── a person ────────────────────────────────────────────────────────
ok(forPerson.title === 'Anthony · Director', `a person brief is headed by them (${forPerson.title})`);
ok(/4 open items/.test(forPerson.standfirst),
  `and counts what is open with them (${forPerson.standfirst})`);
ok(/across ISODP 2027 and Commonwealth\./.test(forPerson.standfirst),
  'and names every stream they turn up in, as a sentence');
ok(/1 closed in the last 14 days/.test(forPerson.standfirst), 'and what has closed in the window');

const need = block(forPerson, 'What I need');
ok(titles(need).includes('Send the priority sponsor list'), 'an overdue item leads');
ok(titles(need)[0] === 'Send the priority sponsor list', 'and comes before a merely flagged one');
ok(need.lines[0].note.startsWith('overdue'), `with why it is pressing (${need.lines[0].note})`);
ok(titles(need).includes('Prepare a chasing text for priority sponsors'), 'a flagged item is pressing too');

const longest = block(forPerson, 'Waiting longest');
ok(titles(longest).includes('Follow up the OrganOx marketing manager'),
  'the thing nobody has touched in six weeks is called out');
ok(/40 days untouched/.test(longest.lines[0].note), `and says how long (${longest.lines[0].note})`);

const movedP = block(forPerson, 'Moved since');
ok(titles(movedP).includes('Confirmed the Getinge commitment'), 'what closed recently is reported');
ok(!titles(movedP).includes('Something finished long ago'), 'and what closed months ago is not');

const allPersonTitles = forPerson.blocks.flatMap(titles);
ok(!allPersonTitles.includes('Share the sponsorship recap'),
  'work that does not involve them stays out of their brief');
ok(!allPersonTitles.includes('Deleted thing'), 'and so does anything deleted');
ok(allPersonTitles.includes('Chase Belaal about the Australia trip'),
  'but their work in another stream comes in');

// ── a stream ────────────────────────────────────────────────────────
ok(forStream.title === 'ISODP 2027', 'a stream brief is headed by the stream');
ok(/6 open, 1 being kept an eye on\./.test(forStream.standfirst),
  `and separates doing from watching (${forStream.standfirst})`);

ok(titles(block(forStream, 'Pressing')).includes('Send the priority sponsor list'), 'pressing work leads');
ok(titles(block(forStream, 'Gone quiet')).includes('Follow up the OrganOx marketing manager'),
  'and what has gone quiet is named');
ok(titles(block(forStream, 'Not clear yet')).includes('Work out what TransNovo actually want'),
  'the parked items are listed rather than hidden');

const waiting = block(forStream, 'Waiting on somebody');
ok(waiting.lines.some((l) => /Dale/.test(l.note)), `and who each one sits with (${waiting.lines[0]?.note})`);

const streamTitles = forStream.blocks.flatMap(titles);
ok(!streamTitles.includes('Chase Belaal about the Australia trip'),
  'another stream\'s work stays out');

// ── the window moves ────────────────────────────────────────────────
const wide = buildBrief({ ...base, since: 120, subject: { kind: 'stream', id: 'isodp' } });
ok(titles(block(wide, 'Moved recently')).includes('Something finished long ago'),
  'a wider window reaches further back');
const narrow = buildBrief({ ...base, since: 1, subject: { kind: 'stream', id: 'isodp' } });
ok(titles(block(narrow, 'Moved recently')).length === 0, 'and a narrow one reaches almost nowhere');
ok(block(narrow, 'Moved recently').emptyAs !== null,
  'a block with nothing in it still says so rather than lying by omission');

// ── the text you actually paste ─────────────────────────────────────
const text = forPerson.text;
ok(text.startsWith('Anthony · Director'), 'the pasted text opens with who it is about');
ok(/WHAT I NEED FROM ANTHONY/.test(text), 'headings survive as plain text');
ok(/· Send the priority sponsor list — overdue/.test(text),
  'every line carries its reason');
ok(/\(also Dale\)/.test(text), 'and says who else is on it');
ok(/Prepared \w+day, \d+ \w+ \d{4}\./.test(text), `it is dated (${text.trim().split('\\n').pop()})`);
ok(!/<|>|\*\*/.test(text), 'no markup: it has to survive Teams and Outlook');

// ── nothing there ───────────────────────────────────────────────────
const nobody = buildBrief({ ...base, subject: { kind: 'person', id: 'nobody' } });
ok(nobody.blocks.every((b) => b.lines.length === 0), 'an unknown subject produces an empty brief');
ok(nobody.text.length > 0, 'and still produces readable text rather than nothing');

const empty = buildBrief({
  subject: { kind: 'stream', id: 'isodp' }, since: 14,
  tasks: [], sections: [], streams: [], people: [], taskPeople: [],
});
ok(/0 open/.test(empty.standfirst), 'an empty register briefs as empty rather than throwing');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
