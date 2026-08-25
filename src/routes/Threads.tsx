import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Close } from '@/components/icons';
import { useToast } from '@/components/Toasts';
import { useSections, useStreams, useTasks } from '@/data/store';
import {
  useAcceptThread, useDismissSuggestion, useRemoveFromThread, useSuggestions, useThreadsWithItems,
} from '@/data/threads';
import type { Suggestion } from '@/lib/grouping';
import type { Task } from '@/lib/types';

/**
 * Threads: strands running through the register that the sections miss.
 *
 * Suggestions arrive as proposals, never as changes. Each one lists exactly
 * what it would gather, everything pre-selected, and you take out whatever
 * does not belong before agreeing. Nothing moves section, and nothing is
 * grouped until you say so.
 */
export function Threads({ onOpenTask }: { onOpenTask: (t: Task) => void }) {
  const suggestions = useSuggestions(6);
  const existing = useThreadsWithItems();

  return (
    <section aria-labelledby="threads-head">
      <div className="shead">
        <h2 id="threads-head">Threads</h2>
        <span className="shead__meta">
          {existing.length} kept · {suggestions.length} suggested
        </span>
      </div>
      <p style={{ margin: '0 0 20px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6, maxWidth: '58ch' }}>
        Strands that run across sections. An item keeps where it is filed and gains a
        thread — nothing moves.
      </p>

      {suggestions.length > 0 && (
        <>
          <div className="shead" style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 15.5 }}>Does this hang together?</h2>
          </div>
          <ul className="list">
            {suggestions.map((s) => <Proposal key={s.signature} suggestion={s} />)}
          </ul>
        </>
      )}

      {existing.length > 0 && (
        <>
          <div className="shead" style={{ marginTop: 30 }}>
            <h2 style={{ fontSize: 15.5 }}>Kept</h2>
          </div>
          <ul className="list">
            {existing.map(({ thread, items, open, streams }) => (
              <li key={thread.id} className="thread" data-stream={streams[0]}>
                <div className="thread__top">
                  <b>{thread.title}</b>
                  <span className="meta">{open} open of {items.length}</span>
                </div>
                <ul className="thread__items">
                  {items.slice(0, 6).map((t) => (
                    <ThreadItem key={t.id} task={t} threadId={thread.id} onOpen={onOpenTask} />
                  ))}
                </ul>
                {items.length > 6 && <p className="meta" style={{ marginTop: 8 }}>…and {items.length - 6} more</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      {suggestions.length === 0 && existing.length === 0 && (
        <div className="empty">
          <h3>Nothing to group yet</h3>
          <p>
            Threads are suggested where the same name or subject turns up in several sections at
            once. As the register grows, they appear here.
          </p>
          <Link to="/streams" className="more" style={{ display: 'inline-block', marginTop: 16 }}>
            Browse the streams
          </Link>
        </div>
      )}
    </section>
  );
}

function ThreadItem({ task, threadId, onOpen }: { task: Task; threadId: string; onOpen: (t: Task) => void }) {
  const remove = useRemoveFromThread();
  return (
    <li className="thread__item" data-stream={task.stream_id}>
      <button onClick={() => onOpen(task)}>{task.title}</button>
      <button
        className="rowbtn"
        onClick={() => void remove(task.id, threadId)}
        aria-label={`Take out of this thread: ${task.title}`}
      >
        <Close />
      </button>
    </li>
  );
}

function Proposal({ suggestion }: { suggestion: Suggestion }) {
  const { data: sections = [] } = useSections();
  const { data: streams = [] } = useStreams();
  const accept = useAcceptThread();
  const dismiss = useDismissSuggestion();
  const { push } = useToast();

  const [title, setTitle] = useState(suggestion.label);
  const [out, setOut] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState(false);

  const sectionTitle = useMemo(() => new Map(sections.map((s) => [s.id, s.title])), [sections]);
  const streamShort = useMemo(() => new Map(streams.map((s) => [s.id, s.short])), [streams]);
  const { data: allTasks } = useSectionTasks(suggestion.taskIds);

  const keeping = allTasks.filter((t) => !out.has(t.id));

  if (gone) return null;

  const toggle = (id: string) =>
    setOut((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const commit = async () => {
    if (keeping.length < 2) return;
    await accept.mutateAsync({
      title, anchor: suggestion.label, taskIds: keeping.map((t) => t.id),
    });
    push({ message: `“${title}” kept — ${keeping.length} items.`, replaceKey: 'thread' });
    setGone(true);
  };

  const reject = async () => {
    await dismiss(suggestion.signature);
    push({ message: 'Not a thread. It will not be suggested again.', replaceKey: 'thread' });
    setGone(true);
  };

  return (
    <li className="prop" data-stream={suggestion.streams[0]}>
      <div className="prop__head">
        <input
          className="prop__name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Thread name"
        />
        <span className="prop__why">
          {suggestion.taskIds.length} items · {suggestion.sections} sections ·{' '}
          {suggestion.streams.map((s) => streamShort.get(s) ?? s).join(' and ')}
        </span>
      </div>

      <ul className="prop__items">
        {allTasks.map((t) => {
          const dropped = out.has(t.id);
          return (
            <li key={t.id} className={dropped ? 'prop__item prop__item--out' : 'prop__item'} data-stream={t.stream_id}>
              <label>
                <input type="checkbox" className="check" checked={!dropped} onChange={() => toggle(t.id)} />
                <span>
                  <b>{t.title}</b>
                  <i>{sectionTitle.get(t.section_id) ?? 'Unfiled'}</i>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="prop__actions">
        <span className="meta">
          {keeping.length < 2 ? 'Keep at least two' : `${keeping.length} will be grouped`}
        </span>
        <button className="btn btn--ghost" onClick={reject} style={{ flex: 'none' }}>Not a thread</button>
        <button
          className="btn btn--primary"
          onClick={commit}
          disabled={keeping.length < 2 || accept.isPending}
          style={{ flex: 'none' }}
        >
          Group these {keeping.length}
        </button>
      </div>
    </li>
  );
}

/** The tasks a suggestion refers to, in the order it proposed them. */
function useSectionTasks(ids: string[]): { data: Task[] } {
  const { data: tasks = [] } = useTasks();
  const data = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return ids.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t));
  }, [tasks, ids]);
  return { data };
}
