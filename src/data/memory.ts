/**
 * The memory: reading it, feeding it meetings, asking it things, and the
 * hand edits (a "now" corrected, a line struck out, the lot erased).
 *
 * Reads go straight to Supabase under RLS. Anything that needs Claude goes
 * through /api/memory, which holds the API key. Hand edits go through the
 * offline queue like every other write.
 */
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { enqueue } from '@/lib/queue';
import { DEMO, demoAnswer } from '@/lib/demo';
import { missingTable } from '@/lib/dbError';
import { noteKey, relevantNotes } from '@/lib/memory';
import type { MemoryEntry, MemoryMeeting, MemoryNote } from '@/lib/types';

export const memoryKeys = {
  notes: ['memory', 'notes'] as const,
  entries: ['memory', 'entries'] as const,
  meetings: ['memory', 'meetings'] as const,
};

export interface MemorySource { intake_id: string; label: string; date: string }
export interface MemoryAnswer { answer: string; sources: MemorySource[] }

/** An error that remembers the status it came with; 0 is "never got there". */
const failure = (message: string, status: number) => Object.assign(new Error(message), { status });
/** The server or the model was out of reach, as against saying no. */
const unreachable = (e: unknown) => {
  const status = (e as { status?: number }).status;
  return status === 0 || status === 429 || (typeof status === 'number' && status >= 500);
};

/** Calls /api/memory with the session's own token. */
async function memoryApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw failure('Your session has expired. Sign in again.', 401);
  let res: Response;
  try {
    res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw failure('Could not reach the server. Check your connection and try again.', 0);
  }
  const payload = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw failure(payload?.error ?? `The memory did not respond (${res.status}).`, res.status);
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

export interface Told {
  /** The notes it went under. */
  notes: { id: string; kind: MemoryNote['kind']; title: string }[];
  entries: number;
  /** True when it was saved exactly as written, with no model to file it. */
  asWritten?: boolean;
}

/** The longest note saved as a single line when the model cannot file it. */
const AS_WRITTEN_MAX = 2000;

const uid = async () => (await supabase.auth.getSession()).data.session?.user.id ?? '';

/**
 * Tell the memory something you have learnt. It files it under the right
 * notes and refreshes where things stand. Name a note and it goes there;
 * if the model cannot be reached, a note you named still gets the line,
 * exactly as written, through the offline queue.
 */
export function useTell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, noteId }: { text: string; noteId?: string }): Promise<Told> => {
      const told = text.trim();
      const notes = qc.getQueryData<MemoryNote[]>(memoryKeys.notes) ?? [];
      const direct = (target: MemoryNote, owner: string): Told => {
        const now = new Date();
        const entry: MemoryEntry = {
          id: crypto.randomUUID(), note_id: target.id, intake_id: null,
          happened_on: now.toISOString().slice(0, 10), text: told,
        };
        qc.setQueryData<MemoryEntry[]>(memoryKeys.entries, (old) => [...(old ?? []), entry]);
        qc.setQueryData<MemoryNote[]>(memoryKeys.notes, (old) =>
          (old ?? []).map((n) => (n.id === target.id ? { ...n, updated_at: now.toISOString() } : n)));
        enqueue({ kind: 'add', table: 'memory_entries', row: { ...entry, owner_id: owner } });
        return { notes: [{ id: target.id, kind: target.kind, title: target.title }], entries: 1, asWritten: true };
      };

      if (DEMO) {
        // Fixture mode has no model: the named note, else the first one
        // the words point at, else a topic of loose notes.
        let target = notes.find((n) => n.id === noteId) ?? relevantNotes(notes, { text: told })[0];
        if (!target) {
          target = { id: 'demo-note-loose', kind: 'topic', key: 'loose-notes', title: 'Loose notes', now: '', updated_at: new Date().toISOString() };
          const made = target;
          qc.setQueryData<MemoryNote[]>(memoryKeys.notes, (old) => [...(old ?? []).filter((n) => n.id !== made.id), made]);
        }
        return { ...direct(target, ''), asWritten: false };
      }

      const target = noteId ? notes.find((n) => n.id === noteId) : undefined;
      try {
        return await memoryApi<Told>({ action: 'note', text: told, note_id: noteId });
      } catch (e) {
        // With somewhere to put it, and the model out of reach, it is never
        // lost: saved as written. A refusal, or a note that has gone, is an
        // answer and is shown; so is something too long to be one line.
        if (!target || !unreachable(e) || told.length > AS_WRITTEN_MAX) throw e;
        return direct(target, await uid());
      }
    },
    onSuccess: (out) => { if (!out.asWritten) refresh(qc); },
  });
}

/** The notes worth showing beside one item, a project or a person. */
export function useRelevant(about: { streamId?: string | null; people?: string[]; text?: string }, max = 4): MemoryNote[] {
  const { notes } = useMemory();
  const people = (about.people ?? []).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => relevantNotes(notes, about, max), [notes, about.streamId, people, about.text, max]);
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
    /** A new area of your own: a person or a topic to build context on. */
    async addNote(kind: 'person' | 'topic', title: string): Promise<MemoryNote> {
      const t = title.trim().slice(0, 120);
      const key = noteKey(kind, t);
      if (!key) throw new Error('Give it a name.');
      const at = new Date().toISOString();
      const have = (qc.getQueryData<MemoryNote[]>(memoryKeys.notes) ?? []).find((n) => n.kind === kind && n.key === key && !n.deleted_at);
      if (have) return have;
      let note: MemoryNote = { id: crypto.randomUUID(), kind, key, title: t, now: '', updated_at: at };
      if (!DEMO) {
        // An upsert, so a note deleted earlier under the same name comes back
        // rather than colliding with its own ghost.
        const { data, error } = await supabase.from('memory_notes')
          .upsert({ owner_id: await uid(), kind, key, title: t, now: '', updated_at: at, deleted_at: null }, { onConflict: 'owner_id,kind,key' })
          .select('id,kind,key,title,now,updated_at').single();
        if (error || !data) throw new Error(navigator.onLine ? 'That could not be added. Try again.' : 'You are offline. Add it when you are back.');
        note = data as MemoryNote;
      }
      qc.setQueryData<MemoryNote[]>(memoryKeys.notes, (old) => [...(old ?? []).filter((n) => n.id !== note.id), note]);
      return note;
    },
    /**
     * The note for a project, made if the memory has none yet, so anything
     * can be filed under any project from the first day.
     */
    async projectNote(stream: { id: string; title: string }): Promise<MemoryNote> {
      const have = (qc.getQueryData<MemoryNote[]>(memoryKeys.notes) ?? [])
        .find((n) => n.kind === 'project' && n.key === stream.id && !n.deleted_at);
      if (have) return have;
      const at = new Date().toISOString();
      let note: MemoryNote = { id: crypto.randomUUID(), kind: 'project', key: stream.id, title: stream.title.slice(0, 120), now: '', updated_at: at };
      if (!DEMO) {
        const { data, error } = await supabase.from('memory_notes')
          .upsert({ owner_id: await uid(), kind: 'project', key: stream.id, title: note.title, updated_at: at, deleted_at: null }, { onConflict: 'owner_id,kind,key' })
          .select('id,kind,key,title,now,updated_at').single();
        if (error || !data) throw new Error(navigator.onLine ? `${stream.title} could not be opened in the memory. Try again.` : 'You are offline. Try again when you are back.');
        note = data as MemoryNote;
      }
      qc.setQueryData<MemoryNote[]>(memoryKeys.notes, (old) => [...(old ?? []).filter((n) => n.id !== note.id), note]);
      return note;
    },
    rename(id: string, title: string) {
      const t = title.trim().slice(0, 120);
      if (!t) return;
      qc.setQueryData<MemoryNote[]>(memoryKeys.notes, (old) => (old ?? []).map((n) => (n.id === id ? { ...n, title: t } : n)));
      enqueue({ kind: 'patch', table: 'memory_notes', match: { id }, patch: { title: t } });
    },
    /** The note and everything under it. Meetings stay; so do other notes. */
    removeNote(id: string) {
      const at = new Date().toISOString();
      qc.setQueryData<MemoryNote[]>(memoryKeys.notes, (old) => (old ?? []).filter((n) => n.id !== id));
      qc.setQueryData<MemoryEntry[]>(memoryKeys.entries, (old) => (old ?? []).filter((e) => e.note_id !== id));
      enqueue({ kind: 'patch', table: 'memory_entries', match: { note_id: id }, patch: { deleted_at: at } });
      enqueue({ kind: 'patch', table: 'memory_notes', match: { id }, patch: { deleted_at: at } });
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
