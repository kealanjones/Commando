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

type Table = 'tasks' | 'streams' | 'sections' | 'memory_notes' | 'memory_entries' | 'receipt_lines';

/** What is stored, once the queue has stamped it. */
export type QueuedOp = NewOp & { id: string; at: number; tries: number };

type Listener = (state: QueueState) => void;
export interface QueueState {
  pending: number;
  online: boolean;
  /** Set when a write failed for a reason retrying will not fix. */
  failed: { op: QueuedOp; message: string } | null;
}

/** Writes the database refused for good. Kept, so nothing is lost with them. */
const FAILED = 'register.failed.v1';
type Failure = NonNullable<QueueState['failed']>;

function readFailed(): Failure[] {
  try { return JSON.parse(localStorage.getItem(FAILED) ?? '[]') as Failure[]; } catch { return []; }
}
function writeFailed(list: Failure[]) {
  try { localStorage.setItem(FAILED, JSON.stringify(list.slice(-20))); } catch { /* still shown this session */ }
}

let listeners: Listener[] = [];
// A failure from an earlier session is still a failure: it is shown again
// until it is dismissed, not forgotten when the app closes.
let failed: QueueState['failed'] = typeof localStorage === 'undefined' ? null : readFailed().at(-1) ?? null;
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
  const rest = readFailed().filter((f) => f.op.id !== failed?.op.id);
  writeFailed(rest);
  failed = rest.at(-1) ?? null;
  emit();
}

/** What a refused write was, in words: the item's title where it has one. */
export function describeOp(op: QueuedOp): string {
  const row = (op.kind === 'insert' || op.kind === 'add' ? op.row : op.patch) as Record<string, unknown>;
  const name = typeof row.title === 'string' ? row.title : typeof row.text === 'string' ? row.text : '';
  const what = op.kind === 'insert' ? 'New item' : op.kind === 'add' ? 'New entry' : 'A change';
  return name ? `${what} "${name.length > 70 ? `${name.slice(0, 70)}…` : name}"` : what;
}

/** New items queued on this device and not yet on the server. */
export function pendingTaskInserts<T extends { id: string }>(): T[] {
  return read().filter((o) => o.kind === 'insert').map((o) => (o as { row: unknown }).row as T);
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
  inFlight = drain({ read, write, emit }, send, (op, message) => {
    failed = { op, message };
    writeFailed([...readFailed(), failed]);
  }, permanent)
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
