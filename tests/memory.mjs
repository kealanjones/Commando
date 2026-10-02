import { byKind, exportMarkdown, memoryDigest, timeline } from '../src/lib/memory.ts';
import { parseProposals, buildPrompt } from '../src/lib/proposalFormat.ts';

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
