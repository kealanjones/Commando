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
import type { Person, Section, Stream, StreamHealth, Task } from '@/lib/types';

export const keys = {
  streams: ['streams'] as const,
  sections: ['sections'] as const,
  tasks: ['tasks'] as const,
  people: ['people'] as const,
};

/** How many days of silence empties the recency dial completely. */
export const QUIET_SCALE_DAYS = 21;

// ── queries ────────────────────────────────────────────────────────
export function useStreams() {
  return useQuery({
    queryKey: keys.streams,
    queryFn: async (): Promise<Stream[]> => {
      const { data, error } = await supabase.from('streams').select('*').order('position');
      if (error) throw error;
      return data as Stream[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useSections() {
  return useQuery({
    queryKey: keys.sections,
    queryFn: async (): Promise<Section[]> => {
      const { data, error } = await supabase
        .from('sections').select('*').is('deleted_at', null).order('position');
      if (error) throw error;
      return data as Section[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useTasks() {
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
    // back; every consumer sees the live list only.
    select: (rows: Task[]) => rows.filter((r) => !r.deleted_at),
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
  'title' | 'note' | 'done' | 'do_now' | 'due' | 'kind' | 'section_id' | 'stream_id' | 'deleted_at'>>;

/** Fields whose editing means the seed file no longer owns this row. */
const CONTENT_FIELDS = ['title', 'note', 'do_now', 'due', 'kind', 'section_id', 'stream_id'] as const;
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
      kind?: Task['kind']; do_now?: boolean; due?: string | null; note?: string | null;
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
        kind: input.kind ?? 'task',
        context: null,
        note: input.note ?? null,
        done: false, done_at: null,
        do_now: input.do_now ?? false,
        due: input.due ?? null,
        position: 9999,
        user_edited: true,
        touched_at: now,
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

  return useMemo(
    () =>
      streams.map((s) => {
        const mine = tasks.filter((t) => t.stream_id === s.id);
        const open = mine.filter((t) => t.kind === 'task' && !t.done);
        const touched = mine
          .map((t) => t.touched_at)
          .filter((v): v is string => Boolean(v))
          .sort()
          .at(-1) ?? null;
        return {
          ...s,
          openTasks: open.length,
          doneTasks: mine.filter((t) => t.kind === 'task' && t.done).length,
          watchItems: mine.filter((t) => t.kind === 'watch').length,
          doNow: open.filter((t) => t.do_now).length,
          dated: open.filter((t) => t.due).length,
          lastTouchedAt: touched,
          daysQuiet: daysSince(touched),
        };
      }),
    [streams, tasks],
  );
}

/**
 * The three things on Today.
 *
 * Eighteen items carry a do-now flag, which is a week rather than a
 * morning. Rank by real pressure — a date closing, a stream that has gone
 * quiet, work with other items queued behind it — and show the top few.
 */
export function useToday(limit = 3, keepVisible: string[] = []) {
  const { data: tasks = [] } = useTasks();
  const health = useHealth();
  const keepKey = keepVisible.join(',');

  return useMemo(() => {
    const keep = new Set(keepKey ? keepKey.split(',') : []);
    const quiet = new Map(health.map((h) => [h.id, h.daysQuiet ?? 0]));
    // A task just ticked stays in place, struck through, until its undo
    // window closes. Having it vanish under your thumb makes the undo
    // toast refer to something you can no longer see.
    const open = tasks.filter((t) => t.kind === 'task' && (!t.done || keep.has(t.id)));

    // How many other open items sit in the same section: a proxy for how
    // much is waiting on this one.
    const sectionLoad = new Map<string, number>();
    for (const t of open) sectionLoad.set(t.section_id, (sectionLoad.get(t.section_id) ?? 0) + 1);

    // A kept-visible done task is scored as if it were still open, so it
    // holds its slot for the length of the undo window instead of sinking
    // to the bottom of the list under your thumb.
    const score = (t: (typeof open)[number]) => {
      let n = 0;
      if (t.due) {
        const days = Math.ceil((new Date(t.due).getTime() - Date.now()) / 86_400_000);
        n += days <= 0 ? 1000 : Math.max(0, 400 - days * 8);
      }
      if (t.do_now) n += 120;
      n += Math.min(80, (quiet.get(t.stream_id) ?? 0) * 5);
      n += Math.min(40, (sectionLoad.get(t.section_id) ?? 0) * 3);
      return n;
    };

    const ranked = [...open].sort((a, b) => score(b) - score(a));

    // Never let one stream own the whole list. A morning that is entirely
    // Commonwealth tells you nothing about the other four.
    const perStream = new Map<string, number>();
    const spread: typeof ranked = [];
    for (const t of ranked) {
      if (spread.length >= limit) break;
      const n = perStream.get(t.stream_id) ?? 0;
      if (n >= 2) continue;
      perStream.set(t.stream_id, n + 1);
      spread.push(t);
    }
    // If the cap left room (few streams in play), backfill by rank.
    for (const t of ranked) {
      if (spread.length >= limit) break;
      if (!spread.includes(t)) spread.push(t);
    }

    const live = open.filter((t) => !t.done);
    return {
      top: spread,
      flagged: live.filter((t) => t.do_now).length,
      restCount: Math.max(0, live.filter((t) => t.do_now).length - spread.length),
      openCount: live.length,
      datedCount: live.filter((t) => t.due).length,
      totalCount: tasks.length,
    };
  }, [tasks, health, limit, keepKey]);
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
