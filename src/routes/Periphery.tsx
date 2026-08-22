import { useMemo } from 'react';
import { WatchCard } from '@/components/WatchCard';
import { useHealth, useSections, useStreams, useTasks } from '@/data/store';
import type { Task } from '@/lib/types';

/**
 * The remembering register.
 *
 * Deliberately its own destination. Nothing here can be ticked, and nothing
 * here appears on Today — that separation is the point. Ordered by how quiet
 * the parent stream has gone, so the things drifting out of view rise.
 */
export function Periphery({
  onOpen,
  onPromote,
}: {
  onOpen: (t: Task) => void;
  onPromote: (t: Task) => void;
}) {
  const { data: tasks = [] } = useTasks();
  const { data: streams = [] } = useStreams();
  const { data: sections = [] } = useSections();
  const health = useHealth();

  const grouped = useMemo(() => {
    const quiet = new Map(health.map((h) => [h.id, h.daysQuiet ?? 99]));
    const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));
    return streams
      .map((s) => ({
        stream: s,
        quiet: quiet.get(s.id) ?? null,
        items: tasks
          .filter((t) => t.kind === 'watch' && t.stream_id === s.id)
          .sort((a, b) => (sectionTitle.get(a.section_id) ?? '').localeCompare(sectionTitle.get(b.section_id) ?? '')),
      }))
      .filter((g) => g.items.length > 0)
      .sort((a, b) => (b.quiet ?? 0) - (a.quiet ?? 0));
  }, [tasks, streams, sections, health]);

  const total = grouped.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <div className="shead">
        <h2>Keeping an eye on</h2>
        <span className="shead__meta">{total} items · no action</span>
      </div>
      <p style={{ margin: '0 0 20px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6, maxWidth: '58ch' }}>
        Things that must stay in view and must not ask anything of you today. None of these can be
        ticked. When one needs doing, make it a task and it moves into its stream.
      </p>

      {total === 0 ? (
        <div className="empty">
          <h3>Nothing in the periphery</h3>
          <p>
            Items you keep here stay visible without demanding anything. Add one, or switch an
            existing item to “keep in the periphery”.
          </p>
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.stream.id} data-stream={g.stream.id} style={{ marginBottom: 28 }}>
            <div className="shead">
              <h2 style={{ fontSize: 15.5 }}>{g.stream.short}</h2>
              <span className="shead__meta">
                {g.quiet === null ? 'not touched yet' : g.quiet === 0 ? 'touched today' : `quiet ${g.quiet}d`}
              </span>
            </div>
            <ul className="list">
              {g.items.map((t) => (
                <WatchCard key={t.id} task={t} onPromote={onPromote} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
