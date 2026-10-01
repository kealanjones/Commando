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
import { Link, useSearchParams } from 'react-router-dom';
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

  // Opened from a person or a stream; with neither, the person holding the
  // most of your open work is the brief you are most likely to want.
  const busiest = useMemo(() => {
    const open = new Set(tasks.filter((t) => !t.done && !t.deleted_at).map((t) => t.id));
    const count = new Map<string, number>();
    for (const l of taskPeople) {
      if (open.has(l.task_id)) count.set(l.person_id, (count.get(l.person_id) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [tasks, taskPeople]);

  const subject: Subject = params.get('person')
    ? { kind: 'person', id: params.get('person')! }
    : params.get('stream')
      ? { kind: 'stream', id: params.get('stream')! }
      : busiest
        ? { kind: 'person', id: busiest }
        : { kind: 'stream', id: streams[0]?.id ?? '' };

  const brief = useMemo(
    () => buildBrief({ subject, since, tasks, sections, streams, people, taskPeople }),
    [subject.kind, subject.id, since, tasks, sections, streams, people, taskPeople],
  );

  const setSince = (w: number) => {
    const p = new URLSearchParams(params);
    p.set('since', String(w));
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
      <Link
        to={subject.kind === 'person' ? `/people/${subject.id}` : `/streams/${subject.id}`}
        className="back"
      >
        ← Back
      </Link>
      <div className="shead">
        <h2 id="brief-head">Brief</h2>
        <span className="shead__meta">text you can paste</span>
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
                onClick={() => setSince(w)}
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
