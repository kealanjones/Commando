import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'warn';
  /** ms; 0 keeps it until dismissed */
  duration?: number;
  /**
   * Toasts sharing a key replace one another instead of stacking. Working
   * through a review otherwise leaves a pile of identical confirmations
   * covering the screen, and only the newest undo is the one you want.
   */
  replaceKey?: string;
}

const Ctx = createContext<{ push: (t: Omit<Toast, 'id'>) => void }>({ push: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    for (const [key, handle] of timers.current) {
      if (key === id || key.endsWith(`::${id}`)) {
        window.clearTimeout(handle);
        timers.current.delete(key);
      }
    }
  }, []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID();
      setToasts((prev) => {
        const kept = t.replaceKey ? prev.filter((x) => x.replaceKey !== t.replaceKey) : prev;
        return [...kept.slice(-2), { ...t, id }];
      });
      if (t.replaceKey) {
        for (const [key, handle] of timers.current) {
          if (key.startsWith(`${t.replaceKey}::`)) { window.clearTimeout(handle); timers.current.delete(key); }
        }
      }
      const ms = t.duration ?? 6000;
      if (ms > 0) {
        timers.current.set(
          t.replaceKey ? `${t.replaceKey}::${id}` : id,
          window.setTimeout(() => dismiss(id), ms),
        );
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.tone === 'warn' ? ' toast--warn' : ''}`}>
            <p>{t.message}</p>
            {t.actionLabel && (
              <button
                onClick={() => { t.onAction?.(); dismiss(t.id); }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
