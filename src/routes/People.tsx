import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePeople, useTasks } from '@/data/store';
import { useTaskPeople } from '@/data/review';

/**
 * Who owes you what.
 *
 * A third of the register names a person, and a fifth of it cannot be
 * finished by working — only by someone else moving. This is the page to
 * open in the ten minutes before a 1:1.
 */
export function People() {
  const { data: people = [] } = usePeople();
  const { data: tasks = [] } = useTasks();
  const { data: links = [] } = useTaskPeople();

  const rows = useMemo(() => {
    const open = new Map(
      tasks.filter((t) => t.kind === 'task' && !t.done && !t.deleted_at).map((t) => [t.id, t]),
    );
    const byPerson = new Map<string, typeof tasks>();
    for (const l of links) {
      const t = open.get(l.task_id);
      if (t) byPerson.set(l.person_id, [...(byPerson.get(l.person_id) ?? []), t]);
    }

    const days = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

    return people
      .map((p) => {
        const mine = byPerson.get(p.id) ?? [];
        const oldest = mine
          .map((t) => days(t.touched_at ?? t.created_at))
          .sort((a, b) => b - a)[0] ?? 0;
        return {
          ...p,
          count: mine.length,
          oldest,
          urgent: mine.filter((t) => t.do_now || (t.due && new Date(t.due) < new Date())).length,
          streams: [...new Set(mine.map((t) => t.stream_id))],
        };
      })
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [people, tasks, links]);

  const total = rows.reduce((n, r) => n + r.count, 0);

  return (
    <section aria-labelledby="people-head">
      <div className="shead">
        <h2 id="people-head">Waiting on</h2>
        <span className="shead__meta">{total} items · {rows.length} people</span>
      </div>
      <p style={{ margin: '0 0 20px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6, maxWidth: '58ch' }}>
        Work that moves when somebody else does. Open one before a catch-up and go
        through it a card at a time.
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          <h3>Nobody owes you anything</h3>
          <p>Names are picked out of task titles when the register is seeded.</p>
        </div>
      ) : (
        <ul className="list">
          {rows.map((p, i) => (
            <li key={p.id}>
              <Link
                to={`/people/${p.id}`}
                className="person"
                data-stream={p.streams[0]}
                style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
              >
                <span className="person__disc">{p.count}</span>
                <span className="person__body">
                  <b>{p.name}</b>
                  {p.role && <span className="person__role">{p.role}</span>}
                  <span className="person__meta">
                    {p.oldest > 0 ? `oldest ${p.oldest}d` : 'all touched today'}
                    {p.urgent > 0 && ` · ${p.urgent} pressing`}
                  </span>
                </span>
                <span className="person__streams" aria-hidden="true">
                  {p.streams.slice(0, 3).map((s) => <i key={s} data-stream={s} />)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
