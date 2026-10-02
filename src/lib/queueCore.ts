/**
 * The queue's drain loop, with no imports so it can be tested on its own.
 *
 * It re-reads the queue at every step and removes only the op it sent.
 * Anything enqueued while a request was in flight must survive: writing
 * back a copy of the queue taken before the await would drop it.
 */
export interface Op { id: string; tries: number }
export interface Store<T extends Op> {
  read: () => T[];
  write: (ops: T[]) => void;
  emit: () => void;
}
type Err = { code?: string; message: string; status?: number } | null;

export async function drain<T extends Op>(
  store: Store<T>,
  send: (op: T) => Promise<Err>,
  onFailed: (op: T, message: string) => void,
  permanent: (code: string | undefined, status: number | undefined) => boolean,
): Promise<void> {
  const settle = (id: string) => {
    store.write(store.read().filter((o) => o.id !== id));
    store.emit();
  };
  for (let op = store.read()[0]; op; op = store.read()[0]) {
    const err = await send(op);
    if (!err) { settle(op.id); continue; }
    if (permanent(err.code, err.status)) {
      // Drop it, but say so loudly. Losing a change silently is the one
      // thing this queue exists to prevent.
      onFailed(op, err.message);
      settle(op.id);
      continue;
    }
    // Transient: leave it at the head and try again on the next trigger.
    const sent = op.id;
    store.write(store.read().map((o) => (o.id === sent ? { ...o, tries: o.tries + 1 } : o)));
    store.emit();
    return;
  }
}
