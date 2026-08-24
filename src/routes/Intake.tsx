import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Close } from '@/components/icons';
import { useToast } from '@/components/Toasts';
import { useSections, useStreams, useTasks } from '@/data/store';
import { useAcceptItems, useExtract, useImportProposals, useIntakeItems, useTriage } from '@/data/intake';
import { buildPrompt } from '@/lib/proposalFormat';
import type { IntakeItem } from '@/lib/types';

/**
 * Paste a meeting record; review what it found; accept what is real.
 *
 * Two screens in one route. The paste box is deliberately plain — the work
 * is all in the triage, because an LLM reading a transcript is a good first
 * pass and a bad final authority.
 */
type Route = 'claude' | 'here';

export function Intake() {
  const [route, setRoute] = useState<Route>('here');
  const [text, setText] = useState('');
  const [paste, setPaste] = useState('');
  const [label, setLabel] = useState('');
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const extract = useExtract();
  const importProposals = useImportProposals();
  const { data: items = [] } = useIntakeItems(intakeId);
  const { data: sections = [] } = useSections();
  const { data: streams = [] } = useStreams();
  const { data: tasks = [] } = useTasks();
  const { push } = useToast();
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const openTasks = useMemo(
    () => tasks.filter((t) => t.kind === 'task' && !t.done && !t.deleted_at),
    [tasks],
  );

  const prompt = useMemo(
    () => buildPrompt(streams, sections, openTasks.map((t) => t.title)),
    [streams, sections, openTasks],
  );

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard refused — usually an insecure context or a locked-down
      // browser. Show it so it can be selected by hand.
      setShowPrompt(true);
      push({ message: 'Could not reach the clipboard — select the prompt below instead.' });
    }
  };

  const bringIn = async () => {
    try {
      const res = await importProposals.mutateAsync({
        raw: paste, label: label.trim() || undefined, sections, openTasks,
      });
      setSummary(res.summary);
      setIntakeId(res.intake_id);
    } catch (e) {
      push({ message: (e as Error).message, tone: 'warn', duration: 0, actionLabel: 'Dismiss' });
    }
  };

  const run = async () => {
    try {
      const res = await extract.mutateAsync({ text, label: label.trim() || undefined });
      setIntakeId(res.intake_id);
      setSummary(res.summary);
      if (res.count === 0) push({ message: 'Nothing in there needed adding.' });
    } catch (e) {
      push({ message: (e as Error).message, tone: 'warn', duration: 0, actionLabel: 'Dismiss' });
    }
  };

  const startOver = () => {
    setIntakeId(null); setText(''); setPaste(''); setLabel(''); setSummary('');
    window.setTimeout(() => boxRef.current?.focus(), 0);
  };

  if (intakeId && items.length > 0) {
    return <Triage items={items} summary={summary} label={label} onDone={startOver} />;
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <section aria-labelledby="intake-head">
      <div className="shead">
        <h2 id="intake-head">Read a meeting in</h2>
        <span className="shead__meta">{openTasks.length} in the register</span>
      </div>

      <div className="seg seg--wide" role="group" aria-label="How to bring it in">
        <button aria-pressed={route === 'here'} onClick={() => setRoute('here')}>
          Read it here
        </button>
        <button aria-pressed={route === 'claude'} onClick={() => setRoute('claude')}>
          Via Claude
        </button>
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="intake-label">What was it</label>
        <input
          id="intake-label" className="input" value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="SMT, 14 August"
        />
      </div>

      {route === 'claude' ? (
        <>
          <ol className="steps">
            <li>
              <div>
                <b>Copy the prompt.</b> It already knows your streams and sections, and every
                item you have open, so nothing comes back misfiled or duplicated. Use this route
                if you would rather nothing left the app at all.
              </div>
              <button className="btn btn--primary" onClick={copyPrompt} style={{ flex: 'none' }}>
                {copied ? 'Copied' : 'Copy the prompt'}
              </button>
            </li>
            <li>
              <div>
                <b>Paste it into Claude, then your meeting underneath.</b> Notes, a transcript, an
                email chain — whatever you have.
              </div>
            </li>
            <li>
              <div><b>Paste the whole reply back here.</b> Fences and all; it will find the useful part.</div>
            </li>
          </ol>

          {showPrompt && (
            <div className="field">
              <label htmlFor="intake-prompt">The prompt, to select by hand</label>
              <textarea
                id="intake-prompt" className="textarea" readOnly value={prompt}
                style={{ minHeight: 140, fontFamily: 'var(--data)', fontSize: 12 }}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="intake-paste">What Claude gave you back</label>
            <textarea
              id="intake-paste" ref={boxRef} className="textarea" value={paste}
              onChange={(e) => setPaste(e.target.value)}
              style={{ minHeight: 200, fontSize: 13.5, lineHeight: 1.55 }}
              placeholder={'```json\n{ "summary": "…", "items": [ … ] }\n```'}
            />
          </div>

          <div className="actions">
            <button
              className="btn btn--primary"
              onClick={bringIn}
              disabled={importProposals.isPending || paste.trim().length < 10}
            >
              {importProposals.isPending ? 'Reading…' : 'Bring them in'}
            </button>
          </div>

          <p className="footnote">
            Nothing new leaves: you are already in Claude when you do this, and only the
            proposals and their quotes are kept here.
          </p>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="intake-text">The record</label>
            <textarea
              id="intake-text" className="textarea" value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ minHeight: 240, fontSize: 14, lineHeight: 1.6 }}
              placeholder={'Anthony asked me to get the sponsor payment route sorted before Sydney…'}
            />
          </div>

          <div className="notice">
            <span className="notice__dot" />
            <p>
              The record is sent to Anthropic&rsquo;s API to be read, and kept against your
              account so each item can show where it came from. This is the only part of the app
              that sends anything outside Supabase.
            </p>
          </div>

          <div className="actions">
            <button
              className="btn btn--primary"
              onClick={run}
              disabled={extract.isPending || text.trim().length < 40}
            >
              {extract.isPending ? 'Reading…' : 'Read this meeting'}
            </button>
          </div>

          {extract.isPending && (
            <div className="reading" role="status">
              <span className="reading__bar" />
              Reading {words.toLocaleString()} words, sorting them into your streams.
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * An editable title that grows to fit.
 *
 * A single-line input clips long titles at 375px, and a fixed-height
 * textarea wastes the space when they are short. Height is set from
 * scrollHeight on every change — which touches style only, so the caret
 * never moves and focus is never lost.
 */
function GrowingTitle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(fit, []);
  useEffect(fit, [value]);

  return (
    <textarea
      ref={ref}
      className="cand__title"
      rows={1}
      value={value}
      aria-label="Item title"
      onChange={(e) => { onChange(e.target.value); fit(); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
function Triage({
  items, summary, label, onDone,
}: {
  items: IntakeItem[]; summary: string; label: string; onDone: () => void;
}) {
  const { data: streams = [] } = useStreams();
  const { data: sections = [] } = useSections();
  const { data: tasks = [] } = useTasks();
  const { kept, placed, unplaced, rejected, edit, reject, restore } = useTriage(items);
  const accept = useAcceptItems();
  const { push } = useToast();

  const dupTitle = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks]);
  const ready = placed.length;

  const commit = async () => {
    if (!ready) return;
    await accept.mutateAsync(placed);
    push({ message: `${ready} added to the register.` });
    onDone();
  };

  const taskCount = kept.filter((i) => i.kind === 'task').length;
  const watchCount = kept.filter((i) => i.kind === 'watch').length;

  return (
    <section aria-labelledby="triage-head">
      <div className="shead">
        <h2 id="triage-head">{label || 'What it found'}</h2>
        <span className="shead__meta">{taskCount} tasks · {watchCount} to watch</span>
      </div>

      {summary && <p className="summary">{summary}</p>}

      <ul className="list" style={{ marginTop: 18 }}>
        {items.map((raw) => {
          const item = kept.find((k) => k.id === raw.id) ?? raw;
          const isRejected = rejected.has(raw.id);
          const sectionsFor = sections.filter((s) => !item.stream_id || s.stream_id === item.stream_id);
          const unplacedItem = !item.section_id || !item.stream_id;

          if (isRejected) {
            return (
              <li key={raw.id} className="cand cand--gone">
                <p>{item.title}</p>
                <button className="watch__go" onClick={() => restore(raw.id)}>Put back</button>
              </li>
            );
          }

          return (
            <li
              key={raw.id}
              className={`cand${unplacedItem ? ' cand--unplaced' : ''}`}
              data-stream={item.stream_id ?? undefined}
            >
              <div className="cand__top">
                <GrowingTitle
                  value={item.title}
                  onChange={(v) => edit(raw.id, { title: v })}
                />
                <button className="rowbtn" onClick={() => reject(raw.id)} aria-label={`Discard: ${item.title}`}>
                  <Close />
                </button>
              </div>

              {item.evidence && (
                <blockquote className="cand__quote">“{item.evidence}”</blockquote>
              )}

              {item.duplicate_of && (
                <p className="cand__dup">
                  Looks like you already have this: <b>{dupTitle.get(item.duplicate_of) ?? 'an existing item'}</b>
                </p>
              )}

              <div className="cand__controls">
                <div className="seg" role="group" aria-label="Kind">
                  <button
                    aria-pressed={item.kind === 'task'}
                    onClick={() => edit(raw.id, { kind: 'task' })}
                  >Do it</button>
                  <button
                    aria-pressed={item.kind === 'watch'}
                    onClick={() => edit(raw.id, { kind: 'watch' })}
                  >Just watch</button>
                </div>

                <select
                  className="select select--inline"
                  value={item.section_id ?? ''}
                  onChange={(e) => {
                    const sec = sections.find((s) => s.id === e.target.value);
                    edit(raw.id, { section_id: sec?.id ?? null, stream_id: sec?.stream_id ?? null });
                  }}
                  aria-label="Section"
                >
                  <option value="">Not placed — choose a section</option>
                  {streams.map((s) => (
                    <optgroup key={s.id} label={s.title}>
                      {sectionsFor.filter((sec) => sec.stream_id === s.id).map((sec) => (
                        <option key={sec.id} value={sec.id}>{sec.title}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                {item.kind === 'task' && (
                  <button
                    className="tinytoggle"
                    aria-pressed={item.do_now}
                    onClick={() => edit(raw.id, { do_now: !item.do_now })}
                  >Do now</button>
                )}

                {item.due && <span className="pill pill--flag">due {item.due}</span>}
                {item.waiting_on.length > 0 && (
                  <span className="meta">waiting on <b>{item.waiting_on.join(', ')}</b></span>
                )}
                <span className={`conf conf--${item.confidence}`}>{item.confidence}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="commit">
        <div className="commit__count">
          <b>{ready}</b> ready
          {unplaced.length > 0 && <span> · {unplaced.length} need a section</span>}
        </div>
        <button className="btn btn--ghost" onClick={onDone} style={{ flex: 'none' }}>Discard all</button>
        <button
          className="btn btn--primary"
          onClick={commit}
          disabled={!ready || accept.isPending}
          style={{ flex: 'none' }}
        >
          {accept.isPending ? 'Adding…' : `Add ${ready} to the register`}
        </button>
      </div>
    </section>
  );
}
