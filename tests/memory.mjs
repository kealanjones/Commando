import { asQuestion, byKind, exportMarkdown, memoryDigest, noteKey, relevantNotes, timeline } from '../src/lib/memory.ts';
import { parseProposals, buildPrompt } from '../src/lib/proposalFormat.ts';
import { missingColumn, missingTable } from '../src/lib/dbError.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const notes = [
  { id: 'n1', kind: 'project', key: 'isodp', title: 'ISODP 2027', now: 'Sponsorship is the critical path.', updated_at: '2026-09-30' },
  { id: 'n2', kind: 'person', key: 'anthony', title: 'Anthony', now: 'Director.', updated_at: '2026-09-30' },
  { id: 'n3', kind: 'person', key: 'derek', title: 'Derek', now: '', updated_at: '2026-09-30' },
  { id: 'n4', kind: 'topic', key: 'gone', title: 'Gone', now: 'x', updated_at: '2026-09-30', deleted_at: '2026-09-30' },
];
const entries = [
  { id: 'e2', note_id: 'n1', intake_id: 'm2', happened_on: '2026-09-28', text: 'Isaac needs the numbers.' },
  { id: 'e1', note_id: 'n1', intake_id: 'm1', happened_on: '2026-09-20', text: 'OrganOx agreed in principle.' },
  { id: 'e3', note_id: 'n2', intake_id: null, happened_on: null, text: 'Prefers short texts.' },
  { id: 'e4', note_id: 'n1', intake_id: 'm1', happened_on: '2026-09-21', text: 'struck', deleted_at: '2026-09-29' },
];
const meetings = [
  { id: 'm1', label: 'SMT', created_at: '2026-09-20T10:00:00Z', in_memory: true, remembered_at: '2026-09-20T11:00:00Z' },
  { id: 'm2', label: 'ISODP weekly', created_at: '2026-09-28T10:00:00Z', in_memory: true, remembered_at: '2026-09-28T11:00:00Z' },
  { id: 'm3', label: 'Not yet', created_at: '2026-09-29T10:00:00Z', in_memory: true, remembered_at: null },
];

const g = byKind(notes);
ok(g.project.length === 1 && g.person.map((n) => n.title).join() === 'Anthony,Derek' && g.topic.length === 0,
  'notes group by kind, alphabetically, without deleted ones');
ok(timeline(entries, 'n1').map((e) => e.id).join() === 'e1,e2', 'a timeline runs oldest first, without struck lines');

const md = exportMarkdown(notes, entries, meetings, new Date('2026-10-02T09:00:00Z'));
ok(md.startsWith('# My work memory'), 'the export is a Markdown document');
ok(md.includes('Built from 2 meetings') && md.includes('3 notes'), 'it says what it was built from');
ok(md.includes('### ISODP 2027') && md.includes('**Now:** Sponsorship is the critical path.'), 'each note has its title and where things stand');
ok(md.includes('- 2026-09-20 OrganOx agreed in principle. _(SMT, 2026-09-20)_'), 'each line says which meeting it came from');
ok(md.includes('- Prefers short texts. _(added by hand)_'), 'a line typed by hand says so');
ok(!md.includes('struck') && !md.includes('### Gone'), 'struck lines and deleted notes stay out');
ok(md.indexOf('## Projects') < md.indexOf('## People'), 'projects come before people');

const d = memoryDigest(notes);
ok(d.includes('- [project] ISODP 2027: Sponsorship is the critical path.') && d.includes('- [person] Derek'), 'the digest is each note and where it stands');
ok(!d.includes('OrganOx'), 'without the timeline: background, not the whole memory');
ok(memoryDigest(notes, 20).length <= 22, 'and it stays within the size it is given');

const reply = '```json\n{"summary":"S","memory":"OrganOx signed.","items":[ITEM]}\n```'.replace('ITEM', '{"title":"Chase Derek","section_id":null,"evidence":"Derek owes the list."}');
ok(parseProposals(reply).memory === 'OrganOx signed.', 'a Via Claude reply carries what it wrote for the memory');
ok(parseProposals('```json\n{"summary":"S","items":[ITEM]}\n```'.replace('ITEM', '{"title":"Chase Derek","section_id":null,"evidence":"Derek owes the list."}')).memory === '', 'and a reply without it is still fine');
const prompt = buildPrompt([], [], [], 'notes', d);
ok(prompt.includes('WHAT YOU ALREADY KNOW') && prompt.includes('Sponsorship is the critical path.'), 'the Via Claude prompt carries what the memory knows');
ok(prompt.includes('"memory":'), 'and asks for a memory part in the reply');
ok(!buildPrompt([], [], [], 'notes').includes('WHAT YOU ALREADY KNOW from my earlier meetings'), 'an empty memory adds nothing to the prompt');

const memOnly = parseProposals('```json\n{"summary":"Board update","memory":"The board backed the Kyoto route.","items":[]}\n```');
ok(memOnly.items.length === 0 && memOnly.memory.includes('Kyoto'), 'a reply with no actions but something to remember is accepted');
let threw = false;
try { parseProposals('```json\n{"summary":"x","items":[]}\n```'); } catch { threw = true; }
ok(threw, 'a reply with neither actions nor memory is still refused');

ok(missingColumn({ code: 'PGRST204', message: "Could not find the 'memory_text' column" }), 'PostgREST\'s missing column (PGRST204) is recognised');
ok(missingColumn({ code: '42703' }), 'as is Postgres\'s (42703)');
ok(missingTable({ code: 'PGRST205' }) && missingTable({ code: '42P01' }), 'a missing table is recognised either way');
ok(!missingTable({ message: 'Failed to fetch' }) && !missingTable({ code: 'PGRST301' }), 'being offline or signed out is not a missing table');

// ── context beside the work ────────────────────────────────────────
const know = [
  { id: 'p1', kind: 'project', key: 'isodp', title: 'ISODP 2027', now: 'x', updated_at: '' },
  { id: 'p2', kind: 'project', key: 'dir', title: 'Directorate', now: 'x', updated_at: '' },
  { id: 'a', kind: 'person', key: 'anthony clarkson', title: 'Anthony Clarkson', now: 'x', updated_at: '' },
  { id: 's', kind: 'person', key: 'suzanne', title: 'Suzanne', now: 'x', updated_at: '' },
  { id: 'al', kind: 'person', key: 'al', title: 'Al', now: 'x', updated_at: '' },
  { id: 't1', kind: 'topic', key: 'sponsor-payments', title: 'Sponsor payments', now: 'x', updated_at: '' },
  { id: 't2', kind: 'topic', key: 'board', title: 'Board', now: 'x', updated_at: '' },
  { id: 't3', kind: 'topic', key: 'old', title: 'Sponsor payments old', now: 'x', updated_at: '', deleted_at: '2026-01-01' },
];
const rel = (about, max) => relevantNotes(know, about, max).map((n) => n.id).join();
ok(rel({ streamId: 'isodp' }) === 'p1', 'an item brings its project\'s note, and no other project\'s');
ok(rel({ streamId: 'isodp', people: ['Anthony Clarkson'] }) === 'p1,a', 'and the note of whoever it waits on');
ok(rel({ text: 'Send Anthony the short list' }) === 'a', 'a person is found by first name in the words');
ok(rel({ text: 'Ask Suzanne how Kyoto took payments from each sponsor' }) === 's,t1', 'a topic by every distinctive word of its title, in any order');
ok(rel({ text: 'Clarify the process for sponsor payments' }) === 't1', 'or by its title outright');
ok(rel({ text: 'Also update the dashboard and call Alan' }) === '', 'short names and part-words do not match by accident');
ok(rel({ text: 'Paper for the board' }) === 't2', 'a one-word topic needs the whole word');
ok(rel({ streamId: 'isodp', people: ['Suzanne'], text: 'Anthony on sponsor payments for the board' }, 3) === 'p1,a,s',
  'project first, then people, then topics, up to the limit');
ok(rel({}) === '', 'nothing to go on brings nothing');

ok(noteKey('topic', '  Sponsor payments (2027)! ') === 'sponsor-payments-2027', 'a topic is keyed by a slug of its name');
ok(noteKey('person', '  Suzanne   Clarke ') === 'suzanne clarke', 'a person by their name in lower case');
ok(noteKey('topic', '!!!') === '', 'a name with nothing in it makes no key');

ok(asQuestion('? what did we agree') === 'what did we agree', 'search that starts with ? is a question');
ok(asQuestion('  ?who owes me') === 'who owes me' && asQuestion('?') === '', 'with or without the space');
ok(asQuestion('what? no') === null && asQuestion('') === null, 'a ? anywhere else is just a search');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
