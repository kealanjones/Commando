import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Chevron } from '@/components/icons';
import { TaskCard } from '@/components/TaskCard';
import { Num } from '@/components/Motion';
import { ClearDone } from '@/components/ClearDone';
import { useHealth, usePeople, useSections, useTasks } from '@/data/store';
import { useTaskPeople } from '@/data/review';
import { lingers } from '@/lib/today';
import { branchesFor } from '@/lib/tree';
import { useRealm } from '@/lib/modes';
import type { Realm, Section, StreamHealth, Task } from '@/lib/types';

/**
 * The breakdown of everything.
 *
 *   /streams      one line per stream: how much is open, what is pressing
 *   /streams/:id  that stream, area by area, section by section
 */
export function Streams({
  onToggle,
  onOpen,
  onClearDone,
}: {
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onClearDone: (list: Task[]) => void;
}) {
  const { streamId } = useParams();
  const health = useHealth();
  const stream = streamId ? health.find((h) => h.id === streamId) : undefined;
  if (streamId && stream) return <StreamDetail stream={stream} onToggle={onToggle} onOpen={onOpen} onClearDone={onClearDone} />;
  return <StreamIndex health={health} />;
}

function quiet(days: number | null): string {
  if (days === null) return 'not touched yet';
  if (days === 0) return 'touched today';
  if (days === 1) return 'touched yesterday';
  return `quiet ${days} days`;
}

function StreamIndex({ health }: { health: StreamHealth[] }) {
  const realm = useRealm();
  return (
    <section aria-labelledby="streams-head">
      <div className="shead">
        <h2 id="streams-head">Streams</h2>
        <span className="shead__meta">
          {health.reduce((n, h) => n + h.openTasks, 0)} open
        </span>
      </div>
      <div className="colhead colhead--streams" aria-hidden="true">
        <span>Code</span><span>Stream</span><span>Open</span>
      </div>
      <ul className="list">
        {health.map((h, i) => {
          // With both lives showing, a word marks where one ends.
          const before: Realm | undefined = health[i - 1]?.realm;
          const zone = realm === 'all' && before !== h.realm;
          return (
            <li key={h.id}>
              {zone && (
                <h3 className="zone" data-realm={h.realm}>
                  {h.realm === 'work' ? 'Work' : 'Personal'}
                </h3>
              )}
              <Link to={`/streams/${h.id}`} className="srow" data-stream={h.id}>
                <span className="srow__code">{h.code}</span>
                <span className="srow__body">
                  <b>{h.title}</b>
                  <span className="srow__meta">
                    {h.overdue > 0 && <span className="srow__due">{h.overdue} overdue</span>}
                    {h.doNow > 0 && <span>{h.doNow} urgent</span>}
                    <span>{quiet(h.daysQuiet)}</span>
                  </span>
                </span>
                <span className="srow__n"><Num value={h.openTasks} /></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type Filter = 'open' | 'done';

function StreamDetail({
  stream,
  onToggle,
  onOpen,
  onClearDone,
}: {
  stream: StreamHealth;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onClearDone: (list: Task[]) => void;
}) {
  const [params, setParams] = useSearchParams();
  const filter: Filter = params.get('filter') === 'done' ? 'done' : 'open';

  const { data: sections = [] } = useSections();
  const { data: tasks = [] } = useTasks();
  const { data: people = [] } = usePeople();
  const { data: links = [] } = useTaskPeople();

  const waitingFor = useMemo(() => {
    const nameOf = new Map(people.map((p) => [p.id, p.name]));
    const m = new Map<string, string[]>();
    for (const l of links) {
      const n = nameOf.get(l.person_id);
      if (n) m.set(l.task_id, [...(m.get(l.task_id) ?? []), n]);
    }
    return m;
  }, [links, people]);

  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params);
    if (f === 'open') next.delete('filter'); else next.set('filter', f);
    setParams(next, { replace: true });
  };

  const mySections = sections.filter((s) => s.stream_id === stream.id);
  // Open keeps today's ticks on show, struck through, until they are cleared.
  const rows = tasks.filter((t) => t.stream_id === stream.id && !t.deleted_at
    && (filter === 'done' ? t.done : !t.done || lingers(t)));
  const struck = filter === 'open' ? rows.filter(lingers) : [];

  const cards = (sec: Section) => {
    const items = rows.filter((t) => t.section_id === sec.id);
    if (!items.length) return null;
    return (
      <SectionBlock key={sec.id} id={sec.id} title={sec.title} count={items.length}>
        <ul className="list">
          {items.map((t, i) => (
            <TaskCard
              key={t.id}
              task={t}
              index={i}
              waitingOn={waitingFor.get(t.id)}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </SectionBlock>
    );
  };

  return (
    <section data-stream={stream.id} aria-labelledby="stream-head">
      <Link to="/streams" className="back">← Streams</Link>

      <div className="stream__head">
        <div>
          <h2 id="stream-head">{stream.title}</h2>
          <p className="stream__meta">
            {stream.openTasks} open
            {stream.overdue > 0 && ` · ${stream.overdue} overdue`}
            {stream.doNow > 0 && ` · ${stream.doNow} urgent`}
            {` · ${quiet(stream.daysQuiet)}`}
          </p>
        </div>
        <div className="stream__acts">
          <ClearDone struck={struck} onClear={onClearDone} />
          <Link to={`/brief?stream=${stream.id}`} className="btn btn--ghost">Brief</Link>
        </div>
      </div>

      <div className="seg stream__filter" role="group" aria-label="Show">
        <button type="button" aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Open</button>
        <button type="button" aria-pressed={filter === 'done'} onClick={() => setFilter('done')}>Done</button>
      </div>

      {branchesFor(mySections, stream.id).map((branch) => {
        // A bare section sits at the top level on its own.
        if (!branch.children.length) return cards(branch.node);

        const total = branch.children.reduce(
          (n, c) => n + rows.filter((t) => t.section_id === c.id).length, 0,
        );
        if (!total) return null;

        return (
          <GroupBlock
            key={branch.node.id}
            title={branch.node.title}
            count={total}
            sections={branch.children.filter((c) => rows.some((t) => t.section_id === c.id)).length}
          >
            {branch.children.map(cards)}
          </GroupBlock>
        );
      })}

      {rows.length === 0 && (
        <div className="empty">
          <h3>{filter === 'done' ? 'Nothing finished yet' : 'Nothing open'}</h3>
          <p>{filter === 'done' ? `Nothing in ${stream.title} has been ticked.` : `${stream.title} is clear.`}</p>
        </div>
      )}
    </section>
  );
}

/** An area: a heading over the sections inside it. Open by default. */
function GroupBlock({
  title, count, sections, children,
}: {
  title: string; count: number; sections: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const id = `grp-${title.replace(/\W+/g, '-')}`;
  return (
    <div className="groupblock">
      <button
        className="groupblock__head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <Chevron />
        <h3>{title}</h3>
        <span className="groupblock__meta">
          {count} in {sections} section{sections === 1 ? '' : 's'}
        </span>
      </button>
      <div className="collapse" data-open={open} id={id}>
        <div className="groupblock__body">{children}</div>
      </div>
      <div className="total">
        <span>Total</span><span>{count}</span>
      </div>
    </div>
  );
}

function SectionBlock({
  id, title, count, children,
}: {
  id: string; title: string; count: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="sectionblock">
      <button
        className="sectionblock__head"
        aria-expanded={open}
        aria-controls={`sec-${id}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Chevron />
        <h3>{title}</h3>
        <span className="shead__meta">{count}</span>
      </button>
      <div className="collapse" data-open={open} id={`sec-${id}`}>
        <div>{children}</div>
      </div>
    </div>
  );
}
