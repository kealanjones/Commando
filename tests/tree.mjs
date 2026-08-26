/** Stream → group → section: the shape, and the order it reads in. */
import { branchesFor, leavesFor, isGroup, pathOf, groupOf } from '/home/user/Commando/src/lib/tree.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const S = (id, stream, title, position, parent = null) =>
  ({ id, title, stream_id: stream, owner_id: '', monitor: false, parent_id: parent, position, deleted_at: null });

// Deliberately declared out of order: nothing may depend on array order.
const sections = [
  S('isodp-web', 'isodp', 'Website', 12),
  S('g-finance', 'isodp', 'Finance', 1),
  S('isodp-pay', 'isodp', 'Sponsor payment process', 5, 'g-finance'),
  S('g-spons', 'isodp', 'Sponsorship', 0),
  S('isodp-organox', 'isodp', 'OrganOx', 1, 'g-spons'),
  S('isodp-spons', 'isodp', 'Pipeline and outreach', 0, 'g-spons'),
  S('isodp-budget', 'isodp', 'Budget management', 7, 'g-finance'),
  S('isodp-hotels', 'isodp', 'Hotels and accommodation', 13),
  S('cttl-gov', 'cttl', 'Governance and meetings', 0),
  S('cttl-aus', 'cttl', 'Australia and Sydney', 2),
  S('g-empty', 'isodp', 'An area with nothing in it', 99),
];

const isodp = branchesFor(sections, 'isodp');
const titles = isodp.map((b) => b.node.title);

ok(titles[0] === 'Sponsorship' && titles[1] === 'Finance',
  `groups come back in the order their contents read (${titles.slice(0, 2).join(', ')})`);
ok(titles.indexOf('Website') < titles.indexOf('Hotels and accommodation'),
  'a bare section takes its own place in that order, not a place after the groups');
ok(isodp.find((b) => b.node.title === 'Sponsorship').children.map((c) => c.title)
  .join('|') === 'Pipeline and outreach|OrganOx',
  'children come back in their own order, whatever order they were declared in');

const bare = isodp.find((b) => b.node.id === 'isodp-web');
ok(bare.children.length === 0, 'a section with no group has no children');
ok(bare.leaves.length === 1 && bare.leaves[0].id === 'isodp-web',
  'and stands as its own leaf, so callers need no special case');

const spons = isodp.find((b) => b.node.id === 'g-spons');
ok(spons.leaves.length === 2 && !spons.leaves.some((l) => l.id === 'g-spons'),
  'a group is never one of its own leaves');

ok(branchesFor(sections, 'cttl').every((b) => b.children.length === 0),
  'a stream small enough to read at a glance has no middle level at all');

const leaves = leavesFor(sections, 'isodp').map((s) => s.id);
ok(!leaves.includes('g-spons') && !leaves.includes('g-finance'),
  'a group is never offered as somewhere to put work');
ok(leaves.includes('isodp-pay') && leaves.includes('isodp-web'),
  'every section that can hold work is offered');
ok(new Set(leaves).size === leaves.length, 'and each of them exactly once');

ok(isGroup('g-spons', sections) === true, 'a row with children is a group');
ok(isGroup('isodp-web', sections) === false, 'a row without them is not');
ok(isGroup('g-empty', sections) === false, 'a group that has been emptied stops being one');
ok(leaves.includes('g-empty'), 'so it becomes a place work can go, rather than a dead heading');

ok(pathOf(sections, 'isodp-organox') === 'Sponsorship › OrganOx', 'a path names the group');
ok(pathOf(sections, 'isodp-web') === 'Website', 'and says nothing extra when there is no group');
ok(pathOf(sections, 'nonexistent') === '', 'a missing section is empty, not a crash');

ok(groupOf(sections, 'isodp-pay')?.id === 'g-finance', 'a section knows its group');
ok(groupOf(sections, 'cttl-gov') === null, 'and null when it has none');

ok(branchesFor([], 'isodp').length === 0, 'an empty register produces no branches');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
