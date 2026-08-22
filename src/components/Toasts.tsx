import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'warn';
  /** ms; 0 keeps it until dismissed */
  duration?: number;
}

const Ctx = createContext<{ push: (t: Omit<Toast, 'id'>) => void }>({ push: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const h = timers.current.get(id);
    if (h) { window.clearTimeout(h); timers.current.delete(id); }
  }, []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
      const ms = t.duration ?? 6000;
      if (ms > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), ms));
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
