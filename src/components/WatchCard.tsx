import { useRef, useState } from 'react';
import { openedFrom } from '@/lib/expand';
import type { Task } from '@/lib/types';

/**
 * A periphery item.
 *
 * Dashed, tinted, shadowless — and with no checkbox anywhere on it. A
 * checkbox is a demand, and these items are not permitted to make demands.
 * "Make a task" is the only way out, and the conversion is the one piece of
 * motion in the app allowed to be noticeable.
 */
export function WatchCard({
  task,
  onPromote,
  onOpen,
}: {
  task: Task;
  onPromote: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  const [promoting, setPromoting] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  const promote = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return onPromote(task);
    setPromoting(true);
    window.setTimeout(() => onPromote(task), 560);
  };

  return (
    <li ref={ref} className={`watch${promoting ? ' watch--promoting' : ''}`} data-stream={task.stream_id}>
      <button
        onClick={() => { openedFrom(ref.current); onOpen(task); }}
        style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}
        aria-label={`Open: ${task.title}`}
      >
        <p>{task.title}</p>
      </button>
      <button className="watch__go" onClick={promote} disabled={promoting}>
        {promoting ? 'Moving' : 'Make a task'}
      </button>
    </li>
  );
}
