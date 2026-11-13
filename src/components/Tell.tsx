import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Close } from './icons';
import { useToast } from './Toasts';
import { useMemory, useMemoryEdits, useTell } from '@/data/memory';
import { useAllStreams } from '@/data/store';
import { KIND_TITLE, byKind } from '@/lib/memory';
import type { MemoryNote } from '@/lib/types';

/** A project the memory has no note for yet, as a value in the picker. */
const NEW_PROJECT = 'project:';

/**
 * Tell the memory something you have learnt: a fact, a decision, what
 * someone said in a corridor. It files it under the right notes, or under
 * the one you name.
 */
export function TellSheet({ noteId, onClose }: { noteId?: string; onClose: () => void }) {
  const { notes, missing } = useMemory();
  const { data: streams = [] } = useAllStreams();
  const edit = useMemoryEdits();
  const tell = useTell();
  const { push } = useToast();
  const [text, setText] = useState('');
  const [under, setUnder] = useState(noteId ?? '');
  const [error, setError] = useState<string | null>(null);
  // One submission at a time, across making a project's note and filing
  // under it: a second click or Ctrl+Enter must not file it twice.
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const groups = byKind(notes);
  // Every project can be filed under, whether or not the memory has a note
  // for it yet: one without is listed by its project, and made on saving.
  const noted = new Map(groups.project.map((n) => [n.key, n]));
  const projects = [...streams].sort((a, b) => a.position - b.position)
    .map((s) => ({ value: noted.get(s.id)?.id ?? `${NEW_PROJECT}${s.id}`, title: s.title }));

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); returnTo.current?.focus?.(); };
  }, [onClose]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const told = text.trim();
    if (told.length < 3 || inFlight.current) { box.current?.focus(); return; }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let noteId = under || undefined;
      if (noteId?.startsWith(NEW_PROJECT)) {
        const stream = streams.find((s) => s.id === noteId!.slice(NEW_PROJECT.length));
        noteId = stream ? (await edit.projectNote(stream)).id : undefined;
        if (noteId) setUnder(noteId);
      }
      const out = await tell.mutateAsync({ text: told, noteId });
      const where = out.notes.map((n) => n.title).join(' and ');
      push({
        message: out.asWritten
          ? `Saved under ${where}, as written. It will be tidied when the memory is next reachable.`
          : `Remembered under ${where}.`,
      });
      onClose();
    } catch (err) {
      // The words stay in the box: nothing typed is lost to a failure.
      setError((err as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="sheet tell" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Tell the memory something">
        <div className="sheet__grab" />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <h2 style={{ flex: 1 }}>Tell it something</h2>
          <button type="button" className="rowbtn" onClick={onClose} aria-label="Close"><Close /></button>
        </div>

        {missing ? (
          <p className="tell__hint">
            The memory needs one database update first. <Link to="/memory" onClick={onClose} className="inline">See Memory</Link>.
          </p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="tell-text">What have you learnt</label>
              <textarea
                id="tell-text" ref={box} className="textarea tell__text" value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(); }}
                placeholder="OrganOx's budget closes mid-October. They want silver unless the plenary slot is guaranteed."
              />
            </div>

            <div className="field">
              <label htmlFor="tell-under">File it under</label>
              <select id="tell-under" className="select" value={under} onChange={(e) => setUnder(e.target.value)}>
                <option value="">Let it decide</option>
                {projects.length > 0 && (
                  <optgroup label={KIND_TITLE.project}>
                    {projects.map((o) => <option key={o.value} value={o.value}>{o.title}</option>)}
                  </optgroup>
                )}
                {(['person', 'topic'] as MemoryNote['kind'][]).map((k) => groups[k].length > 0 && (
                  <optgroup key={k} label={KIND_TITLE[k]}>
                    {groups[k].map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            {error && <p className="tell__error" role="alert">{error}</p>}

            <div className="actions">
              <span className="actions__aside tell__hint">It goes on the timeline with today's date.</span>
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={text.trim().length < 3 || busy}>
                {busy ? 'Filing…' : 'Remember'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
