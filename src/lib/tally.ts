/**
 * The tally: what got finished today, and across the week.
 *
 * Counts ticks by `done_at`, in local time, over the Monday-to-Sunday week
 * that holds today — the same week the plan draws. Nothing is inferred:
 * an item counts for the day it was ticked on, and a seeded row that was
 * already done when it arrived has no `done_at`, so it never counts as a
 * day's work it was not.
 */
import { isoOf, startOfDay } from './plan';
import type { Task } from './types';

export interface DayTally {
  iso: string;
  /** One letter, for under the column. */
  letter: string;
  /** In full, for the caption and the screen reader. */
  name: string;
  items: Task[];
  isToday: boolean;
  isFuture: boolean;
}

export interface Tally {
  today: Task[];
  /** Monday to Sunday, always seven. */
  days: DayTally[];
  weekTotal: number;
  lastWeekTotal: number;
  /** The fullest day so far this week, if any day has more than one. */
  best: DayTally | null;
}

/**
 * The ring is drawn in slots, so the first tick of the day is a visible
 * wedge rather than a full circle: one thing done is one eighth, not
 * everything. Past eight the slots divide further and the number carries
 * the growth.
 */
export const RING_SLOTS = 8;

const DAY = 86_400_000;
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The Monday on or before the day given. */
export function mondayOf(d: Date): Date {
  const day = startOfDay(d);
  const back = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - back);
}

const doneOn = (t: Task) => (t.kind === 'task' && t.done && t.done_at && !t.deleted_at
  ? isoOf(new Date(t.done_at))
  : null);

export function tally(tasks: Task[], now = new Date()): Tally {
  const today = isoOf(now);
  const monday = mondayOf(now);

  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    const iso = doneOn(t);
    if (!iso) continue;
    byDay.set(iso, [...(byDay.get(iso) ?? []), t]);
  }
  // Earliest tick first, so a ring drawn from this list grows clockwise in
  // the order the day happened.
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.done_at ?? '').localeCompare(b.done_at ?? ''));
  }

  const days: DayTally[] = NAMES.map((name, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const iso = isoOf(d);
    return {
      iso,
      letter: name[0],
      name,
      items: byDay.get(iso) ?? [],
      isToday: iso === today,
      isFuture: iso > today,
    };
  });

  let lastWeekTotal = 0;
  for (let i = 1; i <= 7; i++) {
    lastWeekTotal += byDay.get(isoOf(new Date(monday.getTime() - i * DAY)))?.length ?? 0;
  }

  const weekTotal = days.reduce((n, d) => n + d.items.length, 0);
  const best = days.reduce<DayTally | null>(
    (b, d) => (d.items.length > 1 && d.items.length > (b?.items.length ?? 0) ? d : b),
    null,
  );

  return { today: byDay.get(today) ?? [], days, weekTotal, lastWeekTotal, best };
}

/** How the week compares, in words — or nothing, if there is nothing to compare with. */
export function compareWeeks(thisWeek: number, lastWeek: number): string {
  if (lastWeek === 0) return '';
  const diff = thisWeek - lastWeek;
  if (diff === 0) return 'level with last week';
  if (diff > 0) return `${diff} more than last week`;
  return `${-diff} fewer than last week`;
}

/**
 * Where each segment of the ring sits, as a fraction of the circumference:
 * a start and a length, with a gap kept between neighbours.
 */
export function ringSegments(count: number, gap = 0.02): { start: number; length: number }[] {
  const slots = Math.max(RING_SLOTS, count);
  const slot = 1 / slots;
  return Array.from({ length: count }, (_, i) => ({
    start: i * slot,
    length: Math.max(0.004, slot - gap),
  }));
}
