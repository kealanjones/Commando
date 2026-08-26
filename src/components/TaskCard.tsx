import { memo, useRef } from 'react';
import { openedFrom } from '@/lib/expand';
import type { Task } from '@/lib/types';

const fmtDue = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/**
 * A row, and the thing it becomes.
 *
 * The whole body opens the item — a small dots button was a target you had
 * to aim at, and on a phone the natural gesture is to touch the thing you
 * are reading. The checkbox keeps its own target and its own job: the title
 * no longer ticks it, because a tap on a title now means "show me this",
 * and one gesture cannot mean two things.
 */
export const TaskCard = memo(function TaskCard({
  task,
  streamLabel,
  waitingOn,
  threads,
  index = 0,
  onToggle,
  onOpen,
}: {
  task: Task;
  streamLabel?: string;
  waitingOn?: string[];
  threads?: string[];
  index?: number;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  const overdue = task.due ? daysUntil(task.due) < 0 : false;
  const ref = useRef<HTMLLIElement>(null);

  const open = () => {
    // Hand the card the rectangle to grow out of.
    openedFrom(ref.current);
    onOpen(task);
  };

  return (
    <li
      ref={ref}
      className={`task${task.done ? ' task--done' : ''}`}
      data-stream={task.stream_id}
      data-task={task.id}
      style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
    >
      <input
        type="checkbox"
        className="check"
        id={`t-${task.id}`}
        checked={task.done}
        onChange={() => onToggle(task)}
        aria-label={`${task.done ? 'Reopen' : 'Complete'}: ${task.title}`}
      />

      <button className="task__open" onClick={open} aria-label={`Open: ${task.title}`}>
        <span className="task__body">
          <span className="task__title">{task.title}</span>

          {task.context && <span className="task__context">{task.context}</span>}
          {task.note && <span className="task__note">{task.note}</span>}

          <span className="task__meta">
            {streamLabel && <span className="pill">{streamLabel}</span>}
            {task.due && (
              <span className={overdue ? 'pill pill--due' : 'pill pill--flag'}>
                {overdue ? 'overdue ' : 'due '}
                {fmtDue(task.due)}
              </span>
            )}
            {!task.due && task.do_now && <span className="pill pill--flag">do now</span>}
            {task.unclear && <span className="pill">unclear</span>}
            {threads?.map((t) => (
              <span className="threadchip" key={t}>{t}</span>
            ))}
            {waitingOn && waitingOn.length > 0 && (
              <span className="meta">
                waiting on <b>{waitingOn.join(', ')}</b>
              </span>
            )}
          </span>
        </span>
        <span className="task__chevron" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </button>
    </li>
  );
});
