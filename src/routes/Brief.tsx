/**
 * Something the register can hand you.
 *
 * Pick a person or a stream and get text you can paste into Teams, an email
 * or the monthly report: what has moved, what is stuck, what you need from
 * them, what has gone quiet.
 *
 * Composed locally from rows already held. No call, no key, no signal
 * required — the brief you want most is the one you write on the train.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePeople, useSections, useStreams, useTasks } from '@/data/store';
import { useTaskPeople } from '@/data/review';
import { useToast } from '@/components/Toasts';
import { buildBrief, type Subject } from '@/lib/brief';
import type { Task } from '@/lib/types';

const WINDOWS = [7, 14, 30];

export function Brief({ onOpenTask }: { onOpenTask: (task: Task) => void }) {
  const [params, setParams] = useSearchParams();
  const { data: tasks = [] } = useTasks();
  const { data: sections = [] } = useSections();
  const { data: streams = [] } = useStreams();
  const { data: people = [] } = usePeople();
  const { data: taskPeople = [] } = useTaskPeople();
  const { push } = useToast();

  const since = Number(params.get('since')) || 14;
  const [copied, setCopied] = useState(false);
  const [allPeople, setAllPeople] = useState(false);

  /** Only people who actually have open work: the rest brief as nothing. */
  const withWork = useMemo(() => {
    const open = new Set(
      tasks.filter((t) => t.kind === 'task' && !t.done && !t.deleted_at).map((t) => t.id),
    );
    const count = new Map<string, number>();
    for (const l of taskPeople) {
      if (open.has(l.task_id)) count.set(l.person_id, (count.get(l.person_id) ?? 0) + 1);
    }
    return people
      .map((p) => ({ ...p, open: count.get(p.id) ?? 0 }))
      .filter((p) => p.open > 0)
      .sort((a, b) => b.open - a.open);
  }, [people, taskPeople, tasks]);

  const shown = allPeople ? withWork : withWork.filter((p) => p.open > 1);
  const hidden = withWork.length - shown.length;

  // The brief you are most likely to want is the one for whoever is holding
  // the most of your work, so that is where it opens.
  const subject: Subject = params.get('person')
    ? { kind: 'person', id: params.get('person')! }
    : params.get('stream')
      ? { kind: 'stream', id: params.get('stream')! }
      : withWork[0]
        ? { kind: 'person', id: withWork[0].id }
        : { kind: 'stream', id: streams[0]?.id ?? '' };

  const brief = useMemo(
    () => buildBrief({ subject, since, tasks, sections, streams, people, taskPeople }),
    [subject.kind, subject.id, since, tasks, sections, streams, people, taskPeople],
  );

  const choose = (next: Partial<{ person: string; stream: string; since: string }>) => {
    const p = new URLSearchParams(params);
    if (next.person) { p.set('person', next.person); p.delete('stream'); }
    if (next.stream) { p.set('stream', next.stream); p.delete('person'); }
    if (next.since) p.set('since', next.since);
    setParams(p, { replace: true });
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief.text);
      setCopied(true);
      push({ message: 'Brief copied.' });
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      push({ message: 'Could not reach the clipboard — select the text below instead.' });
    }
  };

  const streamId = subject.kind === 'stream' ? subject.id : undefined;

  return (
    <section aria-labelledby="brief-head" className="brief" data-stream={streamId}>
      <div className="shead">
        <h2 id="brief-head">Brief</h2>
        <span className="shead__meta">for a person, or a stream</span>
      </div>

      <p className="brief__lede">
        Everything so far has been about getting work in and keeping it straight. This is the
        part that comes back out — paste it into a message, an email or the monthly report.
      </p>

      <div className="filters" role="group" aria-label="Who the brief is about">
        {shown.map((p) => (
          <button
            key={p.id}
            className="chip"
            aria-pressed={subject.kind === 'person' && subject.id === p.id}
            onClick={() => choose({ person: p.id })}
          >
            {p.name}
            <span className="chip__n">{p.open}</span>
          </button>
        ))}
        {hidden > 0 && (
          <button className="chip" onClick={() => setAllPeople(true)}>
            {hidden} more
          </button>
        )}
      </div>

      <div className="filters" role="group" aria-label="Or a stream">
        {streams.map((s) => (
          <button
            key={s.id}
            className="chip"
            data-stream={s.id}
            aria-pressed={subject.kind === 'stream' && subject.id === s.id}
            onClick={() => choose({ stream: s.id })}
          >
            <span className="chip__dot" />
            {s.short}
          </button>
        ))}
      </div>

      <div className="brief__sheet">
        <header className="brief__head">
          <div>
            <h3>{brief.title}</h3>
            <p>{brief.standfirst}</p>
          </div>
          <button
            className={`btn btn--primary brief__copy${copied ? ' brief__copy--done' : ''}`}
            onClick={copy}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </header>

        <div className="brief__window" role="group" aria-label="How far back">
          <span>Looking back</span>
          <div className="seg">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={since === w}
                onClick={() => choose({ since: String(w) })}
              >
                {w} days
              </button>
            ))}
          </div>
        </div>

        {brief.blocks.map((block) => (
          <section key={block.heading} className="brief__block">
            <h4>{block.heading}</h4>
            {block.lines.length === 0 ? (
              <p className="brief__none">{block.emptyAs}</p>
            ) : (
              <ul>
                {block.lines.map(({ task, note }) => (
                  <li key={task.id}>
                    <button onClick={() => onOpenTask(task)}>
                      <span className="brief__what">{task.title}</span>
                      <span className="brief__why">{note}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <details className="brief__raw">
        <summary>The text it will paste</summary>
        <pre>{brief.text}</pre>
      </details>
    </section>
  );
}
