/**
 * The till roll: what a receipt says, worked out from its lines.
 *
 * Pure. The lines come from the database (data/receipt.ts) or, before
 * migration 0013 has run, from the items themselves.
 */
import { isoDay } from './today';
import { verdict } from './progress';
import type { ReceiptLine, Task } from './types';

export type { ReceiptLine };

export const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** A line on the printed receipt, ready to show. */
export interface PrintedLine {
  id: string;
  time: string;
  title: string;
  code: string;
  kind: ReceiptLine['kind'];
  minutes: number | null;
}

export interface Receipt {
  day: string;
  lines: PrintedLine[];
  /** Done lines, less those returned the same day. */
  total: number;
  returned: number;
  voided: number;
  /** Minutes stayed with things, if any were. */
  minutes: number;
  /** Done lines per project code, most first. */
  subtotals: { code: string; n: number }[];
  first: string | null;
  last: string | null;
  /** The hour with the most ticks, as "10:00". */
  busiest: string | null;
  verdict: string;
}


/** The lines that count: on this day, in order, and not undone. */
export function linesFor(lines: ReceiptLine[], day: string): ReceiptLine[] {
  return lines
    .filter((l) => l.day === day && !l.undone_at)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function buildReceipt(lines: ReceiptLine[], day: string): Receipt {
  const today = linesFor(lines, day);
  const printed = today.map<PrintedLine>((l) => ({
    id: l.id, time: hhmm(l.at), title: l.title, code: l.code, kind: l.kind, minutes: l.minutes,
  }));
  const done = today.filter((l) => l.kind === 'done');
  const returned = today.filter((l) => l.kind === 'returned');
  const voided = today.filter((l) => l.kind === 'void');

  const byCode = new Map<string, number>();
  for (const l of done) if (l.code) byCode.set(l.code, (byCode.get(l.code) ?? 0) + 1);
  const subtotals = [...byCode].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n || a.code.localeCompare(b.code));

  const byHour = new Map<string, number>();
  for (const l of done) {
    const h = `${hhmm(l.at).slice(0, 2)}:00`;
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  let busiest: string | null = null;
  for (const [h, n] of byHour) if (n > 1 && (!busiest || n > byHour.get(busiest)!)) busiest = h;

  const total = Math.max(0, done.length - returned.length);
  return {
    day,
    lines: printed,
    total,
    returned: returned.length,
    voided: voided.length,
    minutes: done.reduce((m, l) => m + (l.minutes ?? 0), 0),
    subtotals,
    first: done[0] ? hhmm(done[0].at) : null,
    last: done.length ? hhmm(done[done.length - 1].at) : null,
    busiest,
    verdict: verdict(total),
  };
}

/**
 * Lines made from the items themselves, for a database that has not run
 * 0013 yet, and for fixture mode. Done items only: nothing else leaves a
 * trace on an item.
 */
export function linesFromTasks(tasks: Task[], codeOf: (streamId: Task['stream_id']) => string): ReceiptLine[] {
  return tasks
    .filter((t) => t.done && t.done_at)
    .map((t) => ({
      id: `task:${t.id}`, task_id: t.id, kind: 'done' as const, title: t.title, code: codeOf(t.stream_id),
      stream_id: t.stream_id, minutes: null, at: t.done_at!, day: isoDay(new Date(t.done_at!)), undone_at: null,
    }));
}

/** The days that have a receipt, newest first. */
export function receiptDays(lines: ReceiptLine[]): string[] {
  return [...new Set(lines.filter((l) => !l.undone_at).map((l) => l.day))].sort().reverse();
}

/** The day before or after `day` that has a receipt; today always counts. */
export function stepDay(days: string[], day: string, dir: -1 | 1, today: string): string | null {
  const all = [...new Set([...days, today])].sort();
  const i = all.indexOf(day);
  if (i < 0) return dir < 0 ? all.filter((d) => d < day).at(-1) ?? null : all.find((d) => d > day) ?? null;
  return all[i + dir] ?? null;
}

export function dayLabel(day: string, today: string): string {
  const d = new Date(`${day}T00:00:00`);
  const gap = Math.round((new Date(`${today}T00:00:00`).getTime() - d.getTime()) / 86_400_000);
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  if (gap === 0) return `Today · ${date}`;
  if (gap === 1) return `Yesterday · ${date}`;
  return date;
}

/** The receipt as plain text, for pasting into a message or a note. */
export function receiptText(r: Receipt, today: string): string {
  const head = dayLabel(r.day, today);
  return [
    `Check-out · ${head}`,
    '',
    ...r.lines.map((l) =>
      l.kind === 'done'
        ? `${l.time}  ${l.title}${l.code ? ` (${l.code})` : ''}${l.minutes ? `  ${l.minutes} min` : ''}`
        : `${l.time}  ${l.kind === 'void' ? 'VOID' : 'RETURNED'}  ${l.title}`),
    '',
    `Total done: ${r.total}`,
    ...(r.minutes ? [`Time with things: ${r.minutes} min`] : []),
    ...r.subtotals.map((s) => `  ${s.code}: ${s.n}`),
    r.verdict,
  ].join('\n');
}

// ── Code 39 ──────────────────────────────────────────────────────────
// A real, scannable barcode of the date. Each character is nine bars and
// spaces, three of them wide. The asterisk brackets the message.

const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  '-': 'nnnnwnwnw', ' ': 'nwnnwnwnn', '*': 'nwnnwnwnn', '.': 'wwnnwnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
  G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww',
  M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
  S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
};

/**
 * The bars of `text` in Code 39, as [x, width] pairs in narrow units,
 * with a narrow space between characters. Unknown characters are skipped.
 */
export function code39(text: string, wide = 3): { x: number; w: number }[] {
  const chars = `*${text.toUpperCase()}*`;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const c of chars) {
    const pattern = CODE39[c];
    if (!pattern) continue;
    for (let i = 0; i < 9; i++) {
      const w = pattern[i] === 'w' ? wide : 1;
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
    x += 1;
  }
  return bars;
}

/** Total width of a Code 39 rendering, in narrow units. */
export const code39Width = (text: string, wide = 3) => {
  const bars = code39(text, wide);
  const last = bars.at(-1);
  return last ? last.x + last.w : 0;
};
