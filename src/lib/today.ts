/**
 * What Today shows: three groups, nothing else.
 *
 *   Overdue  — had a date, and it has passed
 *   Today    — dated today
 *   Urgent   — flagged urgent, and not already in one of the two above
 *
 * No ranking, scoring or quotas. If an item is here it is because of a date
 * you set or a flag you set, so the list can always explain itself, and the
 * way to change it is to change the item.
 */
import type { Task } from './types';

export interface TodayGroups {
  overdue: Task[];
  today: Task[];
  urgent: Task[];
  /** Open items across all three groups. */
  toDo: number;
  /** Ticked today, whatever they were. */
  doneToday: number;
}

/** A local calendar day as YYYY-MM-DD, the shape `due` is stored in. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param keep ids ticked in the last few seconds: they stay in their group,
 *   struck through, while the undo is on offer, rather than vanishing.
 */
export function todayGroups(
  tasks: Task[],
  now: Date = new Date(),
  keep: ReadonlySet<string> = new Set(),
): TodayGroups {
  const today = isoDay(now);
  const live = tasks.filter((t) => !t.deleted_at && (!t.done || keep.has(t.id)));

  // Dated before undated: a flagged item with a date is the more definite one.
  const byDue = (a: Task, b: Task) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.position - b.position;
  const byPlace = (a: Task, b: Task) =>
    a.stream_id.localeCompare(b.stream_id) || a.section_id.localeCompare(b.section_id) || a.position - b.position;

  const overdue = live.filter((t) => t.due && t.due < today).sort(byDue);
  const dueToday = live.filter((t) => t.due === today).sort(byPlace);
  const urgent = live.filter((t) => t.do_now && !(t.due && t.due <= today)).sort(byDue);

  const open = (list: Task[]) => list.filter((t) => !t.done).length;
  const doneToday = tasks.filter(
    (t) => t.done && !t.deleted_at && t.done_at && isoDay(new Date(t.done_at)) === today,
  ).length;

  return {
    overdue,
    today: dueToday,
    urgent,
    toDo: open(overdue) + open(dueToday) + open(urgent),
    doneToday,
  };
}
