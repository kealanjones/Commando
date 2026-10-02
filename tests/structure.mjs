import { fold, slugId, shift } from '../src/lib/structure.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const S = (id, title, position, parent_id = null) =>
  ({ id, title, position, parent_id, stream_id: 'isodp', owner_id: '', monitor: false, deleted_at: null });
const T = (id, section_id, position, tag = null) =>
  ({ id, section_id, position, tag, title: id, stream_id: 'isodp' });

const sections = [
  S('g-spons', 'Sponsorship', 0),
  S('g-fin', 'Finance', 1),
  S('pipe', 'Pipeline', 0, 'g-spons'),
  S('organox', 'OrganOx', 1, 'g-spons'),
  S('pay', 'Payments', 2, 'g-fin'),
  S('board', 'Congress Board', 3),
];
const tasks = [
  T('o0', 'organox', 0), T('p1', 'pipe', 1), T('p0', 'pipe', 0),
  T('b0', 'board', 0), T('pay0', 'pay', 0, 'kept'),
];

const f = fold(sections, tasks);
const ids = (list) => list.map((x) => x.id).join(',');
ok(ids(f.sections) === 'g-spons,g-fin,board', `two levels: the groups and the ungrouped section (${ids(f.sections)})`);
ok(f.sections.map((s) => s.position).join() === '0,1,2', 'renumbered in the order the tree read');
const inSpons = f.tasks.filter((t) => t.section_id === 'g-spons').sort((a, b) => a.position - b.position);
ok(ids(inSpons) === 'p0,p1,o0', `items fold into the group, sections and items in order (${ids(inSpons)})`);
ok(f.tasks.find((t) => t.id === 'o0').tag === 'OrganOx', 'a moved item is tagged with its old section');
ok(f.tasks.find((t) => t.id === 'pay0').tag === 'kept', 'an existing tag is kept');
ok(f.tasks.find((t) => t.id === 'b0').tag === null && f.tasks.find((t) => t.id === 'b0').section_id === 'board',
  'an item in an ungrouped section is untouched');
ok(ids(fold(f.sections, f.tasks).sections) === ids(f.sections), 'folding twice changes nothing');

ok(slugId('ISODP 2027', []) === 'isodp-2027', 'a new id reads like its name');
ok(slugId('Sponsorship', ['isodp-sponsorship'], 'isodp-') === 'isodp-sponsorship-2', 'and never collides');
ok(slugId('!!!', []) === 'new', 'a name with no letters still gets an id');

const list = [{ id: 'a', position: 0 }, { id: 'b', position: 1 }, { id: 'c', position: 2 }];
ok(JSON.stringify(shift(list, 'b', -1)) === JSON.stringify([{ id: 'b', position: 0 }, { id: 'a', position: 1 }]),
  'moving up swaps with the one above, and only those two change');
ok(shift(list, 'a', -1).length === 0, 'the first cannot move up');
ok(shift(list, 'c', 1).length === 0, 'the last cannot move down');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
