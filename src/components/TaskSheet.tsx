import { useEffect, useRef, useState } from 'react';
import { Close } from './icons';
import type { Section, Stream, Task } from '@/lib/types';

export interface SheetPatch {
  title?: string;
  note?: string | null;
  due?: string | null;
  do_now?: boolean;
  kind?: Task['kind'];
  section_id?: string;
  stream_id?: Task['stream_id'];
}

/**
 * Edit sheet.
 *
 * Note the shape of the state here: every field is local, seeded ONCE per
 * task id, and committed on Save. Nothing re-derives from server data while
 * the sheet is open, so a realtime event or a refetch mid-sentence cannot
 * re-render the textarea out from under the cursor. That is the bug this
 * component exists to not have.
 */
export function TaskSheet({
  task,
  streams,
  sections,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  streams: Stream[];
  sections: Section[];
  onSave: (patch: SheetPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? '');
  const [due, setDue] = useState(task.due ?? '');
  const [doNow, setDoNow] = useState(task.do_now);
  const [kind, setKind] = useState<Task['kind']>(task.kind);
  const [sectionId, setSectionId] = useState(task.section_id);

  const sheetRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // Seed once per task, never on subsequent renders of the same task.
  useEffect(() => {
    setTitle(task.title);
    setNote(task.note ?? '');
    setDue(task.due ?? '');
    setDoNow(task.do_now);
    setKind(task.kind);
    setSectionId(task.section_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement;
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      returnTo.current?.focus?.();
    };
  }, [onClose]);

  const section = sections.find((s) => s.id === sectionId);
  const streamId = section?.stream_id ?? task.stream_id;
  const grouped = streams.map((s) => ({
    stream: s,
    sections: sections.filter((sec) => sec.stream_id === s.id),
  }));

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) { titleRef.current?.focus(); return; }
    onSave({
      title: trimmed,
      note: note.trim() ? note.trim() : null,
      due: due || null,
      do_now: doNow,
      kind,
      section_id: sectionId,
      stream_id: streamId,
    });
    onClose();
  };

  return (
    <div
      className="scrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="sheet"
        data-stream={streamId}
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${task.title}`}
      >
        <div className="sheet__grab" />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <h2 style={{ flex: 1 }}>{task.natural_key ? 'Edit item' : 'Edit your item'}</h2>
          <button className="rowbtn" onClick={onClose} aria-label="Close">
            <Close />
          </button>
        </div>

        <div className="field">
          <label htmlFor="sheet-title">Title</label>
          <input
            id="sheet-title"
            ref={titleRef}
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {task.context && (
          <div className="field">
            <label>From the register</label>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              {task.context}
            </p>
          </div>
        )}

        <div className="field">
          <label htmlFor="sheet-note">Your note</label>
          <textarea
            id="sheet-note"
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Where this got to, who said what, what happens next…"
          />
        </div>

        <div className="field row2">
          <div>
            <label htmlFor="sheet-due">Due date</label>
            <input
              id="sheet-due"
              type="date"
              className="input"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="sheet-section">Section</label>
            <select
              id="sheet-section"
              className="select"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              {grouped.map((g) => (
                <optgroup key={g.stream.id} label={g.stream.title}>
                  {g.sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <button
            type="button"
            className="toggle"
            aria-pressed={doNow}
            onClick={() => setDoNow((v) => !v)}
          >
            Do now
            <span className="toggle__knob" />
          </button>
        </div>

        <div className="field">
          <button
            type="button"
            className="toggle"
            aria-pressed={kind === 'watch'}
            onClick={() => setKind((k) => (k === 'watch' ? 'task' : 'watch'))}
          >
            Keep in the periphery
            <span className="toggle__knob" />
          </button>
          <p style={{ margin: '8px 2px 0', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Periphery items stay visible but cannot be ticked, and never appear on Today.
          </p>
        </div>

        <div className="actions">
          <button className="btn btn--danger" onClick={onDelete}>Delete</button>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
