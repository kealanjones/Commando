import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { StreamCard } from '@/components/StreamCard';
import { TaskCard } from '@/components/TaskCard';
import { Tally } from '@/components/Tally';
import { WatchCard } from '@/components/WatchCard';
import { useHealth, useStreams, useTasks, useToday } from '@/data/store';
import { useReviewStatus } from '@/data/review';
import { useFocus, useRealm } from '@/lib/modes';
import type { Task } from '@/lib/types';

export function Today({
  onToggle,
  onOpen,
  onPromote,
  recentlyDone = [],
}: {
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onPromote: (t: Task) => void;
  /** Ticked in the last few seconds: held in place so undo makes sense. */
  recentlyDone?: string[];
}) {
  const health = useHealth();
  const { data: streams = [] } = useStreams();
  const { data: tasks = [], isLoading } = useTasks();
  const review = useReviewStatus();
  const realm = useRealm();
  const focus = useFocus();

  /**
   * With the switch on Both, Today is two zones — the work first, then a
   * shorter personal one — each ranked on its own, so a mortgage never
   * competes with a sponsor for a slot. On one realm the queries have
   * already narrowed the register and there is one list.
   */
  const both = realm === 'all';
  const main = useToday(3, recentlyDone, both ? 'work' : undefined);
  const side = useToday(2, recentlyDone, 'personal');
  const top = useMemo(
    () => (both ? [...main.top, ...side.top] : main.top),
    [both, main.top, side.top],
  );
  const flagged = both ? main.flagged + side.flagged : main.flagged;
  const restCount = both ? main.restCount + side.restCount : main.restCount;

  /**
   * Hold the list still while an undo is on offer.
   *
   * Ticking a task touches its stream, which un-quiets it, which re-ranks
   * everything — so without this the other two rows reshuffle under your
   * thumb the instant you complete something. `lastTop` carries the order
   * from the render before the tick, which is the one you were looking at.
   */
  const lastTop = useRef<string[]>([]);
  const frozen = useRef<string[] | null>(null);
  if (recentlyDone.length > 0 && frozen.current === null) frozen.current = lastTop.current;
  if (recentlyDone.length === 0 && frozen.current !== null) frozen.current = null;

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const shown = frozen.current?.length
    ? frozen.current.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t))
    : top;

  useEffect(() => {
    if (!frozen.current) lastTop.current = top.map((t) => t.id);
  });

  const streamCode = useMemo(() => new Map(streams.map((s) => [s.id, s.code])), [streams]);
  const personal = useMemo(
    () => new Set(health.filter((h) => h.realm === 'personal').map((h) => h.id)),
    [health],
  );
  const workRows = both ? shown.filter((t) => !personal.has(t.stream_id)) : shown;
  const personalRows = both ? shown.filter((t) => personal.has(t.stream_id)) : [];

  // Periphery items from streams that have gone quiet surface here first:
  // that is the whole point of watching them.
  const peek = useMemo(() => {
    const quiet = new Map(health.map((h) => [h.id, h.daysQuiet ?? 99]));
    return tasks
      .filter((t) => t.kind === 'watch')
      .sort((a, b) => (quiet.get(b.stream_id) ?? 0) - (quiet.get(a.stream_id) ?? 0))
      .slice(0, 3);
  }, [tasks, health]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 168 }} />
        <div className="skeleton" style={{ height: 74 }} />
        <div className="skeleton" style={{ height: 74 }} />
        <div className="skeleton" style={{ height: 74 }} />
      </div>
    );
  }

  const rows = (list: Task[], offset = 0) => list.map((t, i) => (
    <TaskCard
      key={t.id}
      task={t}
      index={i + offset}
      streamLabel={streamCode.get(t.stream_id)}
      onToggle={onToggle}
      onOpen={onOpen}
    />
  ));

  return (
    <>
      {!focus && (
        <div className="rail" style={{ '--rail-n': health.length } as React.CSSProperties}>
          {health.map((h, i) => <StreamCard key={h.id} health={h} index={i} />)}
        </div>
      )}

      {!focus && review.waiting > 0 && (
        <div className="prompt">
          <div>
            <h3>
              {review.session} decision{review.session === 1 ? '' : 's'} to make
            </h3>
            <p>
              {[
                review.reasons.overdue && `${review.reasons.overdue} overdue`,
                review.reasons.unfinishable && `${review.reasons.unfinishable} with no finish line`,
                review.reasons.urgent_undated && `${review.reasons.urgent_undated} urgent but undated`,
                review.reasons.stale && `${review.reasons.stale} gone quiet`,
              ].filter(Boolean).join(' · ')}
              {review.waiting > review.session && ` — ${review.waiting} waiting in all`}
            </p>
          </div>
          <Link to="/review">Start</Link>
        </div>
      )}

      {!focus && review.waiting === 0 && review.unclear > 0 && (
        <div className="prompt">
          <div>
            <h3>{review.unclear} parked as unclear</h3>
            <p>Things you set aside because you did not know what they meant.</p>
          </div>
          <Link to="/review?mode=unclear">Look again</Link>
        </div>
      )}

      {!focus && main.datedCount <= 1 && main.openCount > 20 && (
        <div className="nudge">
          <span className="nudge__dot" />
          <p>
            {main.datedCount === 0 ? (
              <>
                Nothing in the register has a date. <b>{main.openCount}</b> open items, all
                equally urgent — which is to say none of them are.
              </>
            ) : (
              <>
                <b>{main.datedCount}</b> of {main.openCount} open items{' '}
                {main.datedCount === 1 ? 'carries' : 'carry'} a date — which is why everything
                feels equally urgent.
              </>
            )}
          </p>
          <Link
            to="/dates"
            style={{
              flex: 'none', textDecoration: 'none', background: 'var(--ink)', color: '#fff',
              padding: '7px 13px', borderRadius: 999, fontFamily: 'var(--data)',
              fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase',
            }}
          >
            Read them back
          </Link>
        </div>
      )}

      <section aria-labelledby="today-head" className="today">
        <div className="shead">
          <h2 id="today-head">Today</h2>
          <span className="shead__meta">
            {flagged > 0
              ? `${shown.filter((t) => !t.done).length} of ${flagged} flagged`
              : `${shown.filter((t) => !t.done).length} pressing`}
          </span>
        </div>

        {shown.length === 0 ? (
          <div className="empty">
            <h3>Nothing is pressing</h3>
            <p>No dates closing and nothing flagged. Browse a stream when you have a window.</p>
          </div>
        ) : both ? (
          <>
            <h3 className="zone" data-realm="work">Work</h3>
            {workRows.length > 0
              ? <ul className="list">{rows(workRows)}</ul>
              : <p className="zone__none">Nothing pressing at work.</p>}
            <h3 className="zone" data-realm="personal">Personal</h3>
            {personalRows.length > 0
              ? <ul className="list">{rows(personalRows, workRows.length)}</ul>
              : <p className="zone__none">Nothing personal pressing.</p>}
          </>
        ) : (
          <ul className="list">{rows(shown)}</ul>
        )}

        {restCount > 0 && (
          <Link to="/streams?filter=donow" className="more" style={{ textDecoration: 'none', display: 'inline-block' }}>
            {restCount} more flagged →
          </Link>
        )}
      </section>

      <Tally compact={focus} />

      {!focus && peek.length > 0 && (
        <section aria-labelledby="peek-head" className="peekat" style={{ marginTop: 30 }}>
          <div className="shead">
            <h2 id="peek-head">Keeping an eye on</h2>
            <Link to="/periphery" className="shead__meta" style={{ textDecoration: 'none' }}>
              All →
            </Link>
          </div>
          <ul className="list">
            {peek.map((t) => (
              <WatchCard key={t.id} task={t} onPromote={onPromote} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
