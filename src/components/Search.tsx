import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Close } from './icons';
import { usePeople, useSections, useStreams, useTasks } from '@/data/store';
import { useTaskPeople } from '@/data/review';
import { useAsk, type MemoryAnswer } from '@/data/memory';
import { asQuestion } from '@/lib/memory';
import { highlight, search } from '@/lib/search';
import { pathOf } from '@/lib/tree';
import type { Task } from '@/lib/types';

/**
 * Find anything, from anywhere.
 *
 * Runs over the already-cached task list, so it works with no signal and
 * returns as you type. Ranked rather than filtered — with 255 items a plain
 * substring match buries the thing you meant.
 *
 * Start with "?" and it is a question for the memory instead: Enter asks,
 * and the answer comes back here, with the meetings it came from.
 */
export function Search({ onOpenTask, onClose }: { onOpenTask: (t: Task) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);

  const { data: tasks = [] } = useTasks();
  const { data: sections = [] } = useSections();
  const { data: streams = [] } = useStreams();
  const { data: people = [] } = usePeople();
  const { data: links = [] } = useTaskPeople();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const question = asQuestion(q);
  const asking = question !== null;
  const ask = useAsk();
  const [answer, setAnswer] = useState<{ to: string; reply: MemoryAnswer } | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const hits = useMemo(
    () => (asking ? [] : search(q, tasks, sections, streams, people, links)),
    [asking, q, tasks, sections, streams, people, links],
  );

  useEffect(() => setCursor(0), [q]);

  const put = async (to: string) => {
    if (to.length < 3 || ask.isPending) return;
    setAskError(null);
    try { setAnswer({ to, reply: await ask.mutateAsync(to) }); }
    catch (e) { setAnswer(null); setAskError((e as Error).message); }
  };

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
    if (asking) { if (e.key === 'Enter') { e.preventDefault(); void put(question); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((n) => Math.min(n + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((n) => Math.max(n - 1, 0)); }
    else if (e.key === 'Enter' && hits[cursor]) { e.preventDefault(); choose(hits[cursor].task); }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

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
            placeholder="Search, or start with ? to ask the memory"
            aria-label="Search"
            aria-controls="find-results"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="rowbtn" onClick={onClose} aria-label="Close search"><Close /></button>
        </div>

        {asking ? (
          <div className="find__ask" aria-live="polite">
            {ask.isPending ? (
              <p className="find__asking">Asking the memory…</p>
            ) : askError ? (
              <p className="find__askerror" role="alert">{askError}</p>
            ) : answer && answer.to === question ? (
              <div className="find__answer">
                {answer.reply.answer.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
                {answer.reply.sources.length > 0 && (
                  <p className="find__sources">
                    From: {answer.reply.sources.map((s) => `${s.label} (${s.date})`).join(' · ')}
                  </p>
                )}
              </div>
            ) : (
              <p className="find__askhint">
                {question.length < 3
                  ? 'Ask the memory anything: what was agreed, who said what, where a project stands.'
                  : <>Press <kbd>↵</kbd> to ask the memory.</>}
              </p>
            )}
          </div>
        ) : q.trim() === '' ? (
          <div className="find__hint">
            <p>Search everything — task titles, your notes, the detail from the seed, section names, and who you are waiting on.</p>
            <p>Start with <kbd>?</kbd> to ask the memory a question instead.</p>
          </div>
        ) : hits.length === 0 ? (
          <div className="find__hint">
            <p>Nothing matches <b>{q.trim()}</b>. Every word has to appear somewhere — try fewer.</p>
            <button type="button" className="linkish" onClick={() => { const to = q.trim(); setQ(`? ${to}`); void put(to); }}>
              Ask the memory instead
            </button>
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
                      {hit.task.tag && ` · ${hit.task.tag}`}
                      {hit.task.done && ' · done'}
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
