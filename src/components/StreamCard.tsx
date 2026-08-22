import { Link } from 'react-router-dom';
import { Dial, quietLabel } from './Dial';
import type { StreamHealth } from '@/lib/types';

export function StreamCard({ health, index }: { health: StreamHealth; index: number }) {
  const total = health.openTasks + health.doneTasks + health.watchItems;
  const empty = total === 0;
  const label = quietLabel(health.daysQuiet, !empty);

  const inner = (
    <>
      <Dial count={empty ? null : health.openTasks} daysQuiet={health.daysQuiet} empty={empty} />
      <div>
        <span className="scard__name">{health.short}</span>
        <span className="scard__q">{label}</span>
      </div>
    </>
  );

  const style = { animationDelay: `${index * 0.05}s` } as const;

  if (empty) {
    return (
      <div
        className="scard scard--empty"
        data-stream={health.id}
        style={style}
        role="group"
        aria-label={`${health.title}, ${label}`}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={`/streams/${health.id}`}
      className="scard"
      data-stream={health.id}
      style={style}
      aria-label={`${health.title}, ${health.openTasks} open, ${label}`}
    >
      {inner}
    </Link>
  );
}
