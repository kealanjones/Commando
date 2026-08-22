import { memo } from 'react';
import { Dots } from './icons';
import type { Task } from '@/lib/types';

const fmtDue = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export const TaskCard = memo(function TaskCard({
  task,
  streamLabel,
  waitingOn,
  index = 0,
  onToggle,
  onOpen,
}: {
  task: Task;
  streamLabel?: string;
  waitingOn?: string[];
  index?: number;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  const overdue = task.due ? daysUntil(task.due) < 0 : false;

  return (
    <li
      className={`task${task.done ? ' task--done' : ''}`}
      data-stream={task.stream_id}
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

      <div className="task__body">
        <label className="task__title" htmlFor={`t-${task.id}`}>
          {task.title}
        </label>

        {task.context && <p className="task__context">{task.context}</p>}
        {task.note && <p className="task__note">{task.note}</p>}

        <div className="task__meta">
          {streamLabel && <span className="pill">{streamLabel}</span>}
          {task.due && (
            <span className={overdue ? 'pill pill--due' : 'pill pill--flag'}>
              {overdue ? 'overdue ' : 'due '}
              {fmtDue(task.due)}
            </span>
          )}
          {!task.due && task.do_now && <span className="pill pill--flag">do now</span>}
          {waitingOn && waitingOn.length > 0 && (
            <span className="meta">
              waiting on <b>{waitingOn.join(', ')}</b>
            </span>
          )}
        </div>
      </div>

      <button className="rowbtn" onClick={() => onOpen(task)} aria-label={`Edit: ${task.title}`}>
        <Dots />
      </button>
    </li>
  );
});
