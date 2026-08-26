import { useEffect, useRef, useState } from 'react';
import { Close } from './icons';
import { groupOf, leavesFor } from '@/lib/tree';
import type { Section, Stream, Task } from '@/lib/types';

export function AddSheet({
  streams,
  sections,
  defaultSectionId,
  onCreate,
  onClose,
}: {
  streams: Stream[];
  sections: Section[];
  defaultSectionId?: string;
  onCreate: (input: {
    title: string; section_id: string; stream_id: Task['stream_id'];
    kind: Task['kind']; do_now: boolean; due: string | null;
  }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [sectionId, setSectionId] = useState(defaultSectionId ?? sections[0]?.id ?? '');
  const [kind, setKind] = useState<Task['kind']>('task');
  const [doNow, setDoNow] = useState(false);
  const [due, setDue] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement;
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); returnTo.current?.focus?.(); };
  }, [onClose]);

  const section = sections.find((s) => s.id === sectionId);
  const grouped = streams.map((s) => ({
    stream: s, sections: leavesFor(sections, s.id),
  }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || !section) { titleRef.current?.focus(); return; }
    onCreate({
      title: t, section_id: section.id, stream_id: section.stream_id,
      kind, do_now: doNow, due: due || null,
    });
    onClose();
  };

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        className="sheet"
        data-stream={section?.stream_id}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Add an item"
      >
        <div className="sheet__grab" />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <h2 style={{ flex: 1 }}>Add an item</h2>
          <button type="button" className="rowbtn" onClick={onClose} aria-label="Close"><Close /></button>
        </div>

        <div className="field">
          <label htmlFor="add-title">What is it</label>
          <input
            id="add-title" ref={titleRef} className="input" value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chase Derek for the sponsor list"
          />
        </div>

        <div className="field row2">
          <div>
            <label htmlFor="add-section">Section</label>
            <select
              id="add-section" className="select" value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              {grouped.map((g) => (
                <optgroup key={g.stream.id} label={g.stream.title}>
                  {g.sections.map((s) => (
                    <option key={s.id} value={s.id}>{labelFor(sections, s)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="add-due">Due date</label>
            <input id="add-due" type="date" className="input" value={due}
              onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <button type="button" className="toggle" aria-pressed={doNow} onClick={() => setDoNow((v) => !v)}>
            Do now<span className="toggle__knob" />
          </button>
        </div>
        <div className="field">
          <button
            type="button" className="toggle" aria-pressed={kind === 'watch'}
            onClick={() => setKind((k) => (k === 'watch' ? 'task' : 'watch'))}
          >
            Just something to remember<span className="toggle__knob" />
          </button>
        </div>

        <div className="actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary">Add</button>
        </div>
      </form>
    </div>
  );
}

/**
 * A native picker only nests one level, and the stream already owns that.
 * So a section inside a group carries its group in its own label.
 */
function labelFor(sections: Section[], section: Section) {
  const group = groupOf(sections, section.id);
  return group ? `${group.title} › ${section.title}` : section.title;
}
