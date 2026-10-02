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
import { blocksDirectWrites, drain } from './queueCore';

const STORE = 'register.queue.v1';

/** What a caller hands in. */
export type NewOp =
  | { kind: 'update'; taskId: string; patch: Record<string, unknown> }
  | { kind: 'insert'; row: Record<string, unknown> }
  /** Structure edits: projects and sub-focuses, or many items at once. */
  | { kind: 'patch'; table: Table; match: Record<string, string>; patch: Record<string, unknown> }
  | { kind: 'add'; table: Table; row: Record<string, unknown> };

type Table = 'tasks' | 'streams' | 'sections';

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
let inFlight: Promise<void> | null = null;

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

/**
 * Errors that will never succeed on retry — surface, do not spin.
 *
 * 42xxx covers the whole syntax-and-access class, including 42703
 * "column does not exist". That one matters: deploy an app version ahead of
 * its migration and every write names a column the database has not got.
 * Classed as transient it would retry for ever and wedge the queue behind it;
 * classed as permanent it says so, once, and moves on.
 */
function permanent(code: string | undefined, status: number | undefined): boolean {
  if (status === 401 || status === 403) return true;
  if (!code) return false;
  return code.startsWith('22')   // data exception — bad value, bad date
      || code.startsWith('23')   // integrity constraint violation
      || code.startsWith('42')   // syntax error or access rule violation
      || code === 'PGRST116';    // no rows where one was required
}

/**
 * A new item with no tag leaves the column out, so adding items still
 * works against a database that has not run 0011 yet.
 */
export function withoutEmptyTag(row: Record<string, unknown>): Record<string, unknown> {
  if (row.tag != null) return row;
  const { tag: _tag, ...rest } = row;
  return rest;
}

/** Sends one op. */
async function send(op: QueuedOp) {
  const res =
    op.kind === 'update' ? await supabase.from('tasks').update(op.patch).eq('id', op.taskId)
    : op.kind === 'insert' ? await supabase.from('tasks').insert(withoutEmptyTag(op.row))
    : op.kind === 'patch' ? await supabase.from(op.table).update(op.patch).match(op.match)
    : await supabase.from(op.table).insert(op.row);
  return res.error as { code?: string; message: string; status?: number } | null;
}

export function flush(): Promise<void> {
  if (DEMO || !navigator.onLine) return Promise.resolve();
  // One drain at a time; a caller arriving mid-drain waits for that one,
  // which keeps going until the queue is empty or a write fails.
  if (inFlight) return inFlight;
  inFlight = drain({ read, write, emit }, send, (op, message) => { failed = { op, message }; }, permanent)
    .finally(() => { inFlight = null; });
  return inFlight;
}

/**
 * Flush, then say whether new projects or sub-focuses are still waiting
 * to be saved. Writes that go straight to the database (accepting meeting
 * proposals) must not name a sub-focus the database has not got yet.
 */
export async function structureSaved(): Promise<boolean> {
  if (DEMO) return true;
  await flush();
  return !blocksDirectWrites(read());
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { emit(); void flush(); });
  window.addEventListener('offline', emit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush();
  });
  void flush();
}
