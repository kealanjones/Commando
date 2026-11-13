import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/Toasts';
import { TellSheet } from '@/components/Tell';
import {
  useAbsorb, useAsk, useEraseMemory, useForget, useMemory, useMemoryEdits, useRememberPast,
  type MemoryAnswer,
} from '@/data/memory';
import { KIND_TITLE, byKind, exportMarkdown, timeline } from '@/lib/memory';
import type { MemoryMeeting, MemoryNote } from '@/lib/types';

const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * Memory: what the meetings, and you, have taught it. Ask it things, tell
 * it things, make an area of your own to build context on, read and
 * correct what it knows, take it to Claude.ai, forget a meeting, or erase
 * the lot.
 */
export function Memory() {
  const { notes, entries, meetings, isLoading, missing, error, retry } = useMemory();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState<MemoryNote['kind']>('project');
  /** The tell sheet: open, and the note it is aimed at, if any. */
  const [telling, setTelling] = useState<{ noteId?: string } | null>(null);
  const groups = useMemo(() => byKind(notes), [notes]);

  // Arriving from "What it knows" beside an item: show that note, open.
  const wanted = params.get('note');
  const target = wanted ? notes.find((n) => n.id === wanted) : undefined;
  useEffect(() => { if (target) setKind(target.kind); }, [target?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const meetingById = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const remembered = meetings.filter((m) => m.in_memory && m.remembered_at).length;

  if (missing) {
    return (
      <section aria-labelledby="mem-head">
        <header className="shead"><h2 id="mem-head">Memory</h2></header>
        <div className="empty">
          <h3>One database update first</h3>
          <p>Run <code>supabase/migrations/0012_memory.sql</code> in the Supabase SQL Editor, then come back.</p>
        </div>
      </section>
    );
  }

  if (error && !notes.length) {
    return (
      <section aria-labelledby="mem-head">
        <header className="shead"><h2 id="mem-head">Memory</h2></header>
        <div className="empty">
          <h3>The memory could not be loaded</h3>
          <p>{navigator.onLine ? 'The server did not answer. ' : 'You are offline. '}Nothing is lost.</p>
          <button type="button" className="btn btn--ghost" onClick={retry}>Try again</button>
        </div>
      </section>
    );
  }

  return (
    <section className="mem" aria-labelledby="mem-head">
      <header className="shead">
        <h2 id="mem-head">Memory</h2>
        <span className="shead__meta">
          {notes.length} notes · {entries.length} lines · {remembered} of {meetings.length} meetings
        </span>
      </header>
      <p className="mem__lede">
        Built from every meeting you read in and everything you tell it: a note per project, person and
        topic, each with where things stand and a dated timeline. It shows up beside your items, and
        answers from search when you start with <kbd>?</kbd>.
      </p>

      <Ask empty={!notes.length} />

      <div className="mem__tell">
        <button type="button" className="btn btn--primary" onClick={() => setTelling({})}>
          Tell it something <kbd>T</kbd>
        </button>
        <span className="mem__hint">A fact, a decision, what someone said. It files it for you.</span>
      </div>

      <Remember meetings={meetings} />

      <div className="seg mem__kinds" role="group" aria-label="Show">
        {(['project', 'person', 'topic'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {KIND_TITLE[k]} <span className="mem__count">{groups[k].length}</span>
          </button>
        ))}
      </div>

      {kind !== 'project' && <NewArea kind={kind} />}

      {isLoading ? (
        <div className="skeleton" style={{ height: 120, marginTop: 16 }} />
      ) : groups[kind].length === 0 ? (
        <div className="empty">
          <h3>Nothing here yet</h3>
          <p>{kind === 'project'
            ? 'Read a meeting in, or tell it something about a project, and this fills up.'
            : `Read a meeting in, tell it something, or add a ${kind} above to start building context.`}</p>
        </div>
      ) : (
        <ul className="mem__notes">
          {groups[kind].map((n) => (
            <Note
              key={n.id} note={n} lines={timeline(entries, n.id)} meetingById={meetingById}
              startOpen={n.id === wanted}
              onTell={() => setTelling({ noteId: n.id })}
              onGone={() => { if (n.id === wanted) setParams({}, { replace: true }); }}
            />
          ))}
        </ul>
      )}

      <Meetings meetings={meetings} />

      <Keep notes={notes} />

      {telling && <TellSheet noteId={telling.noteId} onClose={() => setTelling(null)} />}
    </section>
  );
}

/** An area of your own: a person or a topic to build context on. */
function NewArea({ kind }: { kind: 'person' | 'topic' }) {
  const edit = useMemoryEdits();
  const { push } = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = name.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const made = await edit.addNote(kind, t);
      setName('');
      push({ message: `${made.title} added. Tell it something to start it off.` });
    } catch (err) {
      push({ message: (err as Error).message, tone: 'warn' });
    } finally { setBusy(false); }
  };
  const what = kind === 'person' ? 'person' : 'topic';
  return (
    <form className="mem__new" onSubmit={add}>
      <input
        className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
        placeholder={kind === 'person' ? 'A person, e.g. Suzanne Clarke' : 'A topic, e.g. Sponsor payments'}
        aria-label={`New ${what}`}
      />
      <button type="submit" className="btn btn--ghost" disabled={!name.trim() || busy}>Add {what}</button>
    </form>
  );
}

function Ask({ empty }: { empty: boolean }) {
  const ask = useAsk();
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<MemoryAnswer | null>(null);
  const { push } = useToast();

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = q.trim();
    if (question.length < 3 || ask.isPending) return;
    try {
      setAnswer(await ask.mutateAsync(question));
    } catch (err) {
      push({ message: (err as Error).message, tone: 'warn', duration: 0, actionLabel: 'Dismiss', replaceKey: 'mem-ask' });
    }
  };

  return (
    <form className="mem__ask" onSubmit={go}>
      <label htmlFor="mem-q" className="label">Ask it</label>
      <div className="mem__askrow">
        <input id="mem-q" className="input" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={empty ? 'Nothing to ask yet' : 'What did we agree with OrganOx?'} disabled={empty} />
        <button type="submit" className="btn btn--primary" disabled={empty || q.trim().length < 3 || ask.isPending}>
          {ask.isPending ? 'Thinking…' : 'Ask'}
        </button>
      </div>
      {answer && (
        <div className="mem__answer" role="status">
          {answer.answer.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          {answer.sources.length > 0 && (
            <p className="mem__sources">
              From: {answer.sources.map((s) => `${s.label} (${shortDate(s.date)})`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

function Remember({ meetings }: { meetings: MemoryMeeting[] }) {
  const { run, progress } = useRememberPast();
  const { push } = useToast();
  const waiting = meetings.filter((m) => m.in_memory && !m.remembered_at).length;
  if (!waiting && !progress) return null;
  return (
    <div className="mem__past">
      {progress ? (
        <span role="status">Remembering {progress.done} of {progress.total}…</span>
      ) : (
        <>
          <span>{waiting} meeting{waiting === 1 ? ' is' : 's are'} not in the memory yet.</span>
          <button type="button" className="btn btn--ghost" onClick={async () => {
            const r = await run(meetings);
            push({ message: r.failed ? `Remembered ${r.total - r.failed}; ${r.failed} could not be read.` : `Remembered ${r.total}.` });
          }}>Remember {waiting === 1 ? 'it' : 'them'}</button>
        </>
      )}
    </div>
  );
}

function Note({ note, lines, meetingById, startOpen, onTell, onGone }: {
  note: MemoryNote; lines: ReturnType<typeof timeline>; meetingById: Map<string, MemoryMeeting>;
  startOpen: boolean; onTell: () => void; onGone: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const [title, setTitle] = useState(note.title);
  const [deleting, setDeleting] = useState(false);
  const row = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!startOpen) return;
    setOpen(true);
    row.current?.scrollIntoView({ block: 'center' });
  }, [startOpen]);
  const [now, setNow] = useState(note.now);
  const [was, setWas] = useState(note.now);
  if (note.now !== was) { setWas(note.now); setNow(note.now); }
  const edit = useMemoryEdits();

  return (
    <li className="mem__note" data-note={note.id} ref={row}>
      <button type="button" className="mem__notehead" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="mem__title">{note.title}</span>
        <span className="mem__meta">{lines.length} line{lines.length === 1 ? '' : 's'} · updated {shortDate(note.updated_at)}</span>
      </button>
      {!open && note.now && <p className="mem__nowpeek">{note.now}</p>}
      {open && (
        <div className="mem__body">
          {note.kind !== 'project' && (
            <>
              <label className="label" htmlFor={`title-${note.id}`}>Name</label>
              <input id={`title-${note.id}`} className="input mem__rename" value={title} maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (title.trim() && title.trim() !== note.title) edit.rename(note.id, title); else setTitle(note.title); }} />
            </>
          )}
          <label className="label" htmlFor={`now-${note.id}`}>Now</label>
          <textarea id={`now-${note.id}`} className="textarea mem__now" value={now}
            onChange={(e) => setNow(e.target.value)}
            onBlur={() => { if (now.trim() !== note.now.trim()) edit.setNow(note.id, now.trim()); }} />
          <ol className="mem__timeline">
            {lines.map((e) => {
              const m = e.intake_id ? meetingById.get(e.intake_id) : undefined;
              return (
                <li key={e.id}>
                  <span className="mem__when">{e.happened_on ? shortDate(e.happened_on) : ''}</span>
                  <span className="mem__text">{e.text}
                    <span className="mem__from">{m ? ` ${m.label ?? 'Meeting'}` : ' added by hand'}</span>
                  </span>
                  <button type="button" className="iconbtn mem__drop" onClick={() => edit.dropEntry(e.id)}
                    aria-label={`Remove: ${e.text}`}>×</button>
                </li>
              );
            })}
          </ol>
          <div className="mem__noteacts">
            <button type="button" className="btn btn--ghost" onClick={onTell}>Tell it something about {note.title}</button>
            {deleting ? (
              <span className="mem__confirm">
                <span>Delete this note and its {lines.length} line{lines.length === 1 ? '' : 's'}?</span>
                <button type="button" className="btn btn--primary" onClick={() => { edit.removeNote(note.id); onGone(); }}>Delete note</button>
                <button type="button" className="btn btn--ghost" onClick={() => setDeleting(false)}>Keep</button>
              </span>
            ) : (
              <button type="button" className="linkish mem__erase" onClick={() => setDeleting(true)}>Delete note…</button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Meetings({ meetings }: { meetings: MemoryMeeting[] }) {
  const forget = useForget();
  const absorb = useAbsorb();
  const { push } = useToast();
  const [asking, setAsking] = useState<string | null>(null);
  if (!meetings.length) return null;

  return (
    <section className="mem__meetings" aria-labelledby="mem-meet">
      <h3 id="mem-meet" className="zone">Meetings</h3>
      <ul>
        {meetings.map((m) => (
          <li key={m.id} className="mem__meeting" data-meeting={m.id}>
            <span className="mem__mlabel">{m.label ?? 'Meeting'}</span>
            <span className="mem__mdate">{shortDate(m.created_at)}</span>
            <span className="mem__mstate">
              {!m.in_memory ? 'forgotten' : m.remembered_at ? 'remembered' : 'not yet'}
            </span>
            {m.in_memory && m.remembered_at && (asking === m.id ? (
              <span className="mem__confirm">
                <button type="button" className="btn btn--primary" disabled={forget.isPending} onClick={async () => {
                  try {
                    await forget.mutateAsync(m.id);
                    push({ message: `Forgot ${m.label ?? 'that meeting'}.` });
                  } catch (e) { push({ message: (e as Error).message, tone: 'warn' }); }
                  setAsking(null);
                }}>Forget it</button>
                <button type="button" className="btn btn--ghost" onClick={() => setAsking(null)}>Keep</button>
              </span>
            ) : (
              <button type="button" className="linkish" onClick={() => setAsking(m.id)}>Forget</button>
            ))}
            {m.in_memory && !m.remembered_at && (
              <button type="button" className="linkish" disabled={absorb.isPending} onClick={async () => {
                try { await absorb.mutateAsync(m.id); push({ message: `Remembered ${m.label ?? 'it'}.` }); }
                catch (e) { push({ message: (e as Error).message, tone: 'warn' }); }
              }}>Remember</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Keep({ notes }: { notes: MemoryNote[] }) {
  const { entries, meetings } = useMemory();
  const erase = useEraseMemory();
  const { push } = useToast();
  const [erasing, setErasing] = useState(false);

  const download = () => {
    const md = exportMarkdown(notes, entries, meetings);
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-memory-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <footer className="mem__keep">
      <div>
        <button type="button" className="btn btn--ghost" onClick={download} disabled={!notes.length}>Export for Claude</button>
        <p className="mem__hint">A Markdown file of the whole memory. Add it to a Claude Project&rsquo;s knowledge so your everyday chats know your work too.</p>
      </div>
      <div>
        {erasing ? (
          <span className="mem__confirm">
            <span>Erase everything it knows? The meetings stay and can be remembered again.</span>
            <button type="button" className="btn btn--primary" onClick={async () => {
              try { await erase.mutateAsync(); push({ message: 'Memory erased.' }); }
              catch (e) { push({ message: (e as Error).message, tone: 'warn' }); }
              setErasing(false);
            }}>Erase memory</button>
            <button type="button" className="btn btn--ghost" onClick={() => setErasing(false)}>Keep it</button>
          </span>
        ) : (
          <button type="button" className="linkish mem__erase" onClick={() => setErasing(true)} disabled={!notes.length}>Erase memory…</button>
        )}
      </div>
    </footer>
  );
}
