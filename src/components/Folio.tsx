import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { groupOf, leavesFor, pathOf } from '@/lib/tree';
import { isoDay } from '@/lib/today';
import type { Section, Stream, Task } from '@/lib/types';
import type { SheetPatch } from './TaskSheet';

/**
 * The folio: the open item, in the right-hand pane at a desk.
 *
 * Unlike the card on a phone it is not a dialog you save and close — it
 * sits beside the list, and every change lands as it is made. Toggles and
 * dates write at once; the title and note write when you leave them, so a
 * half-typed sentence is never sent.
 *
 * As with the card, fields are local state seeded once per item, so a
 * refetch can never re-render a textarea out from under the cursor.
 */
export function Folio({
  task,
  streams,
  sections,
  waitingOn,
  onSave,
  onToggle,
  onDelete,
}: {
  task: Task | null;
  streams: Stream[];
  sections: Section[];
  waitingOn: string[];
  onSave: (task: Task, patch: SheetPatch) => void;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  if (!task) return <Empty />;
  return (
    <FolioFor
      key={task.id}
      task={task}
      streams={streams}
      sections={sections}
      waitingOn={waitingOn}
      onSave={onSave}
      onToggle={onToggle}
      onDelete={onDelete}
    />
  );
}

function Empty() {
  return (
    <div className="folio folio--empty">
      <p className="folio__hint">Select an item to see it here.</p>
      <dl className="folio__keys">
        {[
          ['J K', 'Move down and up'],
          ['↵', 'Edit the title'],
          ['X', 'Done'],
          ['U', 'Urgent'],
          ['D', 'Give it a date'],
          ['N', 'New item'],
          ['/', 'Search'],
        ].map(([k, label]) => (
          <div key={k}><dt><kbd>{k}</kbd></dt><dd>{label}</dd></div>
        ))}
      </dl>
    </div>
  );
}

function FolioFor({
  task, streams, sections, waitingOn, onSave, onToggle, onDelete,
}: {
  task: Task;
  streams: Stream[];
  sections: Section[];
  waitingOn: string[];
  onSave: (task: Task, patch: SheetPatch) => void;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? '');
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => grow(titleRef.current), [title]);
  useLayoutEffect(() => grow(noteRef.current), [note]);
  // A new item in the pane starts at its top.
  useEffect(() => { titleRef.current?.closest('.folio')?.scrollTo({ top: 0 }); }, []);

  const save = (patch: SheetPatch) => onSave(task, patch);
  const commitTitle = () => {
    const t = title.trim();
    if (!t) { setTitle(task.title); return; }
    if (t !== task.title) save({ title: t });
  };
  const commitNote = () => {
    const n = note.trim() ? note.trim() : null;
    if (n !== (task.note ?? null)) save({ note: n });
  };

  const stream = streams.find((s) => s.id === task.stream_id);
  const grouped = streams.map((s) => ({ stream: s, sections: leavesFor(sections, s.id) }));
  const overdue = Boolean(task.due && !task.done && task.due < isoDay(new Date()));

  return (
    <div className="folio" aria-label={`Open item: ${task.title}`}>
      <header className="folio__head">
        <span className="folio__crumb">
          {(stream?.title ?? task.stream_id)} / {pathOf(sections, task.section_id)}
        </span>
        <textarea
          id="folio-title"
          ref={titleRef}
          className="folio__title"
          rows={1}
          value={title}
          spellCheck={false}
          aria-label="Title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Escape') { setTitle(task.title); e.currentTarget.blur(); }
          }}
        />
      </header>

      <dl className="folio__fields">
        <div>
          <dt>Status</dt>
          <dd className="folio__row">
            <button
              type="button"
              className="mark mark--now"
              aria-pressed={task.do_now}
              onClick={() => save({ do_now: !task.do_now })}
            >
              Urgent
            </button>
            <button
              type="button"
              className="mark"
              aria-pressed={task.done}
              onClick={() => onToggle(task)}
            >
              {task.done ? 'Done' : 'Open'}
            </button>
          </dd>
        </div>

        <div>
          <dt><label htmlFor="folio-due">Due</label></dt>
          <dd className="folio__row folio__row--wrap">
            {quickDays().map((q) => (
              <button
                key={q.label}
                type="button"
                className="daychip"
                aria-pressed={task.due === q.iso}
                onClick={() => save({ due: q.iso })}
              >
                {q.label}
              </button>
            ))}
            <input
              id="folio-due"
              type="date"
              className="input input--date"
              value={task.due ?? ''}
              data-late={overdue || undefined}
              onChange={(e) => save({ due: e.target.value || null })}
            />
            {task.due && (
              <button type="button" className="linkish" onClick={() => save({ due: null })}>Clear</button>
            )}
          </dd>
        </div>

        <div>
          <dt><label htmlFor="folio-section">Sub-focus</label></dt>
          <dd>
            <select
              id="folio-section"
              className="select"
              value={task.section_id}
              onChange={(e) => {
                const sec = sections.find((s) => s.id === e.target.value);
                if (sec) save({ section_id: sec.id, stream_id: sec.stream_id });
              }}
            >
              {grouped.map((g) => (
                <optgroup key={g.stream.id} label={g.stream.title}>
                  {g.sections.map((s) => (
                    <option key={s.id} value={s.id}>{labelFor(sections, s)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </dd>
        </div>

        {waitingOn.length > 0 && (
          <div>
            <dt>Waiting on</dt>
            <dd className="folio__text">{waitingOn.join(', ')}</dd>
          </div>
        )}

        {task.context && (
          <div>
            <dt>Detail</dt>
            <dd className="folio__text">{task.context}</dd>
          </div>
        )}

        <div>
          <dt><label htmlFor="folio-note">Note</label></dt>
          <dd>
            <textarea
              id="folio-note"
              ref={noteRef}
              className="folio__note"
              rows={3}
              value={note}
              placeholder="Where this got to, what happens next"
              onChange={(e) => setNote(e.target.value)}
              onBlur={commitNote}
            />
          </dd>
        </div>

        <div>
          <dt>History</dt>
          <dd className="folio__text folio__text--quiet">
            Added {fmtWhen(task.created_at)} · touched {fmtAgo(task.touched_at)}
            {task.natural_key ? ' · from the register' : ''}
          </dd>
        </div>
      </dl>

      <footer className="folio__foot">
        <button className="btn btn--primary" onClick={() => onToggle(task)}>
          {task.done ? 'Reopen' : 'Mark done'}
        </button>
        <button className="btn btn--ghost" onClick={() => onDelete(task)}>Delete</button>
      </footer>
    </div>
  );
}

/** Today, tomorrow, the coming Friday and next Monday: the days you reach for. */
function quickDays() {
  const at = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); };
  const dow = new Date().getDay();
  const toFri = ((5 - dow + 7) % 7) || 7;
  const toMon = ((1 - dow + 7) % 7) || 7;
  return [
    { label: 'Today', iso: at(0) },
    { label: 'Tomorrow', iso: at(1) },
    { label: 'Fri', iso: at(toFri) },
    { label: 'Next week', iso: at(toMon) },
  ];
}

function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function fmtAgo(iso: string | null) {
  if (!iso) return 'not yet';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function labelFor(sections: Section[], section: Section) {
  const group = groupOf(sections, section.id);
  return group ? `${group.title} › ${section.title}` : section.title;
}
