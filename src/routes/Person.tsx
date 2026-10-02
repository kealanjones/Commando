import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TaskCard } from '@/components/TaskCard';
import { ClearDone } from '@/components/ClearDone';
import { usePeople, useStreams, useTasks } from '@/data/store';
import { useTaskPeople } from '@/data/review';
import { lingers } from '@/lib/today';
import type { Task } from '@/lib/types';

/**
 * One person: everything open that names them, oldest first, and the two
 * things you do before a catch-up — copy a brief, or go through it one
 * item at a time.
 */
export function Person({
  onToggle,
  onOpen,
  onClearDone,
}: {
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onClearDone: (list: Task[]) => void;
}) {
  const { personId = '' } = useParams();
  const { data: people = [] } = usePeople();
  const { data: tasks = [] } = useTasks();
  const { data: streams = [] } = useStreams();
  const { data: links = [] } = useTaskPeople();

  const person = people.find((p) => p.id === personId);
  const streamCode = useMemo(() => new Map(streams.map((s) => [s.id, s.code])), [streams]);

  const theirs = useMemo(() => {
    const ids = new Set(links.filter((l) => l.person_id === personId).map((l) => l.task_id));
    // By when it was raised: ticking or editing a row touches it, and a
    // struck row has to stay where it was ticked.
    const age = (t: Task) => t.created_at;
    return tasks
      .filter((t) => ids.has(t.id) && !t.deleted_at && (!t.done || lingers(t)))
      .sort((a, b) => age(a).localeCompare(age(b)));
  }, [links, tasks, personId]);
  const struck = theirs.filter(lingers);
  const open = theirs.length - struck.length;

  return (
    <section aria-labelledby="person-head">
      <Link to="/people" className="back">← People</Link>

      <div className="stream__head">
        <div>
          <h2 id="person-head">{person?.name ?? 'Someone'}</h2>
          <p className="stream__meta">
            {person?.role ? `${person.role} · ` : ''}
            {open} open
          </p>
        </div>
        {theirs.length > 0 && (
          <div className="stream__acts">
            <ClearDone struck={struck} onClear={onClearDone} />
            <Link to={`/brief?person=${personId}`} className="btn btn--ghost">Brief</Link>
            {open > 0 && <Link to={`/people/${personId}/review`} className="btn btn--primary">Go through them</Link>}
          </div>
        )}
      </div>

      {theirs.length === 0 ? (
        <div className="empty">
          <h3>Nothing open</h3>
          <p>Nothing open names {person?.name ?? 'them'}.</p>
        </div>
      ) : (
        <ul className="list">
          {theirs.map((t, i) => (
            <TaskCard
              key={t.id}
              task={t}
              index={i}
              streamLabel={streamCode.get(t.stream_id)}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
