import { useEffect, useState } from 'react';
import { describeOp, subscribeQueue, dismissFailure, type QueueState } from '@/lib/queue';
import { useToast } from './Toasts';

/**
 * Says out loud whether a change has actually landed.
 *
 * The brief's floor was that a failed write must surface rather than
 * vanish. Pending count while queued, a plain offline state, and a warn
 * toast for anything that failed permanently.
 */
export function SyncBadge() {
  const [state, setState] = useState<QueueState>({ pending: 0, online: true, failed: null });
  const { push } = useToast();

  useEffect(() => subscribeQueue(setState), []);

  useEffect(() => {
    if (!state.failed) return;
    push({
      message: `${describeOp(state.failed.op)} could not be saved: ${state.failed.message}`,
      actionLabel: 'Dismiss',
      onAction: dismissFailure,
      tone: 'warn',
      duration: 0,
    });
  // Keyed by the write itself, so each refused write is announced once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.failed?.op.id, push]);

  // Changes this device could not keep a copy of: say so, once, loudly.
  useEffect(() => {
    if (!state.unstored) return;
    push({
      message: 'This device could not store your last change (its storage is full, or this is a private window). Keep the app open until "Saving" clears, or the change will be lost.',
      tone: 'warn', duration: 0, actionLabel: 'Dismiss', replaceKey: 'unstored',
    });
  }, [state.unstored, push]);

  if (state.online && state.pending === 0) return null;

  const cls = !state.online ? 'sync sync--offline' : 'sync sync--pending';
  const text = !state.online
    ? state.pending > 0
      ? `Offline · ${state.pending} queued`
      : 'Offline'
    : `Saving ${state.pending}`;

  return (
    <span className={cls} role="status">
      <span className="sync__dot" />
      {text}
    </span>
  );
}
