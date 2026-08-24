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
import { parseProposals, placeItems } from '@/lib/proposalFormat';
import type { IntakeItem, Section, Task } from '@/lib/types';

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
        // When the function ran and refused, the useful message is in the
        // response body, not in error.message — which would otherwise read
        // "Edge Function returned a non-2xx status code".
        let detail = '';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            detail = ((await ctx.json()) as { error?: string }).error ?? '';
          } catch { /* body was not JSON */ }
        }
        if (detail) throw new Error(detail);

        // No response at all: the request never landed. Supabase reports this
        // as "Failed to send a request to the Edge Function", which tells you
        // nothing about what to do. Nearly always it is simply not deployed.
        if (error.name === 'FunctionsFetchError' || /failed to send a request/i.test(error.message)) {
          throw new Error(
            'Could not reach the extraction function. It is probably not deployed yet — ' +
              'see DEPLOY.md step 8. Everything else in the app works without it.',
          );
        }

        if (error.name === 'FunctionsRelayError') {
          throw new Error('The extraction function is deployed but failed to start. Check its logs in Supabase.');
        }

        throw new Error(error.message);
      }
      if (!data) throw new Error('Extraction returned nothing.');
      return data;
    },
    onSuccess: () => {
      if (!DEMO) void qc.invalidateQueries({ queryKey: ['intake_items'] });
    },
  });
}

/**
 * Bring in proposals pasted back from Claude.
 *
 * Writes the same intake and intake_items rows the Edge Function would,
 * using the ordinary RLS-bound client — so the triage screen, the evidence
 * quotes and the "where did this come from" trail are identical. No function
 * to deploy, no API key anywhere.
 */
export function useImportProposals() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      raw: string; label?: string; sections: Section[]; openTasks: Task[];
    }): Promise<ExtractResult & { items: IntakeItem[] }> => {
      const parsed = parseProposals(input.raw);
      const placed = placeItems(parsed.items, input.sections, parsed.duplicateTitles, input.openTasks);

      const now = new Date().toISOString();
      const intakeId = crypto.randomUUID();

      const items: IntakeItem[] = placed.map((p, i) => ({
        ...p,
        id: crypto.randomUUID(),
        intake_id: intakeId,
        owner_id: '',
        status: 'pending' as const,
        task_id: null,
        position: i,
        created_at: now,
      }));

      if (!DEMO) {
        const { data: auth } = await supabase.auth.getUser();
        const owner = auth.user?.id ?? '';
        items.forEach((i) => { i.owner_id = owner; });

        const { error: intakeErr } = await supabase.from('intakes').insert({
          id: intakeId,
          owner_id: owner,
          label: input.label?.slice(0, 200) ?? null,
          // The record itself stays in Claude. What is kept here is the
          // proposals and their quotes, which is what the trail needs.
          source_text: '(brought in from Claude)',
          summary: parsed.summary || null,
          status: 'ready',
          model: 'pasted',
          processed_at: now,
        });
        if (intakeErr) throw new Error(`Could not save the intake: ${intakeErr.message}`);

        const { error: itemsErr } = await supabase.from('intake_items').insert(
          items.map(({ id, intake_id, owner_id, title, kind, context, stream_id, section_id,
                       do_now, due, waiting_on, evidence, confidence, duplicate_of, position }) => ({
            id, intake_id, owner_id, title, kind, context, stream_id, section_id,
            do_now, due, waiting_on, evidence, confidence, duplicate_of, position,
          })),
        );
        if (itemsErr) throw new Error(`Could not save the proposals: ${itemsErr.message}`);
      }

      qc.setQueryData(['intake_items', intakeId], items);

      return {
        intake_id: intakeId,
        summary: parsed.summary,
        count: items.length,
        tasks: items.filter((i) => i.kind === 'task').length,
        watch: items.filter((i) => i.kind === 'watch').length,
        duplicates: items.filter((i) => i.duplicate_of).length,
        items,
      };
    },
  });
}

export function useIntakeItems(intakeId: string | null) {
  return useQuery({
    queryKey: ['intake_items', intakeId],
    enabled: Boolean(intakeId),
    queryFn: async (): Promise<IntakeItem[]> => {
      // Proposals pasted in this session are already in the cache under this
      // key; only fetch when they came from somewhere else.
      const cached = (window as unknown as { __demoItems?: IntakeItem[] }).__demoItems;
      if (DEMO) return cached ?? [];
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
