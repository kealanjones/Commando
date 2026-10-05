import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDay, useTasks, useToday } from '@/data/store';
import { useReceiptLines } from '@/data/receipt';
import { prefersReducedMotion } from '@/lib/expand';
import { TICK, doneToday, stampFor, tallyGroups } from '@/lib/progress';
import {
  buildReceipt, code39, code39Width, dayLabel, receiptDays, receiptText, stepDay, type Receipt,
} from '@/lib/receipt';
import { drawReceipt, shareReceipt } from '@/lib/receiptImage';
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
  const day = useDay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const n = useMemo(() => doneToday(tasks).length, [tasks, day]);
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

/** How many lines the till shows before it says "earlier". */
const TILL_LINES = 4;

/**
 * The till: a strip of receipt that prints as the day goes on. Each tick
 * feeds one more line out. Pressing it opens the whole receipt.
 */
export function Till() {
  const { lines } = useReceiptLines();
  const day = useDay();
  const r = useMemo(() => buildReceipt(lines, day), [lines, day]);
  const [printing, setPrinting] = useState(false);
  const shown = r.lines.slice(-TILL_LINES);
  const earlier = r.lines.length - shown.length;

  return (
    <>
      <button type="button" className="till" onClick={() => setPrinting(true)}
        aria-label={`The till: ${r.total} rung through today. Open the receipt`}>
        <span className="till__slot" aria-hidden="true" />
        <span className="till__paper">
          <span className="till__head">Check-out · {r.total}</span>
          {earlier > 0 && <span className="till__earlier">… {earlier} earlier</span>}
          {shown.length === 0 && <span className="till__empty">Nothing rung through yet.</span>}
          {shown.map((l) => (
            <span key={l.id} className="till__line" data-kind={l.kind}>
              <span className="till__time">{l.time}</span>
              <span className="till__title">{l.kind === 'done' ? l.title : `${l.kind === 'void' ? 'VOID' : 'RETURNED'} ${l.title}`}</span>
            </span>
          ))}
        </span>
      </button>
      {printing && <ReceiptSheet onClose={() => setPrinting(false)} />}
    </>
  );
}

/** The bars of a day, real Code 39. */
function Barcode({ text }: { text: string }) {
  const bars = code39(text);
  const w = code39Width(text);
  return (
    <svg className="receipt__bars" viewBox={`0 0 ${w} 40`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((b, i) => <rect key={i} x={b.x} y="0" width={b.w} height="40" />)}
    </svg>
  );
}

/**
 * The paper itself: lines, VOID and RETURNED where they happened, the
 * sums, a subtotal per project, the barcode of the day.
 */
export function ReceiptPaper({ receipt: r, label, thanks = 'Thank you. Come again tomorrow.', torn = false, arrive = 'print', children }: {
  receipt: Receipt; label: string; thanks?: string; torn?: boolean;
  /** How it comes in: printed out of the slot, or flicked to on the roll. */
  arrive?: 'print' | 'flick';
  children?: React.ReactNode;
}) {
  return (
    <div className={`receipt__paper receipt__paper--${arrive}${torn ? ' receipt__paper--torn' : ''}`}>
      <p className="receipt__shop">Check-out</p>
      <p className="receipt__meta">{label}</p>
      {children}
      <p className="receipt__rule" aria-hidden="true" />

      {r.lines.length === 0 ? (
        <p className="receipt__empty">No items.</p>
      ) : (
        <ol className="receipt__lines">
          {r.lines.map((l, i) => (
            <li key={l.id} data-kind={l.kind} style={{ animationDelay: `${180 + Math.min(i, 14) * 45}ms` }}>
              <span className="receipt__time">{l.time}</span>
              <span className="receipt__title">
                {l.kind !== 'done' && <span className="receipt__mark">{l.kind === 'void' ? 'Void' : 'Returned'}</span>}
                {l.title}
              </span>
              <span className="receipt__code">{l.minutes ? `${l.code} ${l.minutes}m` : l.code}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="receipt__rule" aria-hidden="true" />
      <dl className="receipt__sums">
        <div className="receipt__total"><dt>Total done</dt><dd>{r.total}</dd></div>
        {r.minutes > 0 && <div><dt>Time with things</dt><dd>{r.minutes} min</dd></div>}
        {r.returned > 0 && <div><dt>Returned</dt><dd>{r.returned}</dd></div>}
        {r.voided > 0 && <div><dt>Void</dt><dd>{r.voided}</dd></div>}
        {r.first && <div><dt>First tick</dt><dd>{r.first}</dd></div>}
        {r.busiest && <div><dt>Busiest hour</dt><dd>{r.busiest}</dd></div>}
      </dl>
      {r.subtotals.length > 1 && (
        <dl className="receipt__sums receipt__subs">
          {r.subtotals.map((s) => <div key={s.code}><dt>{s.code}</dt><dd>{s.n}</dd></div>)}
        </dl>
      )}
      <p className="receipt__verdict">{r.verdict}</p>
      <Barcode text={r.day} />
      <p className="receipt__day">{r.day}</p>
      <p className="receipt__thanks">{thanks}</p>
    </div>
  );
}

/**
 * The receipt on its roll: today's, and every day's before it. It prints
 * out of a slot, flicks back through the roll, and goes with a tear.
 */
export function ReceiptSheet({ onClose, day: startDay }: { onClose: () => void; day?: string }) {
  const { lines } = useReceiptLines();
  const today = useDay();
  const [day, setDay] = useState(startDay ?? today);
  const days = useMemo(() => receiptDays(lines), [lines]);
  const r = useMemo(() => buildReceipt(lines, day), [lines, day]);
  const [tearing, setTearing] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // The first receipt prints; the ones you flick to just arrive.
  const flicked = useRef(false);
  const arrive = flicked.current ? 'flick' : 'print';
  useEffect(() => { flicked.current = true; }, []);

  const back = stepDay(days, day, -1, today);
  const forward = stepDay(days, day, 1, today);
  const where = [...new Set([...days, today])].sort().reverse();
  const place = where.indexOf(day) + 1;

  // Focus moves into the receipt, stays there, and goes back where it
  // came from when the receipt is torn off.
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('.receipt__tear')?.focus();
    return () => from?.focus?.();
  }, []);

  const tear = () => {
    if (tearing) return;
    if (prefersReducedMotion()) { onClose(); return; }
    setTearing(true);
    window.setTimeout(onClose, 420);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); tear(); return; }
      if (e.key === 'ArrowLeft' && back) { e.preventDefault(); setDay(back); return; }
      if (e.key === 'ArrowRight' && forward) { e.preventDefault(); setDay(forward); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const stops = [...box.current.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      if (!stops.length) return;
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : (at === stops.length - 1 ? 0 : at + 1);
      e.preventDefault();
      stops[next].focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const say = (m: string) => { setSaid(m); window.setTimeout(() => setSaid(null), 1600); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(receiptText(r, today)); say('Copied'); }
    catch { /* no clipboard: the receipt is still on screen */ }
  };
  const share = async () => {
    const out = await shareReceipt(drawReceipt(r, label.toUpperCase()), `check-out-${day}`);
    say(out === 'shared' ? 'Shared' : out === 'saved' ? 'Saved' : 'Could not share');
  };

  const label = dayLabel(day, today);
  const time = day === today ? ` · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '';

  return createPortal(
    <div
      className={`scrim scrim--receipt${tearing ? ' scrim--leaving' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) tear(); }}
    >
      <div className="receipt" role="dialog" aria-modal="true" aria-label="The receipt" ref={box}>
        <div className="receipt__slot" aria-hidden="true" />
        <ReceiptPaper key={day} receipt={r} label={`${label}${time}`.toUpperCase()} torn={tearing} arrive={arrive}>
          <div className="receipt__nav">
            <button type="button" className="receipt__step" onClick={() => back && setDay(back)} disabled={!back} aria-label="Earlier receipt">‹</button>
            <span className="receipt__place">{where.length > 1 ? `${place} of ${where.length} on the roll` : 'The roll starts here'}</span>
            <button type="button" className="receipt__step" onClick={() => forward && setDay(forward)} disabled={!forward} aria-label="Later receipt">›</button>
          </div>
        </ReceiptPaper>
        <div className="receipt__acts">
          <button type="button" className="btn btn--ghost" onClick={copy}>Copy</button>
          <button type="button" className="btn btn--ghost" onClick={share}>Share</button>
          <button type="button" className="btn btn--primary receipt__tear" onClick={tear}>Tear off</button>
        </div>
        {said && <p className="receipt__said" role="status">{said}</p>}
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
  // Set when you tick something; a count that moves for any other reason
  // (switching life, a sync from another device) never stamps.
  const yours = useRef(false);
  useEffect(() => {
    const mark = () => { yours.current = true; };
    window.addEventListener(TICK, mark);
    return () => window.removeEventListener(TICK, mark);
  }, []);
  const [stamp, setStamp] = useState<{ text: string; n: number } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const prev = last.current;
    last.current = n;
    if (prev === null || n === prev) return;
    const mine = yours.current;
    yours.current = false;
    if (!mine) return;
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
