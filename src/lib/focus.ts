/**
 * One by one: the pile, chosen as narrowly or as broadly as you like, in
 * the order you want to meet it.
 *
 * Pure, so the choosing can be tested without a browser. The screen lives
 * in routes/Focus.tsx.
 */
import type { Section, Task } from './types';

/** Which items, before where they live is considered. */
export type FocusWhich = 'all' | 'now' | 'overdue' | 'week' | 'undated';
export type FocusOrder = 'now' | 'due' | 'oldest';

export interface FocusScope {
  which: FocusWhich;
  /** A project id, or null for every project in the life showing. */
  stream: string | null;
  /**
   * A sub-focus id, or null for the whole project. A group counts as its
   * own items plus everything in the sub-focuses under it.
   */
  section: string | null;
  order: FocusOrder;
}

export const WHICH: { id: FocusWhich; label: string }[] = [
  { id: 'all', label: 'Everything open' },
  { id: 'now', label: 'Do now' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'week', label: 'Due this week' },
  { id: 'undated', label: 'No date' },
];

export const ORDER: { id: FocusOrder; label: string }[] = [
  { id: 'now', label: 'Do now first' },
  { id: 'due', label: 'By due date' },
  { id: 'oldest', label: 'Oldest first' },
];

const isWhich = (v: string | null): v is FocusWhich => WHICH.some((w) => w.id === v);
const isOrder = (v: string | null): v is FocusOrder => ORDER.some((o) => o.id === v);

/** Read a scope from the address, so any page can open the mode pre-set. */
export function scopeFrom(params: URLSearchParams): FocusScope {
  const which = params.get('which');
  const order = params.get('order');
  return {
    which: isWhich(which) ? which : 'all',
    stream: params.get('project') || null,
    section: params.get('focus') || null,
    order: isOrder(order) ? order : 'now',
  };
}

export function scopeParams(s: FocusScope): string {
  const p = new URLSearchParams();
  if (s.which !== 'all') p.set('which', s.which);
  if (s.stream) p.set('project', s.stream);
  if (s.section) p.set('focus', s.section);
  if (s.order !== 'now') p.set('order', s.order);
  const q = p.toString();
  return q ? `?${q}` : '';
}

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
};

function matches(t: Task, which: FocusWhich, today: string): boolean {
  switch (which) {
    case 'all': return true;
    case 'now': return t.do_now;
    case 'overdue': return Boolean(t.due && t.due < today);
    case 'week': return Boolean(t.due && t.due <= addDays(today, 7));
    case 'undated': return !t.due;
  }
}

/** The sub-focus ids a chosen one stands for: itself, and its children if a group. */
export function sectionsUnder(id: string, sections: Section[]): Set<string> {
  return new Set([id, ...sections.filter((s) => s.parent_id === id).map((s) => s.id)]);
}

/**
 * The open items in scope, in order. Done, cleared and deleted items never
 * come up: the mode is for what is still to do.
 */
export function pile(tasks: Task[], sections: Section[], scope: FocusScope, today: string): Task[] {
  const under = scope.section ? sectionsUnder(scope.section, sections) : null;
  const picked = tasks.filter((t) =>
    !t.done && !t.deleted_at
    && (!scope.stream || t.stream_id === scope.stream)
    && (!under || under.has(t.section_id))
    && matches(t, scope.which, today));

  const byDue = (a: Task, b: Task) => (a.due ?? '9999').localeCompare(b.due ?? '9999');
  const byAge = (a: Task, b: Task) => a.created_at.localeCompare(b.created_at);
  const sorted = [...picked];
  if (scope.order === 'now') sorted.sort((a, b) => Number(b.do_now) - Number(a.do_now) || byDue(a, b) || a.position - b.position);
  if (scope.order === 'due') sorted.sort((a, b) => byDue(a, b) || Number(b.do_now) - Number(a.do_now) || a.position - b.position);
  if (scope.order === 'oldest') sorted.sort((a, b) => byAge(a, b) || a.position - b.position);
  return sorted;
}

/** How the due date reads on the card, and whether it is late. */
export function dueLine(due: string | null, today: string): { text: string; late: boolean } {
  if (!due) return { text: 'No date', late: false };
  const days = Math.round((new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
  if (days < 0) return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, late: true };
  if (days === 0) return { text: 'Today', late: false };
  if (days === 1) return { text: 'Tomorrow', late: false };
  const d = new Date(`${due}T00:00:00`);
  return {
    text: d.toLocaleDateString('en-GB', days < 7 ? { weekday: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' }),
    late: false,
  };
}

/** A running clock: 4:07, or 1:02:09 past the hour. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Minutes, said plainly, for the end of a run. */
export function minutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (ms > 0 && m === 0) return 'under a minute';
  return `${m} minute${m === 1 ? '' : 's'}`;
}
