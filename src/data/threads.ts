/**
 * Threads — accepting, dismissing and reading back the strands.
 *
 * Suggestions are computed locally (src/lib/grouping.ts); this module is
 * only about what happens once you agree with one.
 */
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { describeWriteError } from '@/lib/dbError';
import { DEMO } from '@/lib/demo';
import { useSections, useStreams, useTasks } from './store';
import { suggestGroups, type Suggestion } from '@/lib/grouping';
import type { Task, Thread } from '@/lib/types';

const memory = {
  threads: [] as Thread[],
  links: [] as { task_id: string; thread_id: string }[],
  dismissed: [] as string[],
};

export function useThreads() {
  return useQuery({
    queryKey: ['threads'],
    queryFn: async (): Promise<Thread[]> => {
      if (DEMO) return memory.threads;
      const { data, error } = await supabase
        .from('threads').select('*').is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Thread[];
    },
    staleTime: 60_000,
  });
}

export function useThreadLinks() {
  return useQuery({
    queryKey: ['task_threads'],
    queryFn: async (): Promise<{ task_id: string; thread_id: string }[]> => {
      if (DEMO) return memory.links;
      const { data, error } = await supabase.from('task_threads').select('task_id,thread_id');
      if (error) throw error;
      return data as { task_id: string; thread_id: string }[];
    },
    staleTime: 60_000,
  });
}

export function useDismissed() {
  return useQuery({
    queryKey: ['dismissed_groupings'],
    queryFn: async (): Promise<string[]> => {
      if (DEMO) return memory.dismissed;
      const { data, error } = await supabase.from('dismissed_groupings').select('signature');
      if (error) throw error;
      return (data ?? []).map((d) => d.signature as string);
    },
    staleTime: 5 * 60_000,
  });
}

/** What the register suggests, minus anything already grouped or turned down. */
export function useSuggestions(limit = 6): Suggestion[] {
  const { data: tasks = [] } = useTasks();
  const { data: sections = [] } = useSections();
  const { data: streams = [] } = useStreams();
  const { data: links = [] } = useThreadLinks();
  const { data: dismissed = [] } = useDismissed();

  return useMemo(
    () =>
      suggestGroups(tasks, sections, {
        limit,
        dismissed: new Set(dismissed),
        alreadyGrouped: new Set(links.map((l) => l.task_id)),
        // A stream's own name groups nothing inside it.
        ambientTerms: [...streams.map((s) => s.short), ...streams.map((s) => s.code), 'NHSBT'],
      }),
    [tasks, sections, streams, links, dismissed, limit],
  );
}

export function useAcceptThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; anchor: string; taskIds: string[] }) => {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const owner = DEMO ? 'demo' : ((await supabase.auth.getUser()).data.user?.id ?? '');

      const thread: Thread = {
        id, owner_id: owner, title: input.title.trim() || input.anchor,
        anchor: input.anchor, created_at: now, deleted_at: null,
      };
      const links = input.taskIds.map((task_id) => ({ task_id, thread_id: id, owner_id: owner }));

      if (DEMO) {
        memory.threads = [thread, ...memory.threads];
        memory.links = [...memory.links, ...links];
      } else {
        const { error } = await supabase.from('threads').insert(thread);
        if (error) throw new Error(describeWriteError(error, 'keep that thread'));

        const { error: linkErr } = await supabase.from('task_threads').insert(links);
        if (linkErr) {
          // Do not leave a thread with nothing in it.
          await supabase.from('threads').update({ deleted_at: now }).eq('id', id);
          throw new Error(describeWriteError(linkErr, 'attach those items'));
        }
      }

      qc.setQueryData<Thread[]>(['threads'], (old) => [thread, ...(old ?? [])]);
      qc.setQueryData<{ task_id: string; thread_id: string }[]>(['task_threads'], (old) => [
        ...(old ?? []), ...links.map(({ task_id, thread_id }) => ({ task_id, thread_id })),
      ]);
      return thread;
    },
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useCallback(
    async (signature: string) => {
      if (DEMO) memory.dismissed = [...memory.dismissed, signature];
      else {
        const owner = (await supabase.auth.getUser()).data.user?.id ?? '';
        const { error } = await supabase.from('dismissed_groupings').upsert({ owner_id: owner, signature });
        if (error) throw new Error(describeWriteError(error, 'turn that down'));
      }
      qc.setQueryData<string[]>(['dismissed_groupings'], (old) => [...(old ?? []), signature]);
    },
    [qc],
  );
}

/** Detach one item from a thread. Removing it is not destroying anything. */
export function useRemoveFromThread() {
  const qc = useQueryClient();
  return useCallback(
    async (taskId: string, threadId: string) => {
      if (DEMO) {
        memory.links = memory.links.filter((l) => !(l.task_id === taskId && l.thread_id === threadId));
      } else {
        const { error } = await supabase
          .from('task_threads').delete().eq('task_id', taskId).eq('thread_id', threadId);
        if (error) throw new Error(describeWriteError(error, 'take that out of the thread'));
      }
      qc.setQueryData<{ task_id: string; thread_id: string }[]>(['task_threads'], (old) =>
        (old ?? []).filter((l) => !(l.task_id === taskId && l.thread_id === threadId)),
      );
    },
    [qc],
  );
}

/** Threads with their live items, for display. */
export function useThreadsWithItems() {
  const { data: threads = [] } = useThreads();
  const { data: links = [] } = useThreadLinks();
  const { data: tasks = [] } = useTasks();

  return useMemo(() => {
    const byId = new Map(tasks.filter((t) => !t.deleted_at).map((t) => [t.id, t]));
    return threads
      .map((thread) => {
        const items = links
          .filter((l) => l.thread_id === thread.id)
          .map((l) => byId.get(l.task_id))
          .filter((t): t is Task => Boolean(t));
        return {
          thread,
          items,
          open: items.filter((t) => !t.done).length,
          streams: [...new Set(items.map((t) => t.stream_id))],
        };
      })
      .filter((t) => t.items.length > 0);
  }, [threads, links, tasks]);
}
