import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Close } from '@/components/icons';
import { useToast } from '@/components/Toasts';
import { usePeople, useSections, useStreams } from '@/data/store';
import {
  SESSION_SIZE, quickDates, useDecide, useReviewQueue, useUndoDecision,
} from '@/data/review';
import type { Decision, ReviewCard, ReviewMode, ReviewReason, Task } from '@/lib/types';

/** What the card says about why it is in front of you. */
const REASON: Record<ReviewReason, { label: string; line: (c: ReviewCard) => string }> = {
  overdue:        { label: 'Overdue',      line: (c) => `Was due ${new Date(c.task.due!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.` },
  unfinishable:   { label: 'No finish line', line: () => 'There is no state of the world where you tick this. It is a standing concern, not a task.' },
  urgent_undated: { label: 'Urgent, undated', line: () => 'Flagged do-now, but with no date it will never actually come up.' },
  unclear:        { label: 'Parked',       line: (c) => `You put this aside ${c.daysIdle} days ago because it was not clear.` },
  stale:          { label: 'Gone quiet',   line: (c) => `Untouched for ${c.daysIdle} days.` },
};

type Exit = 'drop' | 'watch' | 'date' | 'keep' | 'done';

export function Review() {
  const [params] = useSearchParams();
  const { personId } = useParams();
  const mode: ReviewMode = personId ? 'person' : ((params.get('mode') as ReviewMode) ?? 'weekly');

  const navigate = useNavigate();
  const { push } = useToast();
  const decide = useDecide();
  const undo = useUndoDecision();

  const { data: streams = [] } = useStreams();
  const { data: sections = [] } = useSections();
  const { data: people = [] } = usePeople();

  const queue = useReviewQueue(mode, personId);
  // Frozen at the start: the queue recomputes as decisions land, and a deck
  // that reshuffles under you is impossible to work through.
  const [deck] = useState<ReviewCard[]>(() =>
    mode === 'weekly' ? queue.slice(0, SESSION_SIZE) : queue,
  );

  const [at, setAt] = useState(0);
  const [exit, setExit] = useState<Exit | null>(null);
  const [picking, setPicking] = useState(false);
  const [tally, setTally] = useState<Record<string, number>>({});

  const sectionTitle = useMemo(() => new Map(sections.map((s) => [s.id, s.title])), [sections]);
  const personName = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const who = personId ? personName.get(personId) : undefined;

  const card = deck[at];

  const apply = useCallback(
    (decision: Decision, exitAs: Exit) => {
      if (!card) return;
      const before: Task = { ...card.task };
      const reduced = decision.kind === 'watch' || decision.kind === 'drop' || decision.kind === 'done';

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setExit(exitAs);
      window.setTimeout(() => {
        decide(before, decision);
        setTally((t) => ({ ...t, [decision.kind]: (t[decision.kind] ?? 0) + 1, ...(reduced ? { _off: (t._off ?? 0) + 1 } : {}) }));
        setAt((n) => n + 1);
        setExit(null);
        setPicking(false);
      }, reduce ? 0 : 260);

      push({
        message: LABEL[decision.kind],
        actionLabel: 'Undo',
        onAction: () => { undo(before); setAt((n) => Math.max(0, n - 1)); },
        duration: 4000,
        replaceKey: 'decision',
      });
    },
    [card, decide, undo, push],
  );

  if (deck.length === 0) return <Empty mode={mode} who={who} />;
  if (!card) return <Finished tally={tally} total={deck.length} mode={mode} who={who} onClose={() => navigate('/')} />;

  const stream = streams.find((s) => s.id === card.task.stream_id);
  const reason = REASON[card.reason];

  return (
    <section className="rv" aria-label="Decisions">
      <div className="rv__bar">
        <div className="rv__progress" role="progressbar" aria-valuenow={at} aria-valuemin={0} aria-valuemax={deck.length}>
          <span style={{ width: `${(at / deck.length) * 100}%` }} />
        </div>
        <span className="rv__count">{at + 1} of {deck.length}</span>
        <button className="rowbtn" onClick={() => navigate('/')} aria-label="Stop reviewing"><Close /></button>
      </div>

      <div
        key={card.task.id}
        className={`rv__card${exit ? ` rv__card--out-${exit}` : ''}`}
        data-stream={card.task.stream_id}
      >
        <div className="rv__why">
          <span className="rv__badge">{reason.label}</span>
          <p>{reason.line(card)}</p>
        </div>

        <h2 className="rv__title">{card.task.title}</h2>
        {card.task.context && <p className="rv__context">{card.task.context}</p>}

        <div className="rv__meta">
          <span className="pill">{stream?.short ?? card.task.stream_id}</span>
          <span className="meta">{sectionTitle.get(card.task.section_id)}</span>
          {card.blocking > 0 && <span className="meta">· <b>{card.blocking}</b> more in this section</span>}
          {card.waitingOn.length > 0 && (
            <span className="meta">· waiting on <b>{card.waitingOn.map((id) => personName.get(id)).filter(Boolean).join(', ')}</b></span>
          )}
        </div>

        {picking ? (
          <div className="rv__dates">
            {quickDates().map((d) => (
              <button key={d.iso} className="chip" onClick={() => apply({ kind: 'date', due: d.iso }, 'date')}>
                {d.label}
              </button>
            ))}
            <input
              type="date" className="input" style={{ width: 'auto', padding: '8px 12px' }}
              aria-label="Pick a date"
              onChange={(e) => e.target.value && apply({ kind: 'date', due: e.target.value }, 'date')}
            />
            <button className="chip" onClick={() => setPicking(false)}>Back</button>
          </div>
        ) : (
          <div className="rv__actions">
            {mode === 'person' ? (
              <>
                <button className="rv__act rv__act--go" onClick={() => apply({ kind: 'chased' }, 'keep')}>I&rsquo;ve chased them</button>
                <button className="rv__act" onClick={() => apply({ kind: 'done' }, 'done')}>Done</button>
                <button className="rv__act" onClick={() => setPicking(true)}>Give it a date</button>
                <button className="rv__act rv__act--drop" onClick={() => apply({ kind: 'drop' }, 'drop')}>Drop it</button>
              </>
            ) : (
              <>
                <button className="rv__act rv__act--go" onClick={() => setPicking(true)}>Give it a date</button>
                <button className="rv__act" onClick={() => apply({ kind: 'watch' }, 'watch')}>Just watch it</button>
                {card.task.unclear ? (
                  <button className="rv__act" onClick={() => apply({ kind: 'clear' }, 'keep')}>It&rsquo;s clear now</button>
                ) : (
                  <button className="rv__act" onClick={() => apply({ kind: 'unclear' }, 'keep')}>Not clear yet</button>
                )}
                <button className="rv__act rv__act--drop" onClick={() => apply({ kind: 'drop' }, 'drop')}>Drop it</button>
              </>
            )}
          </div>
        )}

        <button className="rv__skip" onClick={() => apply({ kind: 'keep' }, 'keep')}>
          Leave it as it is &rarr;
        </button>
      </div>
    </section>
  );
}

const LABEL: Record<Decision['kind'], string> = {
  date: 'Dated.', watch: 'Moved to the periphery.', drop: 'Dropped.',
  unclear: 'Parked until it is clearer.', clear: 'Back in play.',
  done: 'Done.', chased: 'Chased.', keep: 'Left as it is.',
};

function Empty({ mode, who }: { mode: ReviewMode; who?: string }) {
  return (
    <div className="empty">
      <h3>{mode === 'person' ? `Nothing outstanding with ${who ?? 'them'}` : 'Nothing to decide'}</h3>
      <p>
        {mode === 'unclear'
          ? 'Nothing is parked. Mark something “not clear yet” and it will wait here.'
          : mode === 'person'
            ? 'Everything they owe you is either done or already dated.'
            : 'Nothing has gone quiet, and everything urgent has a date. Come back next week.'}
      </p>
      <Link to="/" className="more" style={{ display: 'inline-block', marginTop: 16 }}>Back to Today</Link>
    </div>
  );
}

function Finished({
  tally, total, mode, who, onClose,
}: {
  tally: Record<string, number>; total: number; mode: ReviewMode; who?: string; onClose: () => void;
}) {
  const lighter = (tally.watch ?? 0) + (tally.drop ?? 0) + (tally.done ?? 0);
  const lines: [string, number][] = [
    ['dated', tally.date ?? 0],
    ['moved to the periphery', tally.watch ?? 0],
    ['dropped', tally.drop ?? 0],
    ['marked done', tally.done ?? 0],
    ['chased', tally.chased ?? 0],
    ['parked as unclear', tally.unclear ?? 0],
    ['left alone', (tally.keep ?? 0) + (tally.clear ?? 0)],
  ];

  return (
    <div className="rv__done">
      <div className="rv__doneNum">{lighter > 0 ? `−${lighter}` : total}</div>
      <h2>
        {lighter > 0
          ? `Your do-column is ${lighter} lighter.`
          : mode === 'person'
            ? `Caught up on ${who ?? 'them'}.`
            : 'All decided.'}
      </h2>
      <ul className="rv__tally">
        {lines.filter(([, n]) => n > 0).map(([label, n]) => (
          <li key={label}><b>{n}</b> {label}</li>
        ))}
      </ul>
      <button className="btn btn--primary" onClick={onClose} style={{ marginTop: 22 }}>Back to Today</button>
    </div>
  );
}
