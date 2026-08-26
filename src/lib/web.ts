/**
 * The register as a shape.
 *
 * Two questions the list cannot answer: what is actually connected to what,
 * and which of it has gone quiet while you were looking elsewhere. Both are
 * computed here, from rows the app already has — nothing new is stored.
 *
 * A node is a section. A section, not a task: 255 dots is a hairball, and
 * you do not think in tasks anyway, you think in "the Australia business".
 *
 * An edge is a reason two sections move together:
 *   people  — the same person is named in both. Observed, not asserted.
 *   threads — you put them in the same thread. Asserted, so it counts double.
 */
import type { Person, Section, Stream, StreamId, Task, Thread } from './types';

/** Past this many days of silence a section is drawn as fully faded. */
export const QUIET_FULL_DAYS = 21;

export interface WebNode {
  id: string;
  title: string;
  /** The group it sits in, when it sits in one. */
  groupTitle: string | null;
  stream: StreamId;
  monitor: boolean;
  /** Open, actionable items — the size of the dot. */
  open: number;
  done: number;
  watch: number;
  /** open + watch: everything still live in this section. */
  total: number;
  /** Open items with a do-now flag or a date already gone. */
  pressing: number;
  /** 0–1, how much of the section's work is finished. */
  progress: number;
  /** Days since anything here was touched. null = no evidence either way. */
  daysQuiet: number | null;
  lastTouchedAt: string | null;
  people: string[];
  threads: string[];
  taskIds: string[];
}

export interface WebEdge {
  a: string;
  b: string;
  people: string[];
  threads: string[];
  /** Threads count double: you asserted those, the names were only observed. */
  weight: number;
  /** True when the two ends are filed in different streams. */
  crossing: boolean;
}

export interface Connector {
  id: string;
  name: string;
  role: string | null;
  sections: string[];
  streams: StreamId[];
  items: number;
}

export interface ThreadReach {
  id: string;
  title: string;
  sections: string[];
  streams: StreamId[];
  items: number;
}

export interface WebGraph {
  nodes: WebNode[];
  edges: WebEdge[];
  /** People in more than one section — the only ones that hold anything together. */
  connectors: Connector[];
  /** People named in exactly one section. Counted, not listed. */
  soloPeople: number;
  threads: ThreadReach[];
  /**
   * The one person the web hangs off, when there is one. If a single name
   * accounts for most of the links, that is the most useful thing this
   * whole drawing has to say.
   */
  spine: { id: string; name: string; links: number; share: number } | null;
  totals: { sections: number; open: number; watch: number; links: number; isolated: number };
}

export interface GraphInput {
  tasks: Task[];
  sections: Section[];
  streams: Stream[];
  people: Person[];
  taskPeople: { task_id: string; person_id: string }[];
  threads?: Thread[];
  threadLinks?: { task_id: string; thread_id: string }[];
}

const daysSince = (iso: string | null): number | null =>
  iso === null ? null : Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

const startOfToday = () => new Date(new Date().toDateString());

export function buildGraph(input: GraphInput): WebGraph {
  const { tasks, taskPeople, people } = input;
  // A group is a heading over other sections and holds no items of its own,
  // so it must not become an empty dot on the map.
  const parents = new Set(
    input.sections.map((s) => s.parent_id).filter((v): v is string => Boolean(v)),
  );
  const sections = input.sections.filter((s) => !parents.has(s.id));
  const threads = input.threads ?? [];
  const threadLinks = input.threadLinks ?? [];

  // Only live rows. A done task's people are history, not a live connection —
  // this is the same reading the Waiting-on page takes.
  const live = tasks.filter((t) => !t.deleted_at);
  const bySection = new Map<string, Task[]>();
  for (const t of live) {
    const list = bySection.get(t.section_id);
    if (list) list.push(t); else bySection.set(t.section_id, [t]);
  }

  const peopleByTask = new Map<string, string[]>();
  for (const l of taskPeople) {
    const list = peopleByTask.get(l.task_id);
    if (list) list.push(l.person_id); else peopleByTask.set(l.task_id, [l.person_id]);
  }
  const threadsByTask = new Map<string, string[]>();
  for (const l of threadLinks) {
    const list = threadsByTask.get(l.task_id);
    if (list) list.push(l.thread_id); else threadsByTask.set(l.task_id, [l.thread_id]);
  }

  const today = startOfToday();

  const nodes: WebNode[] = sections.map((s) => {
    const mine = bySection.get(s.id) ?? [];
    const openTasks = mine.filter((t) => t.kind === 'task' && !t.done);
    const doneTasks = mine.filter((t) => t.kind === 'task' && t.done);
    const watch = mine.filter((t) => t.kind === 'watch');
    const unfinished = mine.filter((t) => !t.done);

    const names = new Set<string>();
    const strands = new Set<string>();
    for (const t of unfinished) {
      for (const p of peopleByTask.get(t.id) ?? []) names.add(p);
      for (const th of threadsByTask.get(t.id) ?? []) strands.add(th);
    }

    const touched = mine
      .map((t) => t.touched_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;

    const graded = doneTasks.length + openTasks.length;

    return {
      id: s.id,
      title: s.title,
      groupTitle: s.parent_id
        ? input.sections.find((g) => g.id === s.parent_id)?.title ?? null
        : null,
      stream: s.stream_id,
      monitor: s.monitor,
      open: openTasks.length,
      done: doneTasks.length,
      watch: watch.length,
      total: openTasks.length + watch.length,
      pressing: openTasks.filter((t) => t.do_now || (t.due !== null && new Date(t.due) < today)).length,
      progress: graded === 0 ? 0 : doneTasks.length / graded,
      daysQuiet: daysSince(touched),
      lastTouchedAt: touched,
      people: [...names],
      threads: [...strands],
      taskIds: unfinished.map((t) => t.id),
    };
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));

  // ── edges ───────────────────────────────────────────────────────
  const sectionsOf = (key: 'people' | 'threads') => {
    const m = new Map<string, Set<string>>();
    for (const n of nodes) {
      for (const v of n[key]) {
        const set = m.get(v);
        if (set) set.add(n.id); else m.set(v, new Set([n.id]));
      }
    }
    return m;
  };

  const peopleSections = sectionsOf('people');
  const threadSections = sectionsOf('threads');

  const edges = new Map<string, WebEdge>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const addPairs = (map: Map<string, Set<string>>, field: 'people' | 'threads') => {
    for (const [value, set] of map) {
      const list = [...set];
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const key = pairKey(list[i], list[j]);
          let e = edges.get(key);
          if (!e) {
            const [a, b] = key.split('|');
            e = {
              a, b, people: [], threads: [], weight: 0,
              crossing: byId.get(a)!.stream !== byId.get(b)!.stream,
            };
            edges.set(key, e);
          }
          e[field].push(value);
        }
      }
    }
  };

  addPairs(peopleSections, 'people');
  addPairs(threadSections, 'threads');
  for (const e of edges.values()) e.weight = e.people.length + e.threads.length * 2;

  // ── who and what holds it together ──────────────────────────────
  const itemsPerPerson = new Map<string, number>();
  for (const t of live) {
    if (t.done) continue;
    for (const p of peopleByTask.get(t.id) ?? []) {
      itemsPerPerson.set(p, (itemsPerPerson.get(p) ?? 0) + 1);
    }
  }

  const connectors: Connector[] = people
    .map((p) => {
      const secs = [...(peopleSections.get(p.id) ?? [])];
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        sections: secs,
        streams: [...new Set(secs.map((id) => byId.get(id)!.stream))],
        items: itemsPerPerson.get(p.id) ?? 0,
      };
    })
    .filter((c) => c.sections.length > 0)
    .sort((a, b) => b.sections.length - a.sections.length || b.items - a.items);

  const itemsPerThread = new Map<string, number>();
  for (const l of threadLinks) {
    const t = live.find((x) => x.id === l.task_id);
    if (t && !t.done) itemsPerThread.set(l.thread_id, (itemsPerThread.get(l.thread_id) ?? 0) + 1);
  }

  const reach: ThreadReach[] = threads
    .map((t) => {
      const secs = [...(threadSections.get(t.id) ?? [])];
      return {
        id: t.id,
        title: t.title,
        sections: secs,
        streams: [...new Set(secs.map((id) => byId.get(id)!.stream))],
        items: itemsPerThread.get(t.id) ?? 0,
      };
    })
    .filter((t) => t.sections.length > 0)
    .sort((a, b) => b.sections.length - a.sections.length);

  const linked = new Set<string>();
  for (const e of edges.values()) { linked.add(e.a); linked.add(e.b); }

  const linksPerPerson = new Map<string, number>();
  for (const e of edges.values()) {
    for (const p of e.people) linksPerPerson.set(p, (linksPerPerson.get(p) ?? 0) + 1);
  }
  const [topId, topLinks] = [...linksPerPerson.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const share = edges.size ? topLinks / edges.size : 0;
  const spine = topId && share >= 0.4
    ? {
        id: topId,
        name: people.find((p) => p.id === topId)?.name ?? 'One person',
        links: topLinks,
        share,
      }
    : null;

  return {
    nodes,
    edges: [...edges.values()].sort((x, y) => y.weight - x.weight),
    connectors: connectors.filter((c) => c.sections.length > 1),
    soloPeople: connectors.filter((c) => c.sections.length === 1).length,
    threads: reach,
    spine,
    totals: {
      sections: nodes.length,
      open: nodes.reduce((a, n) => a + n.open, 0),
      watch: nodes.reduce((a, n) => a + n.watch, 0),
      links: edges.size,
      isolated: nodes.filter((n) => !linked.has(n.id)).length,
    },
  };
}

/**
 * 0 = touched today, 1 = silent for three weeks or more.
 *
 * No evidence either way reads as 0: a register that has never been touched
 * should not open looking like one that has been abandoned.
 */
export function quietness(daysQuiet: number | null): number {
  if (daysQuiet === null) return 0;
  return Math.min(1, daysQuiet / QUIET_FULL_DAYS);
}
