/**
 * The memory: reading it, feeding it meetings, asking it things, and the
 * hand edits (a "now" corrected, a line struck out, the lot erased).
 *
 * Reads go straight to Supabase under RLS. Anything that needs Claude goes
 * through /api/memory, which holds the API key. Hand edits go through the
 * offline queue like every other write.
 */
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { enqueue } from '@/lib/queue';
import { DEMO, demoAnswer } from '@/lib/demo';
import { missingTable } from '@/lib/dbError';
import type { MemoryEntry, MemoryMeeting, MemoryNote } from '@/lib/types';

export const memoryKeys = {
  notes: ['memory', 'notes'] as const,
  entries: ['memory', 'entries'] as const,
  meetings: ['memory', 'meetings'] as const,
};

export interface MemorySource { intake_id: string; label: string; date: string }
export interface MemoryAnswer { answer: string; sources: MemorySource[] }

/** Calls /api/memory with the session's own token. */
async function memoryApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Your session has expired. Sign in again.');
  let res: Response;
  try {
    res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const payload = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(payload?.error ?? `The memory did not respond (${res.status}).`);
  if (!payload) throw new Error('The server sent back nothing readable.');
  return payload;
}

/**
 * The whole memory. `missing` means the database has not had 0012 yet:
 * the page says so instead of failing.
 */
export function useMemory() {
  const notes = useQuery({
    queryKey: memoryKeys.notes,
    queryFn: async (): Promise<MemoryNote[]> => {
      const { data, error } = await supabase.from('memory_notes')
        .select('id,kind,key,title,now,updated_at').is('deleted_at', null);
      if (error) throw error;
      return data as MemoryNote[];
    },
    retry: false,
  });
  const entries = useQuery({
    queryKey: memoryKeys.entries,
    queryFn: async (): Promise<MemoryEntry[]> => {
      const { data, error } = await supabase.from('memory_entries')
        .select('id,note_id,intake_id,happened_on,text').is('deleted_at', null);
      if (error) throw error;
      return data as MemoryEntry[];
    },
    retry: false,
  });
  const meetings = useQuery({
    queryKey: memoryKeys.meetings,
    queryFn: async (): Promise<MemoryMeeting[]> => {
      const { data, error } = await supabase.from('intakes')
        .select('id,label,created_at,in_memory,remembered_at')
        .is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      return data as MemoryMeeting[];
    },
    retry: false,
  });
  return {
    notes: (notes.data ?? []).filter((n) => !n.deleted_at),
    entries: (entries.data ?? []).filter((e) => !e.deleted_at),
    meetings: meetings.data ?? [],
    isLoading: notes.isLoading || entries.isLoading || meetings.isLoading,
    // Only a missing table means the database needs 0012. Anything else
    // (offline, signed out, a server hiccup) is an error to retry.
    missing: [notes.error, entries.error].some((e) => missingTable(e)),
    error: [notes.error, entries.error, meetings.error].find((e) => e && !missingTable(e)) as Error | undefined,
    retry: () => { void notes.refetch(); void entries.refetch(); void meetings.refetch(); },
  };
}

const refresh = (qc: ReturnType<typeof useQueryClient>) => {
  if (DEMO) return;
  void qc.invalidateQueries({ queryKey: ['memory'] });
};

/** Fold one meeting into the memory. */
export function useAbsorb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (intakeId: string): Promise<{ notes: number; entries: number }> => {
      if (DEMO) return { notes: 0, entries: 0 };
      return memoryApi({ action: 'absorb', intake_id: intakeId });
    },
    onSuccess: () => refresh(qc),
  });
}

export function useAsk() {
  return useMutation({
    mutationFn: async (question: string): Promise<MemoryAnswer> => {
      if (DEMO) return demoAnswer(question);
      return memoryApi({ action: 'ask', question });
    },
  });
}

/** Take one meeting back out of the memory, exactly. */
export function useForget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (intakeId: string) => {
      if (DEMO) {
        const gone = new Set((qc.getQueryData<MemoryEntry[]>(memoryKeys.entries) ?? [])
          .filter((e) => e.intake_id === intakeId).map((e) => e.note_id));
        qc.setQueryData<MemoryEntry[]>(memoryKeys.entries, (old) => (old ?? []).filter((e) => e.intake_id !== intakeId));
        const left = new Set((qc.getQueryData<MemoryEntry[]>(memoryKeys.entries) ?? []).map((e) => e.note_id));
        qc.setQueryData<MemoryNote[]>(memoryKeys.notes, (old) => (old ?? []).filter((n) => !gone.has(n.id) || left.has(n.id)));
        qc.setQueryData<MemoryMeeting[]>(memoryKeys.meetings, (old) =>
          (old ?? []).map((m) => (m.id === intakeId ? { ...m, in_memory: false, remembered_at: null } : m)));
        return { removed: gone.size };
      }
      return memoryApi<{ removed: number }>({ action: 'forget', intake_id: intakeId });
    },
    onSuccess: () => refresh(qc),
  });
}

/** Hand edits: correct a "now", strike a line. Queued like every write. */
export function useMemoryEdits() {
  const qc = useQueryClient();
  return {
    setNow(id: string, now: string) {
      const at = new Date().toISOString();
      qc.setQueryData<MemoryNote[]>(memoryKeys.notes, (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, now, updated_at: at } : n)));
      enqueue({ kind: 'patch', table: 'memory_notes', match: { id }, patch: { now, updated_at: at } });
    },
    dropEntry(id: string) {
      qc.setQueryData<MemoryEntry[]>(memoryKeys.entries, (old) => (old ?? []).filter((e) => e.id !== id));
      enqueue({ kind: 'patch', table: 'memory_entries', match: { id }, patch: { deleted_at: new Date().toISOString() } });
    },
  };
}

/** Everything gone. The meetings stay; they can be remembered again. */
export function useEraseMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const at = new Date().toISOString();
      if (!DEMO) {
        const a = await supabase.from('memory_entries').update({ deleted_at: at }).is('deleted_at', null);
        const b = await supabase.from('memory_notes').update({ deleted_at: at }).is('deleted_at', null);
        const c = await supabase.from('intakes').update({ remembered_at: null }).not('remembered_at', 'is', null);
        const err = a.error ?? b.error ?? c.error;
        if (err) throw new Error('The memory could not be erased. Try again.');
      }
      qc.setQueryData(memoryKeys.notes, []);
      qc.setQueryData(memoryKeys.entries, []);
      qc.setQueryData<MemoryMeeting[]>(memoryKeys.meetings, (old) => (old ?? []).map((m) => ({ ...m, remembered_at: null })));
    },
    onSuccess: () => refresh(qc),
  });
}

/**
 * Remember every past meeting not yet in the memory, oldest first, one at
 * a time, so the memory builds in the order things happened.
 */
export function useRememberPast() {
  const absorb = useAbsorb();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const run = useCallback(async (meetings: MemoryMeeting[]) => {
    const todo = meetings.filter((m) => m.in_memory && !m.remembered_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    setProgress({ done: 0, total: todo.length });
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      try { await absorb.mutateAsync(todo[i].id); } catch { failed++; }
      setProgress({ done: i + 1, total: todo.length });
    }
    setProgress(null);
    return { total: todo.length, failed };
  }, [absorb]);
  return { run, progress };
}
