/**
 * Intake: paste a meeting record, review what it found, accept what is real.
 *
 * The extraction itself runs in a Supabase Edge Function — the Anthropic key
 * must never reach the browser. This module only calls it and manages the
 * triage that follows.
 */
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DEMO, demoExtraction } from '@/lib/demo';
import { keys } from './store';
import type { IntakeItem, Task } from '@/lib/types';

export interface ExtractResult {
  intake_id: string;
  summary: string;
  count: number;
  tasks: number;
  watch: number;
  duplicates: number;
}

export function useExtract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; label?: string; meetingDate?: string }): Promise<ExtractResult> => {
      if (DEMO) return demoExtraction(input.text, input.label);

      const { data, error } = await supabase.functions.invoke<ExtractResult>('extract', {
        body: { text: input.text, label: input.label, meeting_date: input.meetingDate },
      });

      if (error) {
        // Edge function errors carry the useful message in the response body,
        // not in error.message — surface that rather than "Edge Function
        // returned a non-2xx status code".
        let detail = '';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            detail = ((await ctx.json()) as { error?: string }).error ?? '';
          } catch { /* body was not JSON */ }
        }
        throw new Error(detail || error.message);
      }
      if (!data) throw new Error('Extraction returned nothing.');
      return data;
    },
    onSuccess: () => {
      if (!DEMO) void qc.invalidateQueries({ queryKey: ['intake_items'] });
    },
  });
}

export function useIntakeItems(intakeId: string | null) {
  return useQuery({
    queryKey: ['intake_items', intakeId],
    enabled: Boolean(intakeId),
    queryFn: async (): Promise<IntakeItem[]> => {
      if (DEMO) return (window as unknown as { __demoItems?: IntakeItem[] }).__demoItems ?? [];
      const { data, error } = await supabase
        .from('intake_items').select('*')
        .eq('intake_id', intakeId!).order('position');
      if (error) throw error;
      return data as IntakeItem[];
    },
    staleTime: 60_000,
  });
}

/**
 * Turn accepted proposals into real tasks.
 *
 * One place, one commit. Everything up to here has been reversible by
 * doing nothing; this is the step that writes.
 */
export function useAcceptItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: IntakeItem[]) => {
      const { data: auth } = DEMO ? { data: { user: { id: 'demo' } } } : await supabase.auth.getUser();
      const now = new Date().toISOString();

      const rows: Task[] = items.map((i) => ({
        id: crypto.randomUUID(),
        owner_id: auth.user?.id ?? '',
        stream_id: i.stream_id!,
        section_id: i.section_id!,
        natural_key: null,           // not seeded content: the seed must never touch it
        title: i.title,
        kind: i.kind,
        context: i.context,
        note: null,
        done: false, done_at: null,
        do_now: i.do_now,
        due: i.due,
        position: 9999,
        user_edited: true,
        touched_at: now,
        reviewed_at: null,
        unclear: false,
        created_at: now, updated_at: now, deleted_at: null,
      }));

      if (!DEMO && rows.length) {
        const { error } = await supabase
          .from('tasks')
          .insert(rows.map((r, n) => ({ ...r, intake_item_id: items[n].id })));
        if (error) throw error;

        const { error: markErr } = await supabase
          .from('intake_items')
          .upsert(items.map((i, n) => ({ ...i, status: 'accepted' as const, task_id: rows[n].id })));
        if (markErr) throw markErr;
      }

      qc.setQueryData<Task[]>(keys.tasks, (old) => [...(old ?? []), ...rows]);
      return rows;
    },
    onSuccess: () => {
      // In fixture mode there is no backend to refetch from, and
      // invalidating would discard the rows just written to the cache.
      if (DEMO) return;
      void qc.invalidateQueries({ queryKey: keys.tasks });
      void qc.invalidateQueries({ queryKey: ['intake_items'] });
    },
  });
}

/**
 * Triage state.
 *
 * Edits live here rather than round-tripping to the database on every
 * keystroke: the whole point of the screen is that nothing is committed
 * until you press the button once.
 */
export function useTriage(initial: IntakeItem[]) {
  const [edits, setEdits] = useState<Record<string, Partial<IntakeItem>>>({});
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const merged = initial.map((i) => ({ ...i, ...edits[i.id] }));
  const kept = merged.filter((i) => !rejected.has(i.id));
  const placed = kept.filter((i) => i.section_id && i.stream_id);
  const unplaced = kept.filter((i) => !i.section_id || !i.stream_id);

  const edit = useCallback((id: string, patch: Partial<IntakeItem>) => {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  }, []);

  const reject = useCallback((id: string) => {
    setRejected((r) => new Set(r).add(id));
  }, []);

  const restore = useCallback((id: string) => {
    setRejected((r) => { const n = new Set(r); n.delete(id); return n; });
  }, []);

  return { merged, kept, placed, unplaced, rejected, edit, reject, restore };
}
