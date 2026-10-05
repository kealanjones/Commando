/**
 * The till roll: reading the lines, and printing new ones.
 *
 * A tick prints a line; so does a return and a void. Printing is
 * optimistic and queued like every other write. Undo in time marks the
 * line undone rather than removing it.
 *
 * Before migration 0013 the table is not there: the roll is then read
 * from the items themselves (done items only) and nothing is printed.
 */
import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { enqueue } from '@/lib/queue';
import { missingTable } from '@/lib/dbError';
import { linesFromTasks } from '@/lib/receipt';
import { isoDay } from '@/lib/today';
import { useAllStreams, useAllTasks } from './store';
import type { ReceiptLine, Task } from '@/lib/types';

export const receiptKeys = {
  lines: ['receipt', 'lines'] as const,
};

/** Every line on the roll, oldest first. */
export function useReceiptLines() {
  const q = useQuery({
    queryKey: receiptKeys.lines,
    queryFn: async (): Promise<ReceiptLine[]> => {
      const out: ReceiptLine[] = [];
      const size = 1000;
      for (let from = 0; ; from += size) {
        const { data, error } = await supabase.from('receipt_lines')
          .select('id,task_id,kind,title,code,stream_id,minutes,at,day,undone_at')
          .order('at').range(from, from + size - 1);
        if (error) throw error;
        out.push(...(data as ReceiptLine[]));
        if (!data || data.length < size) break;
      }
      return out;
    },
    staleTime: 60_000,
    retry: false,
  });
  const { data: tasks = [] } = useAllTasks();
  const { data: streams = [] } = useAllStreams();
  const missing = missingTable(q.error);

  // Without the table, the roll is what the items themselves remember.
  const fallback = useMemo(() => {
    if (!missing) return null;
    const code = new Map(streams.map((s) => [s.id, s.code]));
    return linesFromTasks(tasks, (id) => code.get(id) ?? '');
  }, [missing, tasks, streams]);

  return {
    lines: fallback ?? q.data ?? [],
    missing,
    isLoading: q.isLoading,
    error: q.error && !missing ? (q.error as Error) : undefined,
  };
}

/**
 * Print a line, and take one back. `print` returns the line's id so an
 * Undo can call `unprint` with it. With the table missing it prints
 * nothing and returns null.
 */
export function usePrinter() {
  const qc = useQueryClient();
  const { missing } = useReceiptLines();
  const { data: streams = [] } = useAllStreams();

  const print = useCallback(
    (kind: ReceiptLine['kind'], task: Task, minutes: number | null = null): string | null => {
      if (missing) return null;
      const now = new Date();
      const line: ReceiptLine = {
        id: crypto.randomUUID(),
        task_id: task.id,
        kind,
        title: task.title,
        code: streams.find((s) => s.id === task.stream_id)?.code ?? '',
        stream_id: task.stream_id,
        minutes: minutes && minutes > 0 ? Math.round(minutes) : null,
        at: now.toISOString(),
        day: isoDay(now),
        undone_at: null,
      };
      qc.setQueryData<ReceiptLine[]>(receiptKeys.lines, (old) => [...(old ?? []), line]);
      // Queued at once, before any Undo can queue its patch; the table fills
      // in owner_id from the session.
      enqueue({ kind: 'add', table: 'receipt_lines', row: { ...line } });
      return line.id;
    },
    [qc, missing, streams],
  );

  const unprint = useCallback(
    (id: string | null) => {
      if (!id) return;
      const undone_at = new Date().toISOString();
      qc.setQueryData<ReceiptLine[]>(receiptKeys.lines, (old) =>
        (old ?? []).map((l) => (l.id === id ? { ...l, undone_at } : l)));
      enqueue({ kind: 'patch', table: 'receipt_lines', match: { id }, patch: { undone_at } });
    },
    [qc],
  );

  return { print, unprint, missing };
}
