/**
 * The plan.
 *
 * A register with no dates cannot be prioritised — everything is equally
 * urgent, which is to say nothing is. This is the surface for fixing that in
 * one sitting: every undated item in a queue, a month in front of you, and
 * the load on each day shown as colour so you can see yourself over-filling
 * a Tuesday before you have done it.
 *
 * All of it computed. Nothing here is stored beyond the due dates you set.
 */
import type { Task } from './types';

/** How loaded a day is, in bands. Six is enough to read; more is decoration. */
export type Load = 0 | 1 | 2 | 3 | 4 | 5;

export interface Day {
  /** yyyy-mm-dd. */
  iso: string;
  date: Date;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  /** Open items due on this day. */
  count: number;
  /** Of those, how many are flagged. */
  pressing: number;
  load: Load;
}

export interface Week { days: Day[] }

export interface QuickTarget {
  key: string;
  /** "Today", "Tomorrow", "Friday", "Next week". */
  label: string;
  iso: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * Where the bands sit.
 *
 * Deliberately tight at the bottom: the difference between one thing and
 * three things on a Tuesday is the difference that matters, and a scale that
 * only turns red at fifteen would never say anything about a real week.
 */
const BANDS = [1, 2, 3, 5, 7];

export function loadOf(count: number): Load {
  if (count === 0) return 0;
  for (let i = 0; i < BANDS.length; i++) if (count <= BANDS[i]) return (i + 1) as Load;
  return 5;
}

/** Open, actionable items only — a finished task is not load. */
export const isLoad = (t: Task) =>
  t.kind === 'task' && !t.done && !t.deleted_at && t.due !== null;

/** How many open items land on each day. */
export function loadByDay(tasks: Task[]): Map<string, { count: number; pressing: number }> {
  const m = new Map<string, { count: number; pressing: number }>();
  for (const t of tasks) {
    if (!isLoad(t)) continue;
    const at = m.get(t.due!) ?? { count: 0, pressing: 0 };
    at.count += 1;
    if (t.do_now) at.pressing += 1;
    m.set(t.due!, at);
  }
  return m;
}

/**
 * A month as whole weeks, Monday first, padded out of the neighbouring
 * months so the grid is always rectangular.
 */
export function monthGrid(year: number, month: number, tasks: Task[], today = startOfDay()): Week[] {
  const load = loadByDay(tasks);
  const first = new Date(year, month, 1);
  // getDay() is Sunday-first; this register is British and reads Monday-first.
  const lead = (first.getDay() + 6) % 7;
  const start = addDays(first, -lead);

  const weeks: Week[] = [];
  for (let w = 0; w < 6; w++) {
    const days: Day[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const iso = isoOf(date);
      const at = load.get(iso) ?? { count: 0, pressing: 0 };
      days.push({
        iso,
        date,
        dayOfMonth: date.getDate(),
        inMonth: date.getMonth() === month,
        isToday: iso === isoOf(today),
        isPast: date < today,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        count: at.count,
        pressing: at.pressing,
        load: loadOf(at.count),
      });
    }
    weeks.push({ days });
    // A month never needs a sixth week that belongs entirely to the next one.
    const last = days[6];
    if (w >= 4 && !days.some((x) => x.inMonth) && last.date.getMonth() !== month) {
      weeks.pop();
      break;
    }
  }
  return weeks;
}

/**
 * The days you actually reach for.
 *
 * Today, tomorrow, then the rest of this working week by name, then the two
 * obvious jumps. Named days beat "+3 days": you think in Fridays.
 */
export function quickTargets(today = startOfDay()): QuickTarget[] {
  const out: QuickTarget[] = [
    { key: 'today', label: 'Today', iso: isoOf(today) },
    { key: 'tomorrow', label: 'Tomorrow', iso: isoOf(addDays(today, 1)) },
  ];

  // The named weekdays left in this week, skipping the two already covered.
  for (let n = 2; n <= 6; n++) {
    const d = addDays(today, n);
    if (d.getDay() === 0 || d.getDay() === 6) continue;      // nobody plans a Sunday
    if ((d.getDay() + 6) % 7 < (today.getDay() + 6) % 7) break;  // into next week
    out.push({
      key: `d${n}`,
      label: d.toLocaleDateString('en-GB', { weekday: 'long' }),
      iso: isoOf(d),
    });
  }

  const nextMonday = addDays(today, ((8 - today.getDay()) % 7) || 7);
  out.push({ key: 'next-week', label: 'Next week', iso: isoOf(nextMonday) });
  out.push({ key: 'next-month', label: 'Next month', iso: isoOf(addDays(today, 28)) });

  // Two chips can land on the same day at the end of a week; keep the named one.
  const seen = new Set<string>();
  return out.filter((t) => (seen.has(t.iso) ? false : (seen.add(t.iso), true)));
}

export interface WeekShape {
  iso: string;
  label: string;
  count: number;
  load: Load;
}

/** The coming seven days, for the strip that says what this week looks like. */
export function weekAhead(tasks: Task[], today = startOfDay()): WeekShape[] {
  const load = loadByDay(tasks);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const iso = isoOf(d);
    const count = load.get(iso)?.count ?? 0;
    return {
      iso,
      label: i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' }),
      count,
      load: loadOf(count),
    };
  });
}

/**
 * What still needs a date: open, actionable, undated, and not parked.
 *
 * Ordered so the ones with the most behind them come first — dating the item
 * that eleven others are queued behind is worth more than dating a one-off.
 */
export function undated(tasks: Task[]): Task[] {
  const live = tasks.filter((t) => t.kind === 'task' && !t.done && !t.deleted_at);
  const perSection = new Map<string, number>();
  for (const t of live) perSection.set(t.section_id, (perSection.get(t.section_id) ?? 0) + 1);

  return live
    .filter((t) => t.due === null && !t.unclear)
    .sort((a, b) =>
      Number(b.do_now) - Number(a.do_now)
      || (perSection.get(b.section_id) ?? 0) - (perSection.get(a.section_id) ?? 0)
      || a.title.localeCompare(b.title));
}

export const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

export const monthName = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
