import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Chevron } from '@/components/icons';
import { Dial, quietLabel } from '@/components/Dial';
import { TaskCard } from '@/components/TaskCard';
import { WatchCard } from '@/components/WatchCard';
import { useHealth, usePeople, useSections, useStreams, useTasks } from '@/data/store';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import type { Task } from '@/lib/types';

type Filter = 'all' | 'donow' | 'undated' | 'done';

/** Everything lives here: browse by stream, then by section. */
export function Streams({
  onToggle,
  onOpen,
  onPromote,
}: {
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onPromote: (t: Task) => void;
}) {
  const { streamId } = useParams();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as Filter) ?? 'all';
  const person = params.get('person');

  const health = useHealth();
  const { data: streams = [] } = useStreams();
  const { data: sections = [] } = useSections();
  const { data: tasks = [] } = useTasks();
  const { data: people = [] } = usePeople();

  const { data: links = [] } = useQuery({
    queryKey: ['task_people'],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_people').select('task_id,person_id');
      if (error) throw error;
      return data as { task_id: string; person_id: string }[];
    },
    staleTime: 5 * 60_000,
  });

  const waitingFor = useMemo(() => {
    const nameOf = new Map(people.map((p) => [p.id, p.name]));
    const m = new Map<string, string[]>();
    for (const l of links) {
      const n = nameOf.get(l.person_id);
      if (!n) continue;
      m.set(l.task_id, [...(m.get(l.task_id) ?? []), n]);
    }
    return m;
  }, [links, people]);

  const personCounts = useMemo(() => {
    const open = new Set(tasks.filter((t) => !t.done && t.kind === 'task').map((t) => t.id));
    const c = new Map<string, number>();
    for (const l of links) if (open.has(l.task_id)) c.set(l.person_id, (c.get(l.person_id) ?? 0) + 1);
    return c;
  }, [links, tasks]);

  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params);
    if (f === 'all') next.delete('filter'); else next.set('filter', f);
    setParams(next, { replace: true });
  };

  const setPerson = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (!id || id === person) next.delete('person'); else next.set('person', id);
    setParams(next, { replace: true });
  };

  const matches = (t: Task) => {
    if (t.kind !== 'task') return false;
    if (person && !links.some((l) => l.task_id === t.id && l.person_id === person)) return false;
    switch (filter) {
      case 'donow':   return !t.done && t.do_now;
      case 'undated': return !t.done && !t.due;
      case 'done':    return t.done;
      default:        return !t.done;
    }
  };

  const visibleStreams = streamId ? health.filter((h) => h.id === streamId) : health;
  const current = streamId ? streams.find((s) => s.id === streamId) : null;

  return (
    <>
      {current && (
        <Link
          to="/streams"
          className="shead__meta"
          style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}
        >
          ← All streams
        </Link>
      )}

      <div className="filters" role="group" aria-label="Filter">
        {([
          ['all', 'Open'],
          ['donow', 'Do now'],
          ['undated', 'No date'],
          ['done', 'Done'],
        ] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            className="chip"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {label}
          </button>
        ))}
      </div>

      {people.some((p) => (personCounts.get(p.id) ?? 0) > 0) && (
      <div className="filters" role="group" aria-label="Waiting on">
        {people
          .filter((p) => (personCounts.get(p.id) ?? 0) > 0)
          .sort((a, b) => (personCounts.get(b.id) ?? 0) - (personCounts.get(a.id) ?? 0))
          .map((p) => (
            <button
              key={p.id}
              className="chip"
              aria-pressed={person === p.id}
              onClick={() => setPerson(p.id)}
            >
              <span className="chip__dot" />
              {p.name}
              <span className="chip__n">{personCounts.get(p.id)}</span>
            </button>
          ))}
      </div>
      )}

      {visibleStreams.map((h) => {
        const mySections = sections.filter((s) => s.stream_id === h.id);
        const rows = tasks.filter((t) => t.stream_id === h.id && matches(t));
        const watch = tasks.filter((t) => t.stream_id === h.id && t.kind === 'watch');
        if (rows.length === 0 && watch.length === 0 && (person || filter !== 'all')) return null;

        return (
          <section key={h.id} data-stream={h.id} style={{ marginBottom: 34 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16,
                background: 'var(--s-tint)', borderRadius: 'var(--r-panel)', padding: 14,
              }}
            >
              <Dial
                count={h.openTasks + h.doneTasks + h.watchItems === 0 ? null : h.openTasks}
                daysQuiet={h.daysQuiet}
                empty={h.openTasks + h.doneTasks + h.watchItems === 0}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-.03em' }}>
                  {streamId ? h.short : <Link to={`/streams/${h.id}`}>{h.short}</Link>}
                </h2>
                {streamId && h.title !== h.short && (
                  <div className="scard__q" style={{ marginTop: 3 }}>{h.title}</div>
                )}
                <div className="scard__q" style={{ marginTop: 4 }}>
                  {quietLabel(h.daysQuiet, h.openTasks + h.doneTasks + h.watchItems > 0)}
                  {h.watchItems > 0 && ` · ${h.watchItems} in the periphery`}
                </div>
              </div>
            </div>

            {mySections.map((sec) => {
              const items = rows.filter((t) => t.section_id === sec.id);
              if (!items.length) return null;
              return (
                <SectionBlock
                  key={sec.id}
                  title={sec.title}
                  monitor={sec.monitor}
                  count={items.length}
                  streamId={h.id}
                >
                  <ul className="list" style={{ paddingBottom: 16 }}>
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
            })}

            {rows.length === 0 && (
              <div className="empty">
                <h3>Nothing here</h3>
                <p>No items match this filter in {h.title}.</p>
              </div>
            )}

            {streamId && watch.length > 0 && (
              <SectionBlock title="Keeping an eye on" count={watch.length} streamId={h.id}>
                <ul className="list" style={{ paddingBottom: 16 }}>
                  {watch.map((t) => (
                    <WatchCard key={t.id} task={t} onPromote={onPromote} onOpen={onOpen} />
                  ))}
                </ul>
              </SectionBlock>
            )}
          </section>
        );
      })}
    </>
  );
}

function SectionBlock({
  title, count, monitor, streamId, children,
}: {
  title: string; count: number; monitor?: boolean; streamId: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const id = `sec-${streamId}-${title.replace(/\W+/g, '-')}`;
  return (
    <div className="sectionblock">
      <button
        className="sectionblock__head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <Chevron />
        <h3>{title}</h3>
        {monitor && <span className="pill pill--flag">monitor</span>}
        <span className="shead__meta">{count}</span>
      </button>
      <div className="collapse" data-open={open} id={id}>
        <div>{children}</div>
      </div>
    </div>
  );
}
