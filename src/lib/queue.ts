/**
 * Offline write queue.
 *
 * The Underground requirement: a tick on the platform must survive until
 * the barrier. Every write goes through here — applied optimistically to
 * the cache, appended to a durable queue, then flushed. Nothing is ever
 * dropped silently; a write that genuinely fails is surfaced.
 *
 * Backed by localStorage rather than IndexedDB: payloads are a few hundred
 * bytes each and synchronous writes mean a queued change survives the tab
 * being killed mid-navigation, which is the actual failure mode on a phone.
 */
import { supabase } from './supabase';
import { DEMO } from './demo';

const STORE = 'register.queue.v1';

/** What a caller hands in. */
export type NewOp =
  | { kind: 'update'; taskId: string; patch: Record<string, unknown> }
  | { kind: 'insert'; row: Record<string, unknown> };

/** What is stored, once the queue has stamped it. */
export type QueuedOp = NewOp & { id: string; at: number; tries: number };

type Listener = (state: QueueState) => void;
export interface QueueState {
  pending: number;
  online: boolean;
  /** Set when a write failed for a reason retrying will not fix. */
  failed: { op: QueuedOp; message: string } | null;
}

let listeners: Listener[] = [];
let failed: QueueState['failed'] = null;
let flushing = false;

function read(): QueuedOp[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '[]') as QueuedOp[];
  } catch {
    return [];
  }
}

function write(ops: QueuedOp[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(ops));
  } catch {
    /* quota or private mode — the in-flight flush still runs */
  }
}

function state(): QueueState {
  return { pending: read().length, online: navigator.onLine, failed };
}

function emit() {
  const s = state();
  listeners.forEach((l) => l(s));
}

export function subscribeQueue(fn: Listener): () => void {
  listeners.push(fn);
  fn(state());
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function dismissFailure() {
  failed = null;
  emit();
}

export function enqueue(op: NewOp) {
  if (DEMO) return; // fixture mode keeps everything in the cache
  const full: QueuedOp = { ...op, id: crypto.randomUUID(), at: Date.now(), tries: 0 };
  write([...read(), full]);
  emit();
  void flush();
}

/** Errors that will never succeed on retry — surface, do not spin. */
function permanent(code: string | undefined, status: number | undefined): boolean {
  if (status === 401 || status === 403) return true;
  if (!code) return false;
  return code.startsWith('22') || code.startsWith('23') || code === '42501' || code === 'PGRST116';
}

export async function flush(): Promise<void> {
  if (DEMO || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    let ops = read();
    while (ops.length) {
      const op = ops[0];
      const res =
        op.kind === 'update'
          ? await supabase.from('tasks').update(op.patch).eq('id', op.taskId)
          : await supabase.from('tasks').insert(op.row);

      if (!res.error) {
        ops = ops.slice(1);
        write(ops);
        emit();
        continue;
      }

      if (permanent(res.error.code, (res.error as { status?: number }).status)) {
        // Drop it, but say so loudly. Losing a change silently is the one
        // thing this queue exists to prevent.
        failed = { op, message: res.error.message };
        ops = ops.slice(1);
        write(ops);
        emit();
        continue;
      }

      // Transient: leave it at the head and try again on the next trigger.
      op.tries += 1;
      write(ops);
      emit();
      break;
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { emit(); void flush(); });
  window.addEventListener('offline', emit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush();
  });
  void flush();
}
