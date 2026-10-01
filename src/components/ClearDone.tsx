import { Num } from '@/components/Motion';
import type { Task } from '@/lib/types';

/**
 * Ticked items stay on the page, struck through, as a record of the day.
 * This takes them off when you are ready.
 */
export function ClearDone({ struck, onClear }: { struck: Task[]; onClear: (list: Task[]) => void }) {
  if (!struck.length) return null;
  return (
    <button type="button" className="cleardone" onClick={() => onClear(struck)}>
      Clear done <span className="cleardone__n"><Num value={struck.length} /></span>
    </button>
  );
}
