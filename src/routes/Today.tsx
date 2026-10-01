import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TaskCard } from '@/components/TaskCard';
import { Num } from '@/components/Motion';
import { useSections, useStreams, useToday } from '@/data/store';
import type { Task } from '@/lib/types';

/** Urgent items shown before the rest fold behind a "show more". */
const URGENT_SHOWN = 5;

/**
 * Today: what is overdue, what is due today, what you flagged urgent.
 * One list, three headings, and a count at the bottom.
 */
export function Today({
  onToggle,
  onOpen,
  recentlyDone = [],
}: {
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  /** Ticked in the last few seconds: held in place so undo makes sense. */
  recentlyDone?: string[];
}) {
  const { data: streams = [] } = useStreams();
  const { data: sections = [] } = useSections();
  const { overdue, today, urgent, toDo, doneToday, isLoading } = useToday(recentlyDone);
  const [allUrgent, setAllUrgent] = useState(false);

  const streamCode = useMemo(() => new Map(streams.map((s) => [s.id, s.code])), [streams]);
  const sectionTitle = useMemo(() => new Map(sections.map((s) => [s.id, s.title])), [sections]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton" style={{ height: 64 }} />
        <div className="skeleton" style={{ height: 64 }} />
        <div className="skeleton" style={{ height: 64 }} />
      </div>
    );
  }

  const group = (id: string, title: string, list: Task[], total: number, tone?: 'due') =>
    list.length > 0 && (
      <section className="tgroup" aria-labelledby={`tg-${id}`} data-tone={tone}>
        <h2 className="tgroup__head" id={`tg-${id}`}>
          {title}
          <span className="tgroup__n"><Num value={total} /></span>
        </h2>
        <ul className="list">
          {list.map((t, i) => (
            <TaskCard
              key={t.id}
              task={t}
              index={i}
              streamLabel={streamCode.get(t.stream_id)}
              where={sectionTitle.get(t.section_id)}
              compact
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </section>
    );

  const open = (list: Task[]) => list.filter((t) => !t.done).length;
  const urgentShown = allUrgent ? urgent : urgent.slice(0, URGENT_SHOWN);
  const urgentHidden = urgent.length - urgentShown.length;
  const nothing = overdue.length + today.length + urgent.length === 0;

  return (
    <div className="today">
      <header className="shead">
        <h2>Today</h2>
        <p className="shead__meta tcount" aria-live="polite">
          <b><Num value={toDo} /></b> to do · <b><Num value={doneToday} /></b> done today
        </p>
      </header>

      <ColumnHead />

      {nothing ? (
        <div className="empty">
          <h3>Nothing due, nothing urgent</h3>
          <p>
            Nothing is overdue, due today or flagged urgent.{' '}
            <Link to="/streams" className="inline">See everything</Link>
          </p>
        </div>
      ) : (
        <>
          {group('overdue', 'Overdue', overdue, open(overdue), 'due')}
          {group('today', 'Today', today, open(today))}
          {group('urgent', 'Urgent', urgentShown, open(urgent))}
          {urgentHidden > 0 && (
            <button className="more" onClick={() => setAllUrgent(true)}>
              {urgentHidden} more urgent
            </button>
          )}
        </>
      )}


    </div>
  );
}

/** The ledger's column heads, shown at a desk where the columns exist. */
export function ColumnHead({ second = 'Item' }: { second?: string }) {
  return (
    <div className="colhead" aria-hidden="true">
      <span>Due</span><span /><span>{second}</span><span>Filed under</span><span>Stream</span>
    </div>
  );
}
