/**
 * Queries, mutations and the derived signals the app reads.
 *
 * All writes are optimistic: the cache is patched immediately, the write
 * goes on the offline queue, and realtime reconciles when it lands.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { enqueue } from '@/lib/queue';
import { DEMO } from '@/lib/demo';
import { inScope, useRealm } from '@/lib/modes';
import { isoDay, todayGroups } from '@/lib/today';
import type { Person, Section, Stream, StreamHealth, Task } from '@/lib/types';

export const keys = {
  streams: ['streams'] as const,
  sections: ['sections'] as const,
  tasks: ['tasks'] as const,
  people: ['people'] as const,
};

// ── queries ────────────────────────────────────────────────────────
//
// Every query below is scoped by the realm switch inside its `select`, so
// no route has to remember to filter: in Work the personal streams, their
// sections and their tasks are simply not in the data. The cache itself
// holds everything, which is what lets the switch be instant.

const streamsQuery = {
  queryKey: keys.streams,
  queryFn: async (): Promise<Stream[]> => {
    const { data, error } = await supabase.from('streams').select('*').order('position');
    if (error) throw error;
    return data as Stream[];
  },
  staleTime: 5 * 60_000,
};

/** All streams, whichever realm is showing. The switch itself needs this. */
export function useAllStreams() {
  return useQuery(streamsQuery);
}

export function useStreams() {
  const realm = useRealm();
  return useQuery({
    ...streamsQuery,
    select: useCallback((rows: Stream[]) => rows.filter((s) => inScope(realm, s)), [realm]),
  });
}

/**
 * The stream ids in the current realm, as one string so it can be a hook
 * dependency; null while the switch is on Both, or before the streams have
 * arrived — an unscoped moment is better than an empty one.
 */
function useScope(): Set<string> | null {
  const realm = useRealm();
  const { data: streams } = useAllStreams();
  const ids = realm === 'all' || !streams
    ? null
    : streams.filter((s) => inScope(realm, s)).map((s) => s.id).sort().join(',');
  return useMemo(() => (ids === null ? null : new Set(ids.split(','))), [ids]);
}

export function useSections() {
  const scope = useScope();
  return useQuery({
    queryKey: keys.sections,
    queryFn: async (): Promise<Section[]> => {
      const { data, error } = await supabase
        .from('sections').select('*').is('deleted_at', null).order('position');
      if (error) throw error;
      return data as Section[];
    },
    select: useCallback(
      (rows: Section[]) => (scope ? rows.filter((r) => scope.has(r.stream_id)) : rows),
      [scope],
    ),
    staleTime: 5 * 60_000,
  });
}

export function useTasks() {
  const scope = useScope();
  return useQuery({
    queryKey: keys.tasks,
    queryFn: async (): Promise<Task[]> => {
      // Paged: the register is ~190 rows now but grows, and PostgREST
      // caps a plain select at 1000.
      const out: Task[] = [];
      const size = 1000;
      for (let from = 0; ; from += size) {
        const { data, error } = await supabase
          .from('tasks').select('*').is('deleted_at', null)
          .order('position').range(from, from + size - 1);
        if (error) throw error;
        out.push(...(data as Task[]));
        if (!data || data.length < size) break;
      }
      return out;
    },
    // Soft-deleted rows stay in the cache so Undo can put them straight
    // back; every consumer sees the live list only, in the realm showing.
    select: useCallback(
      (rows: Task[]) => rows.filter((r) => !r.deleted_at && (!scope || scope.has(r.stream_id))),
      [scope],
    ),
    staleTime: 30_000,
  });
}

export function usePeople() {
  return useQuery({
    queryKey: keys.people,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase.from('people').select('id,name,role').order('name');
      if (error) throw error;
      return data as Person[];
    },
    staleTime: 10 * 60_000,
  });
}

// ── realtime ───────────────────────────────────────────────────────
/** A tick on the phone shows up on the laptop. RLS applies to the stream too. */
export function useRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    if (DEMO) return;
    const ch = supabase
      .channel('register')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        void qc.invalidateQueries({ queryKey: keys.tasks });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, () => {
        void qc.invalidateQueries({ queryKey: keys.sections });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);
}

// ── mutations ──────────────────────────────────────────────────────
type Patch = Partial<Pick<Task,
  'title' | 'note' | 'done' | 'do_now' | 'due' | 'section_id' | 'stream_id'
  | 'deleted_at' | 'reviewed_at'>>;

/**
 * Fields whose editing means the seed file no longer owns this row.
 *
 * Deliberately excludes due and do_now: those are planning decisions, and
 * giving something a date must not stop the seed file owning its wording.
 */
const CONTENT_FIELDS = ['title', 'note', 'section_id', 'stream_id'] as const;
const isContentEdit = (p: Patch) => CONTENT_FIELDS.some((f) => f in p);

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['task', 'update'],
    // The queue owns the network. This mutation only patches the cache,
    // so it resolves instantly and works with no signal at all.
    mutationFn: async ({ id, patch }: { id: string; patch: Patch }) => {
      const now = new Date().toISOString();
      const wire: Record<string, unknown> = { ...patch, touched_at: now };
      // Only a content edit freezes the row against re-seeding. Ticking
      // something done, or deleting it, must not stop the seed file from
      // still owning its wording.
      if (isContentEdit(patch)) wire.user_edited = true;
      if (patch.done !== undefined) wire.done_at = patch.done ? now : null;
      enqueue({ kind: 'update', taskId: id, patch: wire });
      return { id, patch };
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.tasks });
      const prev = qc.getQueryData<Task[]>(keys.tasks);
      const now = new Date().toISOString();
      qc.setQueryData<Task[]>(keys.tasks, (old) =>
        (old ?? []).map((t) =>
          t.id === id
            ? {
                ...t, ...patch, touched_at: now, updated_at: now,
                user_edited: t.user_edited || isContentEdit(patch),
                done_at: patch.done === undefined ? t.done_at : patch.done ? now : null,
              }
            : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.tasks, ctx.prev);
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string; stream_id: Task['stream_id']; section_id: string;
      do_now?: boolean; due?: string | null; note?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const row: Task = {
        id: crypto.randomUUID(),
        owner_id: auth.user?.id ?? '',
        stream_id: input.stream_id,
        section_id: input.section_id,
        natural_key: null,          // user-created: the seed must never touch it
        title: input.title,
        kind: 'task',
        context: null,
        note: input.note ?? null,
        done: false, done_at: null,
        do_now: input.do_now ?? false,
        due: input.due ?? null,
        position: 9999,
        user_edited: true,
        touched_at: now,
        reviewed_at: null,
        unclear: false,
        created_at: now, updated_at: now, deleted_at: null,
      };
      enqueue({ kind: 'insert', row: row as unknown as Record<string, unknown> });
      qc.setQueryData<Task[]>(keys.tasks, (old) => [...(old ?? []), row]);
      return row;
    },
  });
}

// ── derived ────────────────────────────────────────────────────────
export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function useHealth(): StreamHealth[] {
  const { data: streams = [] } = useStreams();
  const { data: tasks = [] } = useTasks();

  return useMemo(() => {
    const today = isoDay(new Date());
    return streams.map((s) => {
      const mine = tasks.filter((t) => t.stream_id === s.id);
      const open = mine.filter((t) => !t.done);
      const touched = mine
        .map((t) => t.touched_at)
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1) ?? null;
      return {
        ...s,
        openTasks: open.length,
        doneTasks: mine.length - open.length,
        overdue: open.filter((t) => t.due && t.due < today).length,
        doNow: open.filter((t) => t.do_now).length,
        dated: open.filter((t) => t.due).length,
        lastTouchedAt: touched,
        daysQuiet: daysSince(touched),
      };
    });
  }, [streams, tasks]);
}

/** Today's three groups, in the realm showing. See lib/today.ts. */
export function useToday(keepVisible: string[] = []) {
  const { data: tasks = [], isLoading } = useTasks();
  const keepKey = keepVisible.join(',');
  const groups = useMemo(
    () => todayGroups(tasks, new Date(), new Set(keepKey ? keepKey.split(',') : [])),
    [tasks, keepKey],
  );
  return { ...groups, isLoading };
}

/**
 * Soft delete with undo. Nothing in this app is destroyed by a tap.
 *
 * Restore re-inserts the row into the cache as well as patching the server,
 * because a refetch between delete and undo drops it from the local list.
 */
export function useSoftDelete() {
  const qc = useQueryClient();
  const update = useUpdateTask();

  const remove = useCallback(
    (id: string) => update.mutate({ id, patch: { deleted_at: new Date().toISOString() } }),
    [update],
  );

  const restore = useCallback(
    (task: Task) => {
      qc.setQueryData<Task[]>(keys.tasks, (old) => {
        const list = old ?? [];
        return list.some((t) => t.id === task.id)
          ? list.map((t) => (t.id === task.id ? { ...t, deleted_at: null } : t))
          : [...list, { ...task, deleted_at: null }];
      });
      update.mutate({ id: task.id, patch: { deleted_at: null } });
    },
    [qc, update],
  );

  return { remove, restore };
}
