/**
 * The brief.
 *
 * Everything in this app has been about getting work *in* and keeping it
 * straight. Nothing has ever come back out, and almost everything this job
 * produces is something for somebody else: a line for Anthony before a 1:1,
 * a paragraph for the monthly report, a note to a stream lead.
 *
 * So: pick a person or a stream, get text you can paste. What has moved,
 * what is stuck, what you need from them, and what has gone quiet.
 *
 * Composed locally from rows already in the database. No call, no key, works
 * on the Underground.
 */
import type { Person, Section, Stream, Task } from './types';
import { pathOf } from './tree';

export type Subject =
  | { kind: 'person'; id: string }
  | { kind: 'stream'; id: string };

export interface BriefLine {
  task: Task;
  /** The one thing worth knowing about this line. */
  note: string;
}

export interface BriefBlock {
  heading: string;
  /** Said when the block is empty, or left out entirely if this is null. */
  emptyAs: string | null;
  lines: BriefLine[];
}

export interface Brief {
  title: string;
  standfirst: string;
  blocks: BriefBlock[];
  /** Ready for the clipboard. */
  text: string;
  windowDays: number;
}

export interface BriefInput {
  subject: Subject;
  since: number;
  tasks: Task[];
  sections: Section[];
  streams: Stream[];
  people: Person[];
  taskPeople: { task_id: string; person_id: string }[];
}

/** Untouched for this long and it is worth saying so out loud. */
const QUIET_DAYS = 21;

const days = (iso: string | null) =>
  iso === null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

const startOfToday = () => new Date(new Date().toDateString());

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const ago = (n: number | null) =>
  n === null ? 'not touched since it was seeded'
    : n === 0 ? 'touched today'
      : n === 1 ? 'touched yesterday'
        : `${n} days untouched`;

export function buildBrief(input: BriefInput): Brief {
  const { subject, since, tasks, sections, streams, people, taskPeople } = input;
  const today = startOfToday();
  const cutoff = Date.now() - since * 86_400_000;

  const live = tasks.filter((t) => !t.deleted_at);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const peopleByTask = new Map<string, string[]>();
  for (const l of taskPeople) {
    const n = nameOf.get(l.person_id);
    if (!n) continue;
    const list = peopleByTask.get(l.task_id);
    if (list) list.push(n); else peopleByTask.set(l.task_id, [n]);
  }

  // ── whose work this is ──────────────────────────────────────────
  const person = subject.kind === 'person' ? people.find((p) => p.id === subject.id) ?? null : null;
  const stream = subject.kind === 'stream' ? streams.find((s) => s.id === subject.id) ?? null : null;

  const mine = subject.kind === 'person'
    ? live.filter((t) => taskPeople.some((l) => l.task_id === t.id && l.person_id === subject.id))
    : live.filter((t) => t.stream_id === subject.id);

  const open = mine.filter((t) => t.kind === 'task' && !t.done);
  const watch = mine.filter((t) => t.kind === 'watch');
  const moved = mine.filter(
    (t) => t.done && t.done_at !== null && new Date(t.done_at).getTime() >= cutoff,
  );

  const overdue = (t: Task) => t.due !== null && new Date(t.due) < today;
  const pressing = open
    .filter((t) => t.do_now || overdue(t))
    .sort((a, b) => Number(overdue(b)) - Number(overdue(a)) || (a.due ?? 'z').localeCompare(b.due ?? 'z'));

  const dated = open
    .filter((t) => t.due !== null && !overdue(t) && !pressing.includes(t))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));

  const stuck = open
    .filter((t) => !pressing.includes(t) && (days(t.touched_at) ?? 999) >= QUIET_DAYS)
    .sort((a, b) => (days(b.touched_at) ?? 999) - (days(a.touched_at) ?? 999));

  const unclear = open.filter((t) => t.unclear);

  const where = (t: Task) => pathOf(sections, t.section_id);
  const whoElse = (t: Task) => (peopleByTask.get(t.id) ?? []).filter((n) => n !== person?.name);

  const blocks: BriefBlock[] = [];

  if (subject.kind === 'person') {
    blocks.push({
      heading: `What I need from ${person?.name ?? 'them'}`,
      emptyAs: 'Nothing pressing.',
      lines: pressing.map((t) => ({
        task: t,
        note: overdue(t) ? `overdue — was ${fmt(t.due!)}` : t.due ? `due ${fmt(t.due)}` : 'flagged',
      })),
    });
    blocks.push({
      heading: 'Also open with them',
      emptyAs: null,
      lines: [...dated, ...open.filter((t) => !pressing.includes(t) && !dated.includes(t) && !stuck.includes(t))]
        .slice(0, 12)
        .map((t) => ({ task: t, note: t.due ? `due ${fmt(t.due)}` : where(t) })),
    });
    blocks.push({
      heading: 'Waiting longest',
      emptyAs: null,
      lines: stuck.slice(0, 6).map((t) => ({ task: t, note: ago(days(t.touched_at)) })),
    });
    blocks.push({
      heading: `Moved since we last spoke`,
      emptyAs: 'Nothing closed in this window.',
      lines: moved.slice(0, 10).map((t) => ({ task: t, note: where(t) })),
    });
  } else {
    blocks.push({
      heading: 'Pressing',
      emptyAs: 'Nothing overdue or flagged.',
      lines: pressing.slice(0, 10).map((t) => ({
        task: t,
        note: overdue(t) ? `overdue — was ${fmt(t.due!)}` : t.due ? `due ${fmt(t.due)}` : where(t),
      })),
    });
    blocks.push({
      heading: 'Moved recently',
      emptyAs: 'Nothing closed in this window.',
      lines: moved.slice(0, 12).map((t) => ({ task: t, note: where(t) })),
    });
    blocks.push({
      heading: 'Gone quiet',
      emptyAs: null,
      lines: stuck.slice(0, 8).map((t) => ({ task: t, note: `${where(t)} · ${ago(days(t.touched_at))}` })),
    });
    blocks.push({
      heading: 'Waiting on somebody else',
      emptyAs: null,
      lines: open
        .filter((t) => (peopleByTask.get(t.id) ?? []).length > 0 && !pressing.includes(t))
        .slice(0, 10)
        .map((t) => ({ task: t, note: `with ${(peopleByTask.get(t.id) ?? []).join(', ')}` })),
    });
    blocks.push({
      heading: 'Not clear yet',
      emptyAs: null,
      lines: unclear.slice(0, 6).map((t) => ({ task: t, note: where(t) })),
    });
  }

  // Empty blocks with nothing worth saying are dropped entirely.
  const kept = blocks.filter((b) => b.lines.length > 0 || b.emptyAs !== null);

  const title = subject.kind === 'person'
    ? `${person?.name ?? 'Someone'}${person?.role ? ` · ${person.role}` : ''}`
    : stream?.title ?? subject.id;

  const spread = subject.kind === 'person'
    ? [...new Set(mine.map((t) => t.stream_id))]
      .map((id) => streams.find((s) => s.id === id)?.short ?? id)
    : [];

  const closed = moved.length
    ? ` ${moved.length} closed in the last ${since} days.`
    : '';
  const standfirst = subject.kind === 'person'
    ? `${open.length} open ${open.length === 1 ? 'item' : 'items'}`
      + `${spread.length ? ` across ${list(spread)}` : ''}.${closed}`
    : `${open.length} open, ${watch.length} being kept an eye on.${closed}`;

  return {
    title,
    standfirst,
    blocks: kept,
    windowDays: since,
    text: asText(title, standfirst, kept, subject, whoElse),
  };
}

/** "a, b and c" — a sentence, not a CSV. */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The paste-ready version. Plain text: it has to survive Teams and Outlook. */
function asText(
  title: string,
  standfirst: string,
  blocks: BriefBlock[],
  subject: Subject,
  whoElse: (t: Task) => string[],
): string {
  const out: string[] = [title, standfirst, ''];

  for (const block of blocks) {
    if (block.lines.length === 0) {
      if (!block.emptyAs) continue;
      out.push(`${block.heading.toUpperCase()}`, `  ${block.emptyAs}`, '');
      continue;
    }
    out.push(`${block.heading.toUpperCase()}`);
    for (const { task, note } of block.lines) {
      const others = subject.kind === 'person' ? whoElse(task) : [];
      const tail = others.length ? ` (also ${others.join(', ')})` : '';
      out.push(`  · ${task.title} — ${note}${tail}`);
    }
    out.push('');
  }

  out.push(`Prepared ${new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })}.`);

  return out.join('\n');
}
