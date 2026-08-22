import { QUIET_SCALE_DAYS } from '@/data/store';

const R = 33;
const C = 2 * Math.PI * R;

/**
 * The recency dial.
 *
 * A count badge with a ring around it. The ring is full when the stream
 * was touched today and empties as it goes quiet, against a 21-day scale.
 * It measures time since last contact, not completion — deliberately, since
 * a congress has no denominator and any percentage-done figure would be
 * fiction.
 */
export function Dial({
  count,
  daysQuiet,
  empty,
}: {
  count: number | null;
  daysQuiet: number | null;
  empty?: boolean;
}) {
  const fraction =
    daysQuiet === null ? 0 : Math.max(0, 1 - Math.min(daysQuiet, QUIET_SCALE_DAYS) / QUIET_SCALE_DAYS);
  const arc = C * fraction;

  return (
    <div className="dial" aria-hidden="true">
      <svg viewBox="0 0 70 70">
        <circle
          className="dial__track"
          cx="35"
          cy="35"
          r={R}
          strokeDasharray={empty ? '5 9' : undefined}
        />
        {!empty && daysQuiet !== null && (
          <circle
            className="dial__arc"
            cx="35"
            cy="35"
            r={R}
            strokeDasharray={`${arc} ${C}`}
          />
        )}
      </svg>
      <div className={`dial__disc${count !== null && count > 99 ? ' dial__disc--sm' : ''}`}>
        {count === null ? '—' : count}
      </div>
    </div>
  );
}

/** How the dial's state reads in words, for the card and for screen readers. */
export function quietLabel(daysQuiet: number | null, hasItems: boolean): string {
  if (!hasItems) return 'awaiting data';
  if (daysQuiet === null) return 'not touched yet';
  if (daysQuiet === 0) return 'touched today';
  if (daysQuiet === 1) return 'quiet 1 day';
  return `quiet ${daysQuiet} days`;
}
