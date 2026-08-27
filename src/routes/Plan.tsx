/**
 * The plan.
 *
 * One item in hand, a month in front of you, and the load on every day shown
 * as colour. Tap a day — or one of the named chips above it — and the item in
 * hand takes that date and the next one steps forward.
 *
 * The heat is the point. You can see yourself over-filling a Tuesday while
 * you are doing it, which is the thing a list of two hundred undated items
 * can never tell you.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSections, useStreams, useTasks, useUpdateTask } from '@/data/store';
import { useDecide } from '@/data/review';
import { pathOf } from '@/lib/tree';
import {
  fmtDay, monthGrid, monthName, quickTargets, startOfDay, undated, weekAhead,
} from '@/lib/plan';
import type { StreamId, Task } from '@/lib/types';

export function Plan({ onOpenTask }: { onOpenTask: (task: Task) => void }) {
  const { data: tasks = [] } = useTasks();
  const { data: sections = [] } = useSections();
  const { data: streams = [] } = useStreams();
  const decide = useDecide();
  const update = useUpdateTask();

  const today = startOfDay();
  const [cursor, setCursor] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));
  const [onlyStream, setOnlyStream] = useState<StreamId | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  /** Passed over for this sitting only; nothing is written to say no. */
  const [passed, setPassed] = useState<Set<string>>(new Set());
  /** The one you just placed, so it can be taken back without a toast. */
  const [last, setLast] = useState<{ task: Task; due: string } | null>(null);
  /** Tapping a day either places the item in hand on it, or looks at it. */
  const [looking, setLooking] = useState(false);

  const queue = useMemo(() => {
    const all = undated(tasks).filter((t) => !passed.has(t.id));
    return onlyStream ? all.filter((t) => t.stream_id === onlyStream) : all;
  }, [tasks, onlyStream, passed]);

  const inHand = queue[0] ?? null;
  const weeks = useMemo(() => monthGrid(cursor.y, cursor.m, tasks, today), [cursor, tasks]);
  const quick = useMemo(() => quickTargets(today), []);
  const week = useMemo(() => weekAhead(tasks, today), [tasks]);

  const onDay = useMemo(() => {
    const at = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.kind !== 'task' || t.done || t.deleted_at || !t.due) continue;
      at.set(t.due, [...(at.get(t.due) ?? []), t]);
    }
    return at;
  }, [tasks]);

  // A month you have paged away from is not where the work is going.
  useEffect(() => { setPeek(null); }, [cursor.y, cursor.m]);

  const give = (due: string) => {
    if (!inHand) return;
    const task = inHand;
    decide(task, { kind: 'date', due });
    // No toast: placing thirty items in a sitting would stack thirty of them.
    // What just happened belongs on the screen you are already looking at.
    setLast({ task, due });
    // Show what that day now holds: the consequence of the decision you just
    // made is the thing you most want to see straight after making it.
    setPeek(due);
  };

  /** Straight back to undated, which puts it at the head of the queue again. */
  const undo = () => {
    if (!last) return;
    update.mutate({ id: last.task.id, patch: { due: null } });
    setLast(null);
  };

  /** Not now. Nothing is written — it will be here next time. */
  const pass = () => {
    if (inHand) setPassed((s) => new Set(s).add(inHand.id));
  };

  const step = (by: number) => setCursor(({ y, m }) => {
    const d = new Date(y, m + by, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const peeked = peek ? onDay.get(peek) ?? [] : [];
  const left = queue.length;

  return (
    <section aria-labelledby="plan-head" className="plan">
      <div className="shead">
        <h2 id="plan-head">Plan</h2>
        <span className="shead__meta">{left} still undated</span>
      </div>

      <p className="plan__lede">
        One at a time: pick a day for the item in hand and the next one steps forward.
        The darker a day, the more you have already put on it.
      </p>

      <div className="filters" role="group" aria-label="Limit to one stream">
        <button className="chip" aria-pressed={onlyStream === null} onClick={() => setOnlyStream(null)}>
          Everything
        </button>
        {streams.map((s) => (
          <button
            key={s.id}
            className="chip"
            data-stream={s.id}
            aria-pressed={onlyStream === s.id}
            onClick={() => setOnlyStream(onlyStream === s.id ? null : s.id)}
          >
            <span className="chip__dot" />
            {s.short}
          </button>
        ))}
      </div>

      {/* ── the item in hand ─────────────────────────────────────── */}
      {inHand ? (
        <div className="plan__hand" data-stream={inHand.stream_id}>
          <div className="plan__handbody">
            <p className="plan__handwhere">{pathOf(sections, inHand.section_id)}</p>
            <button className="plan__handtitle" onClick={() => onOpenTask(inHand)}>
              {inHand.title}
            </button>
            {inHand.context && <p className="plan__handnote">{inHand.context}</p>}
          </div>
          <button className="btn btn--ghost plan__skip" onClick={pass}>Not yet</button>
        </div>
      ) : (
        <div className="empty">
          <h3>Everything has a day</h3>
          <p>
            {onlyStream
              ? 'Nothing left undated in this stream.'
              : 'Every open item now carries a date, so Today can rank by what is actually closing.'}
          </p>
          <p style={{ marginTop: 12 }}><Link to="/">Back to Today</Link></p>
        </div>
      )}

      {last && (
        <p className="plan__last">
          <b>{last.task.title}</b> → {fmtDay(last.due)}
          <button className="linkish" onClick={undo}>Undo</button>
        </p>
      )}

      {/* ── the days you reach for ───────────────────────────────── */}
      <div className="plan__quick" role="group" aria-label="Give it a day">
        {quick.map((q) => (
          <button
            key={q.key}
            className="plan__chip"
            disabled={!inHand}
            onClick={() => give(q.iso)}
          >
            <span>{q.label}</span>
            <span className="plan__chipn" data-load={loadAt(week, q.iso)}>
              {countAt(onDay, q.iso)}
            </span>
          </button>
        ))}
      </div>

      {/* ── the month ────────────────────────────────────────────── */}
      <div className="plan__board">
      <div className="plan__cal">
        <div className="plan__month">
          <button className="rowbtn" onClick={() => step(-1)} aria-label="The month before">‹</button>
          <h3>{monthName(cursor.y, cursor.m)}</h3>
          <button className="rowbtn" onClick={() => step(1)} aria-label="The month after">›</button>
          {(cursor.y !== today.getFullYear() || cursor.m !== today.getMonth()) && (
            <button
              className="linkish"
              onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
            >
              This month
            </button>
          )}
          {/* Without this a day can only be inspected by right-clicking it,
              which does not exist on a phone. */}
          <div className="seg plan__mode" role="group" aria-label="What tapping a day does">
            <button type="button" aria-pressed={!looking} onClick={() => setLooking(false)} disabled={!inHand}>
              Place
            </button>
            <button type="button" aria-pressed={looking || !inHand} onClick={() => setLooking(true)}>
              Look
            </button>
          </div>
        </div>

        <div className="plan__dow" aria-hidden="true">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
        </div>

        <div className="plan__grid">
          {weeks.flatMap((w) => w.days).map((d) => (
            <button
              key={d.iso}
              className="plan__day"
              data-load={d.load}
              data-out={!d.inMonth || undefined}
              data-today={d.isToday || undefined}
              data-past={d.isPast || undefined}
              data-weekend={d.isWeekend || undefined}
              data-peek={peek === d.iso || undefined}
              aria-label={`${fmtDay(d.iso)} — ${d.count} ${d.count === 1 ? 'item' : 'items'}`
                + (inHand && !looking ? '. Give the item in hand this day.' : '. See what is on it.')}
              onClick={() => (inHand && !looking ? give(d.iso) : setPeek(peek === d.iso ? null : d.iso))}
              onContextMenu={(e) => { e.preventDefault(); setPeek(peek === d.iso ? null : d.iso); }}
            >
              <span className="plan__num">{d.dayOfMonth}</span>
              {d.count > 0 && <span className="plan__count">{d.count}</span>}
              {d.pressing > 0 && <span className="plan__flag" aria-hidden="true" />}
            </button>
          ))}
        </div>

        <div className="plan__key" aria-hidden="true">
          <span>Clear</span>
          {[0, 1, 2, 3, 4, 5].map((l) => <i key={l} data-load={l} />)}
          <span>Full</span>
        </div>
      </div>

      {peeked.length > 0 && (
        <div className="plan__peek">
          <h3>{fmtDay(peek!)}</h3>
          <ul className="list">
            {peeked.map((t) => (
              <li key={t.id} className="plan__peekrow" data-stream={t.stream_id}>
                <button onClick={() => onOpenTask(t)}>
                  <span>{t.title}</span>
                  <span className="plan__peekwhere">{pathOf(sections, t.section_id)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>

      <p className="plan__foot">
        {left > 0 && (
          <>
            {left} {left === 1 ? 'item' : 'items'} still to place.
            {' '}<Link to="/dates">Some may already say when, in their own words.</Link>
          </>
        )}
        {passed.size > 0 && (
          <>
            {' '}{passed.size} passed over this sitting.
            <button className="linkish" onClick={() => setPassed(new Set())}>Bring them back</button>
          </>
        )}
      </p>
    </section>
  );
}

const countAt = (onDay: Map<string, Task[]>, iso: string) => onDay.get(iso)?.length ?? 0;
const loadAt = (week: { iso: string; load: number }[], iso: string) =>
  week.find((w) => w.iso === iso)?.load ?? 0;
