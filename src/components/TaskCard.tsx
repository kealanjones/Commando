import { memo, useRef } from 'react';
import { openedFrom } from '@/lib/expand';
import { useSelectedId } from '@/lib/selection';
import { isoDay } from '@/lib/today';
import type { Task } from '@/lib/types';

/** "28 AUG": a date in the margin, the way a diary is kept. */
const marginDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();

/**
 * A row of the register.
 *
 * Read left to right like a ledger line: when it is due, in the margin;
 * the box to tick; what it is; where it is filed; which stream. The whole
 * body opens the item. The checkbox keeps its own target and its own job.
 */
export const TaskCard = memo(function TaskCard({
  task,
  streamLabel,
  where,
  waitingOn,
  compact = false,
  index = 0,
  onToggle,
  onOpen,
}: {
  task: Task;
  streamLabel?: string;
  /** The section it is filed in, shown in its own column at a desk. */
  where?: string;
  waitingOn?: string[];
  /** Title, place and date only: for Today, where the row is a reminder. */
  compact?: boolean;
  index?: number;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  const overdue = Boolean(task.due && !task.done && task.due < isoDay(new Date()));
  const selected = useSelectedId() === task.id;
  const ref = useRef<HTMLLIElement>(null);

  const open = () => {
    // Hand the card the rectangle to grow out of (narrow screens).
    openedFrom(ref.current);
    onOpen(task);
  };

  return (
    <li
      ref={ref}
      className={`task${task.done ? ' task--done' : ''}`}
      data-stream={task.stream_id}
      data-task={task.id}
      data-selected={selected || undefined}
      style={{ animationDelay: `${Math.min(index, 8) * 0.025}s` }}
    >
      <span className={`task__due${overdue ? ' task__due--late' : ''}`}>
        {task.due ? marginDate(task.due) : ''}
      </span>

      <input
        type="checkbox"
        className="check"
        id={`t-${task.id}`}
        checked={task.done}
        onChange={() => onToggle(task)}
        aria-label={`${task.done ? 'Reopen' : 'Complete'}: ${task.title}`}
      />

      <button
        className="task__open"
        onClick={open}
        aria-label={`Open: ${task.title}`}
        aria-current={selected || undefined}
      >
        <span className="task__body">
          <span className="task__title">{task.title}</span>

          {!compact && task.context && <span className="task__context">{task.context}</span>}
          {!compact && task.note && <span className="task__note">{task.note}</span>}

          {((!compact && task.do_now) || (waitingOn && waitingOn.length > 0) || where) && (
            <span className="task__meta">
              {!compact && task.do_now && <span className="pill pill--flag">Urgent</span>}
              {where && <span className="task__wheresmall">{where}</span>}
              {waitingOn && waitingOn.length > 0 && (
                <span className="meta">waiting on <b>{waitingOn.join(', ')}</b></span>
              )}
            </span>
          )}
        </span>
        {where && <span className="task__where">{where}</span>}
        {streamLabel && <span className="pill task__code">{streamLabel}</span>}
      </button>
    </li>
  );
});
