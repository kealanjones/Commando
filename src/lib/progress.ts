/**
 * The day's progress: what got done today, and nothing older. It resets
 * each morning, so it can only ever say "look what you did", never
 * "you did less than last Tuesday".
 */
import { isoDay } from './today';
import type { Task } from './types';

/** Everything ticked today, in the order it was ticked. Cleared ones count. */
export function doneToday(tasks: Task[], now: Date = new Date()): Task[] {
  const today = isoDay(now);
  return tasks
    .filter((t) => t.done && !t.deleted_at && t.done_at && isoDay(new Date(t.done_at)) === today)
    .sort((a, b) => a.done_at!.localeCompare(b.done_at!));
}

/** Tally gates: four strokes and a fifth across. 13 → [5, 5, 3]. */
export function tallyGroups(n: number): number[] {
  const out: number[] = [];
  for (let left = n; left > 0; left -= 5) out.push(Math.min(5, left));
  return out;
}

/** Milestones in a day, each with the stamp it earns. */
export const STAMPS: { at: number; text: string }[] = [
  { at: 5, text: 'Good start' },
  { at: 10, text: 'On a roll' },
  { at: 15, text: 'Cracking day' },
  { at: 20, text: 'Unstoppable' },
  { at: 30, text: 'Legendary' },
];

/**
 * The stamp a single tick has just earned, if any. Only a step of one
 * counts: switching which life is showing, or the day's data arriving,
 * moves the count by more than that and should not set off a stamp.
 * `already` is the highest milestone stamped today, so undo and redo
 * does not stamp twice.
 */
export function stampFor(prev: number, next: number, already: number) {
  if (next !== prev + 1) return null;
  return STAMPS.find((s) => s.at === next && s.at > already) ?? null;
}

/** The sign-off at the foot of the receipt. */
export function verdict(n: number): string {
  if (n === 0) return 'Nothing yet. The day is young.';
  if (n < 3) return 'A start is a start.';
  if (n < 5) return 'Quietly getting on with it.';
  if (n < 10) return 'A good, honest day.';
  if (n < 15) return 'Properly productive.';
  if (n < 20) return 'That is a cracking day.';
  return 'Go home. You have earned it.';
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export interface ReceiptLine { id: string; time: string; title: string; code: string; late: boolean }

export interface Receipt {
  lines: ReceiptLine[];
  total: number;
  /** Ticked off after its due date had passed. */
  overdue: number;
  first: string | null;
  /** The hour with the most ticks, as "10:00". */
  busiest: string | null;
  verdict: string;
}

export function receipt(done: Task[], codeOf: (streamId: Task['stream_id']) => string): Receipt {
  const lines = done.map((t) => ({
    id: t.id,
    time: hhmm(t.done_at!),
    title: t.title,
    code: codeOf(t.stream_id),
    late: Boolean(t.due && t.due < isoDay(new Date(t.done_at!))),
  }));
  const byHour = new Map<string, number>();
  for (const l of lines) {
    const h = `${l.time.slice(0, 2)}:00`;
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  let busiest: string | null = null;
  for (const [h, n] of byHour) if (n > 1 && (!busiest || n > byHour.get(busiest)!)) busiest = h;

  return {
    lines,
    total: lines.length,
    overdue: lines.filter((l) => l.late).length,
    first: lines[0]?.time ?? null,
    busiest,
    verdict: verdict(lines.length),
  };
}

/** The receipt as plain text, for pasting into a message or a note. */
export function receiptText(r: Receipt, now: Date = new Date()): string {
  const day = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  return [
    `Done today · ${day}`,
    '',
    ...r.lines.map((l) => `${l.time}  ${l.title}${l.code ? ` (${l.code})` : ''}`),
    '',
    `Total done: ${r.total}`,
    ...(r.overdue ? [`Overdue, now done: ${r.overdue}`] : []),
    r.verdict,
  ].join('\n');
}
