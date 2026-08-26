import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Close } from './icons';
import { usePeople, useSections, useStreams, useTasks } from '@/data/store';
import { useTaskPeople } from '@/data/review';
import { highlight, search } from '@/lib/search';
import { pathOf } from '@/lib/tree';
import type { Task } from '@/lib/types';

/**
 * Find anything, from anywhere.
 *
 * Runs over the already-cached task list, so it works with no signal and
 * returns as you type. Ranked rather than filtered — with 255 items a plain
 * substring match buries the thing you meant.
 */
export function Search({ onOpenTask, onClose }: { onOpenTask: (t: Task) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);

  const { data: tasks = [] } = useTasks();
  const { data: sections = [] } = useSections();
  const { data: streams = [] } = useStreams();
  const { data: people = [] } = usePeople();
  const { data: links = [] } = useTaskPeople();
  const navigate = useNavigate();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const hits = useMemo(
    () => search(q, tasks, sections, streams, people, links),
    [q, tasks, sections, streams, people, links],
  );

  useEffect(() => setCursor(0), [q]);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      returnTo.current?.focus?.();
    };
  }, []);

  const choose = useCallback(
    (task: Task) => { onClose(); onOpenTask(task); },
    [onClose, onOpenTask],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((n) => Math.min(n + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((n) => Math.max(n - 1, 0)); }
    else if (e.key === 'Enter' && hits[cursor]) { e.preventDefault(); choose(hits[cursor].task); }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const jump = (to: string) => { onClose(); navigate(to); };

  return (
    <div className="scrim scrim--top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="find" role="dialog" aria-modal="true" aria-label="Search the register">
        <div className="find__bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className="find__input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search titles, notes, sections, people…"
            aria-label="Search"
            aria-controls="find-results"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="rowbtn" onClick={onClose} aria-label="Close search"><Close /></button>
        </div>

        {q.trim() === '' ? (
          <div className="find__hint">
            <p>Search everything — task titles, your notes, the detail from the seed, section names, and who you are waiting on.</p>
            <div className="find__jumps">
              <button className="chip" onClick={() => jump('/streams?filter=donow')}>Everything flagged</button>
              <button className="chip" onClick={() => jump('/streams?filter=undated')}>Nothing dated</button>
              <button className="chip" onClick={() => jump('/people')}>Waiting on</button>
              <button className="chip" onClick={() => jump('/review?mode=unclear')}>Parked as unclear</button>
            </div>
          </div>
        ) : hits.length === 0 ? (
          <div className="find__hint">
            <p>Nothing matches <b>{q.trim()}</b>. Every word has to appear somewhere — try fewer.</p>
          </div>
        ) : (
          <>
            <div className="find__count">
              {hits.length}{hits.length === 40 ? '+' : ''} result{hits.length === 1 ? '' : 's'}
            </div>
            <ul className="find__list" id="find-results" role="listbox" ref={listRef}>
              {hits.map((hit, i) => (
                <li
                  key={hit.task.id}
                  role="option"
                  aria-selected={i === cursor}
                  className={`find__row${i === cursor ? ' find__row--on' : ''}${hit.task.done ? ' find__row--done' : ''}`}
                  data-stream={hit.task.stream_id}
                  onMouseEnter={() => setCursor(i)}
                >
                  <button onClick={() => choose(hit.task)}>
                    <span className="find__title">
                      {highlight(hit.task.title, q).map((part, n) =>
                        part.hit ? <mark key={n}>{part.text}</mark> : <span key={n}>{part.text}</span>,
                      )}
                    </span>
                    <span className="find__meta">
                      <i className="find__dot" />
                      {hit.section ? pathOf(sections, hit.section.id) : 'Unfiled'}
                      {hit.task.kind === 'watch' && ' · watching'}
                      {hit.task.done && ' · done'}
                      {hit.task.unclear && ' · parked'}
                      {hit.people.length > 0 && ` · ${hit.people.join(', ')}`}
                    </span>
                    {(hit.via === 'context' || hit.via === 'note') && (
                      <span className="find__where">
                        {highlight(
                          (hit.via === 'note' ? hit.task.note : hit.task.context) ?? '',
                          q,
                        ).map((part, n) => (part.hit ? <mark key={n}>{part.text}</mark> : <span key={n}>{part.text}</span>))}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
