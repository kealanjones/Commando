import { useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/expand';

/**
 * A number that rolls when it changes: the old figure slides out the way
 * the count went, the new one slides in after it. Counts are the main
 * feedback the register gives, so they should be seen to move.
 */
export function Num({ value }: { value: number | string }) {
  const last = useRef(value);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  const [prev, setPrev] = useState<number | string | null>(null);

  useLayoutEffect(() => {
    if (last.current === value) return;
    const a = Number(last.current);
    const b = Number(value);
    setPrev(last.current);
    setDir(Number.isFinite(a) && Number.isFinite(b) && b < a ? 'down' : 'up');
    last.current = value;
    const t = window.setTimeout(() => setPrev(null), 420);
    return () => window.clearTimeout(t);
  }, [value]);

  return (
    <span className="num" data-dir={dir ?? undefined}>
      {/* The outgoing figure is drawn from an attribute, so the element's
          text is only ever the current value. */}
      {prev !== null && <span className="num__out" aria-hidden="true" data-v={String(prev)} />}
      <span className="num__in" key={String(value)}>{value}</span>
    </span>
  );
}

/**
 * The selection at a desk: one highlight that glides from row to row,
 * rather than one row lighting up as another goes dark. It sits behind
 * the list and measures whichever row is selected.
 */
export function Glide({ selectedId, watch }: { selectedId: string | null; watch: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const shown = useRef(false);

  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const measure = () => {
      const row = selectedId
        ? host.querySelector<HTMLElement>(`[data-task="${CSS.escape(selectedId)}"]`)
        : null;
      if (!row) { setBox(null); shown.current = false; return; }
      const h = host.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      setBox({ top: r.top - h.top, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [selectedId, watch]);

  // The first placement appears where it is; only later moves glide.
  const instant = !shown.current || prefersReducedMotion();
  if (box) shown.current = true;

  return (
    <div
      ref={ref}
      className="glide"
      aria-hidden="true"
      data-on={box ? '' : undefined}
      data-instant={instant ? '' : undefined}
      style={box ? { transform: `translateY(${box.top}px)`, height: box.height } : undefined}
    />
  );
}
