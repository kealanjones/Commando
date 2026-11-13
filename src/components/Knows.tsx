import { Link } from 'react-router-dom';
import { useRelevant } from '@/data/memory';

/**
 * What the memory knows that bears on the thing in front of you: its
 * project, the people on it, any topic its words name. Each links to the
 * full note. Renders nothing when the memory has nothing to add.
 */
export function Knows({ streamId, people, text, max = 3, className = '', heading = 'What it knows', style }: {
  streamId?: string | null; people?: string[]; text?: string; max?: number; className?: string;
  style?: React.CSSProperties;
  /** Empty for places that supply their own heading. */
  heading?: string;
}) {
  // A note with nothing in it yet has nothing to say here.
  const notes = useRelevant({ streamId, people, text }, max + 4).filter((n) => n.now.trim()).slice(0, max);
  if (!notes.length) return null;
  return (
    <aside className={`knows ${className}`} style={style} aria-label="What the memory knows">
      {heading && <span className="label knows__head">{heading}</span>}
      <ul>
        {notes.map((n) => (
          <li key={n.id} data-kind={n.kind}>
            <Link to={`/memory?note=${n.id}`} className="knows__title">{n.title}</Link>
            <p>{n.now}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
