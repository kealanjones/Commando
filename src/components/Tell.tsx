import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Close } from './icons';
import { useToast } from './Toasts';
import { useMemory, useTell } from '@/data/memory';
import { KIND_TITLE, byKind } from '@/lib/memory';
import type { MemoryNote } from '@/lib/types';

/**
 * Tell the memory something you have learnt: a fact, a decision, what
 * someone said in a corridor. It files it under the right notes, or under
 * the one you name.
 */
export function TellSheet({ noteId, onClose }: { noteId?: string; onClose: () => void }) {
  const { notes, missing } = useMemory();
  const tell = useTell();
  const { push } = useToast();
  const [text, setText] = useState('');
  const [under, setUnder] = useState(noteId ?? '');
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const groups = byKind(notes);

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
    if (told.length < 3 || tell.isPending) { box.current?.focus(); return; }
    setError(null);
    try {
      const out = await tell.mutateAsync({ text: told, noteId: under || undefined });
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
                {(['project', 'person', 'topic'] as MemoryNote['kind'][]).map((k) => groups[k].length > 0 && (
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
              <button type="submit" className="btn btn--primary" disabled={text.trim().length < 3 || tell.isPending}>
                {tell.isPending ? 'Filing…' : 'Remember'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
