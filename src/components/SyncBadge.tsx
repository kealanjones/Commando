import { useEffect, useState } from 'react';
import { subscribeQueue, dismissFailure, type QueueState } from '@/lib/queue';
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
      message: `A change could not be saved: ${state.failed.message}`,
      actionLabel: 'Dismiss',
      onAction: dismissFailure,
      tone: 'warn',
      duration: 0,
    });
  }, [state.failed, push]);

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
