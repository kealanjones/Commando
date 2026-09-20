import { useEffect, useMemo, useState } from 'react';
import { useTasks } from '@/data/store';
import { compareWeeks, ringSegments, tally } from '@/lib/tally';
import type { Task } from '@/lib/types';

const R = 50;
const C = 2 * Math.PI * R;
/** More than this in a day and the beads are drawn as one bar with a count. */
const BEADS_MAX = 14;

/**
 * The tally.
 *
 * Two shapes for the two questions. The ring is today: every tick is a
 * wedge in the colour of the stream it came from, laid clockwise in the
 * order the day happened. The row is the week: a column of beads per day,
 * one bead per finished thing, today's column standing forward.
 *
 * Nothing here is a percentage. The register has no denominator — a
 * congress cannot be 40% done — so the tally counts what was finished and
 * lets the shape say whether that was a lot. A full ring is eight things;
 * past that the wedges divide and the number carries the growth.
 */
export function Tally({ compact = false }: { compact?: boolean }) {
  const { data: tasks = [] } = useTasks();
  const t = useMemo(() => tally(tasks), [tasks]);
  const n = t.today.length;
  const segs = useMemo(() => ringSegments(n), [n]);
  const compare = compareWeeks(t.weekTotal, t.lastWeekTotal);

  return (
    <section
      className={`tally${compact ? ' tally--compact' : ''}`}
      aria-label={`${n} done today, ${t.weekTotal} this week`}
      data-today={n}
    >
      <div className="tally__day">
        <svg className="tally__ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle className="tally__track" cx="60" cy="60" r={R} />
          {t.today.map((task, i) => (
            <Segment key={task.id} task={task} start={segs[i].start} length={segs[i].length} index={i} />
          ))}
        </svg>
        <div className="tally__centre">
          <Count n={n} />
          <span className="tally__label">{n === 0 ? 'nothing yet' : 'done today'}</span>
        </div>
      </div>

      <div className="tally__week">
        <ol className="tally__days">
          {t.days.map((d) => (
            <li
              key={d.iso}
              className="tally__col"
              data-today={d.isToday || undefined}
              data-future={d.isFuture || undefined}
              data-empty={d.items.length === 0 || undefined}
              style={{ '--n': Math.min(d.items.length, BEADS_MAX) } as React.CSSProperties}
              aria-label={`${d.name}: ${d.items.length} done`}
            >
              <span className="tally__stack">
                {d.items.length > BEADS_MAX ? (
                  <i className="tally__bar" data-stream={d.items[d.items.length - 1].stream_id}>
                    {d.items.length}
                  </i>
                ) : d.items.map((task, i) => (
                  <i
                    key={task.id}
                    className="tally__bead"
                    data-stream={task.stream_id}
                    style={{ '--i': i } as React.CSSProperties}
                  />
                ))}
                {d.items.length === 0 && !d.isFuture && <i className="tally__none" />}
              </span>
              <span className="tally__dow">{d.letter}</span>
            </li>
          ))}
        </ol>
        <p className="tally__sum">
          <b>{t.weekTotal}</b> this week
          {compare && <span className="tally__cmp"> · {compare}</span>}
          {!compare && t.best && !t.best.isToday && (
            <span className="tally__cmp"> · {t.best.name} was the big one</span>
          )}
        </p>
      </div>
    </section>
  );
}

/**
 * One wedge. It mounts at zero length and sweeps out to its place on the
 * next frame, so a tick you make now is drawn as it happens rather than
 * appearing already there.
 */
function Segment({ task, start, length, index }: { task: Task; start: number; length: number; index: number }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  const len = drawn ? length * C : 0;
  return (
    <circle
      className="tally__seg"
      data-stream={task.stream_id}
      cx="60" cy="60" r={R}
      strokeDasharray={`${len} ${C}`}
      strokeDashoffset={-start * C}
      style={{ transitionDelay: drawn ? `${Math.min(index, 8) * 45}ms` : '0ms' }}
    >
      <title>{task.title}</title>
    </circle>
  );
}

/** The number, re-keyed so it pops each time it changes. */
function Count({ n }: { n: number }) {
  return <b key={n} className="tally__n">{n}</b>;
}
