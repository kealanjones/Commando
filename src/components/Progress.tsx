import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStreams, useTasks, useToday } from '@/data/store';
import { prefersReducedMotion } from '@/lib/expand';
import { doneToday, receipt, receiptText, stampFor, tallyGroups } from '@/lib/progress';
import { isoDay } from '@/lib/today';

/** Beyond this many strokes the tally stops drawing and says "+n". */
const MOST_STROKES = 40;

/** A little hand-wobble per stroke, the same every time it is drawn. */
const wobble = (i: number) => (((i * 7919) % 13) - 6) / 10;

/**
 * Today's ticks as tally marks: four strokes and a fifth across the gate.
 * Each new tick draws one more stroke. Pressing it prints the receipt.
 */
export function DayTally({ className = '' }: { className?: string }) {
  const { data: tasks = [] } = useTasks();
  const n = useMemo(() => doneToday(tasks).length, [tasks]);
  const [printing, setPrinting] = useState(false);
  const shown = Math.min(n, MOST_STROKES);

  let stroke = 0;
  return (
    <>
      <button
        type="button"
        className={`daytally ${className}`}
        onClick={() => setPrinting(true)}
        aria-label={`${n} done today. Print today's receipt`}
      >
        <span className="daytally__marks" aria-hidden="true">
          {tallyGroups(shown).map((size, g) => (
            <svg key={g} className="daytally__gate" viewBox="0 0 36 30" width="36" height="30">
              {Array.from({ length: Math.min(size, 4) }, (_, i) => {
                const k = stroke++;
                const x = 5 + i * 7 + wobble(k);
                return (
                  <path
                    key={i}
                    d={`M${x} ${4 + wobble(k + 3)} L${x + wobble(k + 1)} ${26 + wobble(k + 5)}`}
                    pathLength={1}
                    style={{ animationDelay: `${Math.min(k, 12) * 35}ms` }}
                  />
                );
              })}
              {size === 5 && (
                <path
                  className="daytally__cross"
                  d={`M1 ${21 + wobble(g)} L34 ${8 + wobble(g + 2)}`}
                  pathLength={1}
                  style={{ animationDelay: `${Math.min(stroke++, 12) * 35}ms` }}
                />
              )}
            </svg>
          ))}
          {n > MOST_STROKES && <span className="daytally__more">+{n - MOST_STROKES}</span>}
        </span>
        <span className="daytally__caption">
          <span className="daytally__count">{n === 0 ? 'Nothing ticked yet' : <><b>{n}</b> done today</>}</span>
          <span className="daytally__hint">Today's receipt</span>
        </span>
      </button>
      {printing && <ReceiptSheet onClose={() => setPrinting(false)} />}
    </>
  );
}

/**
 * Today on a till roll: what you finished, when, and a total. It prints
 * out of a slot, and goes with a tear.
 */
export function ReceiptSheet({ onClose }: { onClose: () => void }) {
  const { data: tasks = [] } = useTasks();
  const { data: streams = [] } = useStreams();
  const now = new Date();
  const r = useMemo(() => {
    const code = new Map(streams.map((s) => [s.id, s.code]));
    return receipt(doneToday(tasks, now), (id) => code.get(id) ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, streams]);
  const [tearing, setTearing] = useState(false);
  const [copied, setCopied] = useState(false);

  const tear = () => {
    if (tearing) return;
    if (prefersReducedMotion()) { onClose(); return; }
    setTearing(true);
    window.setTimeout(onClose, 420);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); tear(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receiptText(r, now));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* no clipboard: the receipt is still on screen */ }
  };

  const day = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return createPortal(
    <div
      className={`scrim scrim--receipt${tearing ? ' scrim--leaving' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) tear(); }}
    >
      <div className="receipt" role="dialog" aria-modal="true" aria-label="Today's receipt">
        <div className="receipt__slot" aria-hidden="true" />
        <div className={`receipt__paper${tearing ? ' receipt__paper--torn' : ''}`}>
          <p className="receipt__shop">The Register</p>
          <p className="receipt__meta">{day} · {time}</p>
          <p className="receipt__rule" aria-hidden="true" />

          {r.lines.length === 0 ? (
            <p className="receipt__empty">No items yet.</p>
          ) : (
            <ol className="receipt__lines">
              {r.lines.map((l, i) => (
                <li key={l.id} style={{ animationDelay: `${180 + Math.min(i, 14) * 45}ms` }}>
                  <span className="receipt__time">{l.time}</span>
                  <span className="receipt__title">{l.title}</span>
                  <span className="receipt__code">{l.code}</span>
                </li>
              ))}
            </ol>
          )}

          <p className="receipt__rule" aria-hidden="true" />
          <dl className="receipt__sums">
            <div className="receipt__total"><dt>Total done</dt><dd>{r.total}</dd></div>
            {r.overdue > 0 && <div><dt>Overdue, now done</dt><dd>{r.overdue}</dd></div>}
            {r.first && <div><dt>First tick</dt><dd>{r.first}</dd></div>}
            {r.busiest && <div><dt>Busiest hour</dt><dd>{r.busiest}</dd></div>}
          </dl>
          <p className="receipt__verdict">{r.verdict}</p>
          <p className="receipt__barcode" aria-hidden="true" />
          <p className="receipt__thanks">Thank you. Come again tomorrow.</p>
        </div>
        <div className="receipt__acts">
          <button type="button" className="btn btn--ghost" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          <button type="button" className="btn btn--primary" onClick={tear}>Tear off</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const STAMPED = 'commando.stamped';

function readStamped(day: string): number {
  try {
    const v = JSON.parse(localStorage.getItem(STAMPED) ?? 'null');
    return v?.day === day ? Number(v.at) || 0 : 0;
  } catch { return 0; }
}
function writeStamped(day: string, at: number) {
  try { localStorage.setItem(STAMPED, JSON.stringify({ day, at })); } catch { /* fine */ }
}

/**
 * The rubber stamp: at 5, 10, 15, 20 and 30 done in a day, an inked
 * stamp comes down on the page, holds, and lifts away.
 */
export function Stamps() {
  const { doneToday: n, isLoading } = useToday();
  const last = useRef<number | null>(null);
  const timer = useRef<number>();
  const [stamp, setStamp] = useState<{ text: string; n: number } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const prev = last.current;
    last.current = n;
    if (prev === null) return;
    const day = isoDay(new Date());
    const s = stampFor(prev, n, readStamped(day));
    if (!s) return;
    writeStamped(day, s.at);
    setStamp({ text: s.text, n });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStamp(null), 2300);
  }, [n, isLoading]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!stamp) return null;
  return createPortal(
    <div className="stamp" role="status" key={stamp.n}>
      <span className="stamp__ink">
        <span className="stamp__text">{stamp.text}</span>
        <span className="stamp__n">{stamp.n} done today</span>
      </span>
    </div>,
    document.body,
  );
}
