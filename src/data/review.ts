/**
 * The decision surface.
 *
 * One mechanism, three entry points. The register only ever grew — intake
 * adds after every meeting, nothing removed anything — and a fifth of the
 * tasks began with a verb that cannot be finished. This is what makes the
 * list go down.
 *
 *   weekly  — stale, unfinishable, urgent-but-undated
 *   unclear — things you parked because you did not know what they meant
 *   person  — what someone owes you, for the ten minutes before a 1:1
 */
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DEMO } from '@/lib/demo';
import { useTasks, useUpdateTask, useSoftDelete } from './store';
import type { Decision, ReviewCard, ReviewMode, ReviewReason, Task } from '@/lib/types';

/** Untouched for this long and it needs a decision, not more patience. */
export const STALE_DAYS = 21;
/** A decision buys this much quiet before the item can return. */
export const SNOOZE_DAYS = 30;
/** A review you can finish beats a complete one you never start. */
export const SESSION_SIZE = 8;

/**
 * Verbs with no finish line. "Keep the pipeline current" is a standing
 * concern wearing a task's clothes — it will sit in the do-column for ever
 * unless something asks about it.
 */
const UNFINISHABLE = /^(keep|track|continue|monitor|maintain|ensure|be alert)\b/i;

export const isUnfinishable = (t: Task) => t.kind === 'task' && UNFINISHABLE.test(t.title);

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

function reasonFor(t: Task, idle: number): ReviewReason | null {
  if (t.due && new Date(t.due) < new Date(new Date().toDateString())) return 'overdue';
  if (t.unclear) return 'unclear';
  if (isUnfinishable(t)) return 'unfinishable';
  if (t.do_now && !t.due) return 'urgent_undated';
  if (idle >= STALE_DAYS) return 'stale';
  return null;
}

const PRIORITY: ReviewReason[] = ['overdue', 'unfinishable', 'urgent_undated', 'unclear', 'stale'];

/** Who is named on which task. */
export function useTaskPeople() {
  return useQuery({
    queryKey: ['task_people'],
    queryFn: async () => {
      if (DEMO) return (window as unknown as { __demoLinks?: { task_id: string; person_id: string }[] }).__demoLinks ?? [];
      const { data, error } = await supabase.from('task_people').select('task_id,person_id');
      if (error) throw error;
      return data as { task_id: string; person_id: string }[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useReviewQueue(mode: ReviewMode, personId?: string) {
  const { data: tasks = [] } = useTasks();
  const { data: links = [] } = useTaskPeople();

  return useMemo(() => {
    const open = tasks.filter((t) => t.kind === 'task' && !t.done && !t.deleted_at);

    const load = new Map<string, number>();
    for (const t of open) load.set(t.section_id, (load.get(t.section_id) ?? 0) + 1);

    const byTask = new Map<string, string[]>();
    for (const l of links) byTask.set(l.task_id, [...(byTask.get(l.task_id) ?? []), l.person_id]);

    const build = (t: Task, reason: ReviewReason): ReviewCard => ({
      task: t,
      reason,
      daysIdle: daysSince(t.touched_at ?? t.created_at),
      blocking: Math.max(0, (load.get(t.section_id) ?? 1) - 1),
      waitingOn: byTask.get(t.id) ?? [],
    });

    if (mode === 'person') {
      const mine = open.filter((t) => (byTask.get(t.id) ?? []).includes(personId ?? ''));
      return mine
        .map((t) => build(t, reasonFor(t, daysSince(t.touched_at ?? t.created_at)) ?? 'stale'))
        .sort((a, b) => b.daysIdle - a.daysIdle);
    }

    if (mode === 'unclear') {
      return open.filter((t) => t.unclear).map((t) => build(t, 'unclear'));
    }

    // Weekly. Skip anything decided recently, or the same cards return every
    // week and the ritual dies. An overdue item ignores the snooze.
    const due = open.filter((t) => {
      if (t.unclear) return false;                 // has its own queue
      const snoozed = t.reviewed_at && daysSince(t.reviewed_at) < SNOOZE_DAYS;
      const reason = reasonFor(t, daysSince(t.touched_at ?? t.created_at));
      if (!reason) return false;
      return reason === 'overdue' || !snoozed;
    });

    return due
      .map((t) => build(t, reasonFor(t, daysSince(t.touched_at ?? t.created_at))!))
      .sort((a, b) => {
        const p = PRIORITY.indexOf(a.reason) - PRIORITY.indexOf(b.reason);
        return p !== 0 ? p : b.daysIdle - a.daysIdle;
      });
  }, [tasks, links, mode, personId]);
}

/** Everything the review needs to know before you start. */
export function useReviewStatus() {
  const queue = useReviewQueue('weekly');
  const { data: tasks = [] } = useTasks();

  const lastReviewed = tasks
    .map((t) => t.reviewed_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  return {
    waiting: queue.length,
    session: Math.min(queue.length, SESSION_SIZE),
    unclear: tasks.filter((t) => t.kind === 'task' && !t.done && t.unclear).length,
    daysSinceReview: lastReviewed ? daysSince(lastReviewed) : null,
    reasons: queue.reduce<Record<string, number>>((acc, c) => {
      acc[c.reason] = (acc[c.reason] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

/** Apply one decision. Every one of them is reversible. */
export function useDecide() {
  const update = useUpdateTask();
  const { remove } = useSoftDelete();

  return useCallback(
    (task: Task, decision: Decision) => {
      const now = new Date().toISOString();
      switch (decision.kind) {
        case 'date':
          return update.mutate({ id: task.id, patch: { due: decision.due, reviewed_at: now } });
        case 'watch':
          return update.mutate({ id: task.id, patch: { kind: 'watch', do_now: false, reviewed_at: now } });
        case 'drop':
          return remove(task.id);
        case 'unclear':
          return update.mutate({ id: task.id, patch: { unclear: true, do_now: false, reviewed_at: now } });
        case 'clear':
          return update.mutate({ id: task.id, patch: { unclear: false, reviewed_at: now } });
        case 'done':
          return update.mutate({ id: task.id, patch: { done: true, reviewed_at: now } });
        case 'chased':
          // Chasing is contact, not completion: it resets the clock without
          // pretending the thing is finished.
          return update.mutate({ id: task.id, patch: { reviewed_at: now } });
        case 'keep':
          return update.mutate({ id: task.id, patch: { reviewed_at: now } });
      }
    },
    [update, remove],
  );
}

/** Undo a single decision, for the card you just sent away. */
export function useUndoDecision() {
  const update = useUpdateTask();
  return useCallback(
    (before: Task) =>
      update.mutate({
        id: before.id,
        patch: {
          due: before.due, kind: before.kind, done: before.done,
          do_now: before.do_now, unclear: before.unclear,
          deleted_at: null, reviewed_at: before.reviewed_at,
        },
      }),
    [update],
  );
}

/** Quick date choices, so dating something costs one tap not five. */
export function quickDates(): { label: string; iso: string }[] {
  const d = (n: number) => {
    const x = new Date();
    x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const today = new Date();
  const toFriday = (7 - today.getDay() + 5) % 7 || 7;
  return [
    { label: 'Tomorrow', iso: d(1) },
    { label: 'Friday', iso: d(toFriday) },
    { label: 'Next week', iso: d(toFriday + 7) },
    { label: 'In a month', iso: d(30) },
  ];
}
