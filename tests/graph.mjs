/**
 * The Web's two engines, with no browser in sight: what the graph says
 * about the register, and where the layouts put things.
 */
import { buildGraph, quietness, QUIET_FULL_DAYS } from '/home/user/Commando/src/lib/web.ts';
import { WebSim, PLOT, fitTransform, toWorld, clampZoom } from '/home/user/Commando/src/lib/force.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const ago = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

const T = (id, section, stream, extra = {}) => ({
  id, title: `task ${id}`, kind: 'task', done: false, deleted_at: null, do_now: false, due: null,
  context: null, note: null, section_id: section, stream_id: stream,
  owner_id: '', natural_key: null, done_at: null, position: 0, user_edited: false,
  touched_at: null, reviewed_at: null, unclear: false,
  created_at: '2026-01-01', updated_at: '2026-01-01', ...extra,
});
const S = (id, stream, title, monitor = false, parent = null) =>
  ({ id, title, stream_id: stream, owner_id: '', monitor, parent_id: parent, position: 0, deleted_at: null });

// aus and office share Satya; aus and organox share Dale; hotels is alone.
const sections = [
  S('aus', 'cttl', 'Australia and Sydney'),
  S('organox', 'isodp', 'Sponsorship — OrganOx'),
  S('hotels', 'isodp', 'Hotels'),
  S('office', 'dir', 'Office'),
  S('restructure', 'dir', 'Restructure', true),
];
const streams = [
  { id: 'cttl', title: 'Commonwealth', short: 'Commonwealth', code: 'CTtL', owner_id: '', position: 0 },
  { id: 'isodp', title: 'ISODP 2027', short: 'ISODP 2027', code: 'ISODP', owner_id: '', position: 1 },
  { id: 'dir', title: 'Directorate', short: 'Directorate', code: 'Dir', owner_id: '', position: 2 },
];
const tasks = [
  T('a1', 'aus', 'cttl', { touched_at: ago(4) }),
  T('a2', 'aus', 'cttl', { do_now: true }),
  T('a3', 'aus', 'cttl', { done: true, kind: 'task' }),
  T('a4', 'aus', 'cttl', { kind: 'watch' }),
  T('o1', 'organox', 'isodp', { touched_at: ago(0) }),
  T('o2', 'organox', 'isodp', { due: '2020-01-01' }),
  T('h1', 'hotels', 'isodp', { touched_at: ago(30) }),
  T('f1', 'office', 'dir', {}),
  T('r1', 'restructure', 'dir', { kind: 'watch' }),
  T('gone', 'office', 'dir', { deleted_at: ago(1) }),
];
const people = [
  { id: 'satya', name: 'Satya', role: null },
  { id: 'dale', name: 'Dale', role: null },
  { id: 'solo', name: 'Gurch', role: null },
];
const taskPeople = [
  { task_id: 'a1', person_id: 'satya' }, { task_id: 'f1', person_id: 'satya' },
  { task_id: 'a2', person_id: 'dale' }, { task_id: 'o1', person_id: 'dale' },
  { task_id: 'h1', person_id: 'solo' },
];
const threads = [{ id: 'th1', owner_id: '', title: 'Sydney', anchor: 'Sydney', created_at: '', deleted_at: null }];
const threadLinks = [{ task_id: 'a2', thread_id: 'th1' }, { task_id: 'h1', thread_id: 'th1' }];

const g = buildGraph({ tasks, sections, streams, people, taskPeople, threads, threadLinks });
const node = (id) => g.nodes.find((n) => n.id === id);
const edge = (a, b) => g.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));

// ── counts ─────────────────────────────────────────────────────────
ok(g.nodes.length === 5, 'a node per section');
ok(node('aus').open === 2 && node('aus').done === 1 && node('aus').watch === 1,
  `Australia counts open/done/watch separately (${node('aus').open}/${node('aus').done}/${node('aus').watch})`);
ok(node('aus').total === 3, 'size counts open work plus what is being watched, not what is finished');
ok(Math.abs(node('aus').progress - 1 / 3) < 1e-9, 'progress is done over graded items');
ok(node('office').open === 1, 'a deleted row is not counted');
ok(node('aus').pressing === 1 && node('organox').pressing === 1,
  'pressing counts a flag and a date already gone');

// ── links ──────────────────────────────────────────────────────────
ok(edge('aus', 'office')?.people.includes('satya'), 'a shared person links two sections');
ok(edge('aus', 'office').crossing === true, 'that link is marked as crossing streams');
ok(edge('aus', 'organox')?.people.includes('dale'), 'the second connector links its own pair');
ok(edge('aus', 'hotels')?.threads.includes('th1'), 'a shared thread links two sections');
ok(edge('aus', 'hotels').weight === 2 && edge('aus', 'office').weight === 1,
  'a thread you drew counts double a name that was merely observed');
ok(!edge('hotels', 'office'), 'sections sharing nothing are not linked');
ok(g.totals.isolated === 1 && node('restructure').people.length === 0,
  'the section nobody else is in is counted as isolated');

// ── who holds it together ──────────────────────────────────────────
ok(g.connectors.length === 2, 'only people in more than one section are connectors');
ok(g.connectors[0].sections.length >= g.connectors[1].sections.length, 'connectors come back by reach');
ok(g.soloPeople === 1, 'the one-section person is counted, not listed');
ok(g.connectors.find((c) => c.id === 'satya').streams.length === 2, 'Satya spans two streams');
ok(g.threads[0].sections.length === 2, 'the thread reaches two sections');

// ── groups are headings, not places ────────────────────────────────
{
  const grouped = buildGraph({
    tasks, streams, people, taskPeople, threads, threadLinks,
    sections: [
      { ...S('g-spons', 'isodp', 'Sponsorship') },
      { ...S('organox', 'isodp', 'OrganOx', false, 'g-spons') },
      { ...S('hotels', 'isodp', 'Hotels', false, 'g-spons') },
      S('aus', 'cttl', 'Australia and Sydney'),
      S('office', 'dir', 'Office'),
      S('restructure', 'dir', 'Restructure', true),
    ],
  });
  ok(!grouped.nodes.some((n) => n.id === 'g-spons'), 'a group is not drawn as an empty dot');
  ok(grouped.nodes.length === 5, 'every section that holds work still is');
  ok(grouped.nodes.find((n) => n.id === 'organox').groupTitle === 'Sponsorship',
    'a section carries the group it sits in');
  ok(grouped.nodes.find((n) => n.id === 'aus').groupTitle === null,
    'and a section with no group says so');
}

// ── the one name the whole thing hangs off ─────────────────────────
ok(g.spine === null, 'no spine is claimed when the links are spread between people');
{
  const everywhere = { id: 'anthony', name: 'Anthony', role: 'Director' };
  const inAll = sections.map((sec, i) => ({ task_id: `sp${i}`, person_id: 'anthony' }));
  const spineTasks = sections.map((sec, i) => T(`sp${i}`, sec.id, sec.stream_id));
  const dense = buildGraph({
    tasks: [...tasks, ...spineTasks],
    sections, streams,
    people: [...people, everywhere],
    taskPeople: [...taskPeople, ...inAll],
    threads, threadLinks,
  });
  ok(dense.spine?.name === 'Anthony', 'the person in everything is named as the spine');
  ok(dense.spine.share > 0.4 && dense.spine.links <= dense.totals.links,
    `and how much of the web is them (${dense.spine.links} of ${dense.totals.links})`);
}

// ── staleness ──────────────────────────────────────────────────────
ok(node('organox').daysQuiet === 0, 'touched today reads as nought days quiet');
ok(node('hotels').daysQuiet === 30, 'untouched for a month reads as thirty');
ok(node('office').daysQuiet === null, 'no evidence either way stays null');
ok(quietness(null) === 0, 'a register with no history does not open looking abandoned');
ok(quietness(QUIET_FULL_DAYS * 2) === 1, 'quietness tops out rather than running away');

// ── the layouts ────────────────────────────────────────────────────
const inputs = g.nodes.map((n) => ({
  id: n.id, stream: n.stream, r: 16,
  quiet: quietness(n.daysQuiet), open: n.open,
}));
const simEdges = g.edges.map((e) => ({ a: e.a, b: e.b, weight: e.weight }));

const sim = new WebSim();
sim.sync(inputs, simEdges);
sim.resize(800, 600);
sim.settle(300);

const dist = (a, b) => Math.hypot(sim.get(a).x - sim.get(b).x, sim.get(a).y - sim.get(b).y);
const overlapping = () => {
  for (let i = 0; i < sim.nodes.length; i++) {
    for (let j = i + 1; j < sim.nodes.length; j++) {
      const a = sim.nodes[i], b = sim.nodes[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 1) return `${a.id}/${b.id}`;
    }
  }
  return null;
};

ok(overlapping() === null, `filed: no two dots sit on top of each other (${overlapping() ?? 'clear'})`);
ok(dist('organox', 'hotels') < dist('organox', 'office'),
  'filed: two ISODP sections land nearer each other than either does to the Directorate');
ok(sim.nodes.every((n) => n.x > 0 && n.x < 800 && n.y > 0 && n.y < 600), 'filed: everything stays on the stage');

sim.setLayout('web');
sim.settle(400);
ok(overlapping() === null, 'connected: still no overlaps');
ok(dist('aus', 'office') < dist('hotels', 'office') || dist('aus', 'organox') < dist('hotels', 'organox'),
  'connected: a shared person pulls two sections together');

sim.setLayout('pressure');
sim.settle(400);
ok(sim.get('hotels').x > sim.get('organox').x,
  'pressure: the section quiet for a month sits right of the one touched today');
ok(sim.get('aus').y < sim.get('office').y,
  'pressure: more open items sits higher');
ok(
  sim.nodes.every((n) => n.x >= PLOT.left * 800 - 1 && n.x <= PLOT.right * 800 + 1),
  'pressure: nothing strays into the axis margins',
);

// ── keeping out of the controls ────────────────────────────────────
sim.setLayout('filed');
sim.avoid = [{ x0: 650, y0: 548, x1: 800, y1: 600 }];
sim.settle(200);
ok(
  sim.nodes.every((n) => n.x + n.r < 650 || n.y + n.r < 548),
  'no dot ends up hidden under the zoom controls',
);

// ── pinning, reconciling, navigating ───────────────────────────────
const pinned = sim.get('aus');
pinned.pinned = true;
const where = { x: pinned.x, y: pinned.y };
sim.settle(120);
ok(pinned.x === where.x && pinned.y === where.y, 'a dot you parked stays where you put it');

const before = { x: sim.get('office').x, y: sim.get('office').y };
sim.sync(inputs.filter((n) => n.id !== 'hotels'), simEdges);
ok(sim.nodes.length === 4, 'a section that goes away leaves the map');
ok(sim.get('office').x === before.x, 'the others do not jump when it does');
ok(sim.edges.every((e) => e.a !== 'hotels' && e.b !== 'hotels'), 'its links go with it');

sim.sync(inputs, simEdges);
ok(sim.get('hotels') !== undefined && Number.isFinite(sim.get('hotels').x),
  'a new section arrives with a position, not at the origin');

const from = sim.get('aus');
const right = sim.nearest(from, 'right');
ok(right === null || right.x > from.x, 'arrow-right only ever moves right');

// ── view transform ─────────────────────────────────────────────────
const t = fitTransform(sim.nodes, 800, 600);
const projected = sim.nodes.map((n) => ({ x: n.x * t.k + t.tx, y: n.y * t.k + t.ty, r: n.r * t.k }));
ok(projected.every((p) => p.x - p.r >= -1 && p.x + p.r <= 801 && p.y - p.r >= -1 && p.y + p.r <= 601),
  'fit brings every dot inside the frame');
const back = toWorld(t, 400, 300);
ok(Math.abs(back.x * t.k + t.tx - 400) < 1e-9, 'screen and world coordinates round-trip');
ok(clampZoom(99) <= 4 && clampZoom(0.001) >= 0.45, 'zoom cannot run away in either direction');

// ── an empty register ──────────────────────────────────────────────
const empty = buildGraph({ tasks: [], sections: [], streams: [], people: [], taskPeople: [] });
ok(empty.nodes.length === 0 && empty.edges.length === 0 && empty.totals.isolated === 0,
  'an empty register produces an empty web rather than an error');
const noSim = new WebSim();
noSim.sync([], []);
noSim.resize(400, 300);
ok(noSim.step() === 0, 'stepping an empty simulation is harmless');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
