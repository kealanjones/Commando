import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Close } from './icons';
import { groupOf, leavesFor, pathOf } from '@/lib/tree';
import { prefersReducedMotion, rectOf, takeSource } from '@/lib/expand';
import type { Section, Stream, Task } from '@/lib/types';

export interface SheetPatch {
  title?: string;
  note?: string | null;
  due?: string | null;
  do_now?: boolean;
  kind?: Task['kind'];
  section_id?: string;
  stream_id?: Task['stream_id'];
  unclear?: boolean;
}

/** How long the card takes to grow, and to fall back into the list. */
const OPEN_MS = 460;
const CLOSE_MS = 300;

/**
 * The card.
 *
 * Not a dialog that appears over the list — the row you touched lifts off
 * the page, grows into the whole record, and drops back into its place when
 * you are done. The geometry is a straight FLIP: the card is laid out at its
 * final size, then transformed back onto the row it came from, then released.
 *
 * Note the shape of the state: every field is local, seeded ONCE per task id
 * and committed on Save. Nothing re-derives from server data while the card
 * is open, so a realtime event or a refetch mid-sentence cannot re-render the
 * textarea out from under the cursor. That is the bug this component exists
 * to not have.
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
  const [unclear, setUnclear] = useState(task.unclear);
  const [more, setMore] = useState(false);

  const scrimRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);

  // Seed once per task, never on subsequent renders of the same task.
  useEffect(() => {
    setTitle(task.title);
    setNote(task.note ?? '');
    setDue(task.due ?? '');
    setDoNow(task.do_now);
    setKind(task.kind);
    setSectionId(task.section_id);
    setUnclear(task.unclear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // ── the growth ────────────────────────────────────────────────────
  useLayoutEffect(() => {
    sourceRef.current = takeSource();
    const card = cardRef.current;
    if (!card) return;

    const from = prefersReducedMotion() ? null : rectOf(sourceRef.current);
    const to = card.getBoundingClientRect();

    if (!from) {
      // Opened from search, the map, a thread — or motion is turned down.
      // Nothing to grow out of, so it simply arrives.
      card.classList.add('card--settle');
      requestAnimationFrame(() => card.classList.add('card--open'));
      return;
    }

    const sx = Math.max(from.width / to.width, 0.05);
    const sy = Math.max(from.height / to.height, 0.05);
    card.style.transformOrigin = 'top left';
    card.style.transform =
      `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
    // Match the row's corner so the shape reads as the same object.
    card.style.borderRadius = '20px';

    requestAnimationFrame(() => {
      card.style.transition =
        `transform ${OPEN_MS}ms cubic-bezier(.34, .68, .2, 1), `
        + `border-radius ${OPEN_MS * 0.7}ms var(--ease)`;
      card.style.transform = 'none';
      card.style.borderRadius = '';
      card.classList.add('card--open');
    });
  }, []);

  /** Back into the list, then out of the tree. */
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const card = cardRef.current;
    const scrim = scrimRef.current;
    if (!card || prefersReducedMotion()) return onClose();

    scrim?.classList.add('scrim--leaving');
    card.classList.remove('card--open');

    const back = rectOf(sourceRef.current);
    if (back) {
      const to = card.getBoundingClientRect();
      const sx = Math.max(back.width / to.width, 0.05);
      const sy = Math.max(back.height / to.height, 0.05);
      card.style.transition =
        `transform ${CLOSE_MS}ms var(--ease), border-radius ${CLOSE_MS}ms var(--ease), opacity ${CLOSE_MS}ms var(--ease)`;
      card.style.transformOrigin = 'top left';
      card.style.transform =
        `translate(${back.left - to.left}px, ${back.top - to.top}px) scale(${sx}, ${sy})`;
      card.style.borderRadius = '20px';
    } else {
      card.classList.add('card--away');
    }
    window.setTimeout(onClose, CLOSE_MS);
  };

  // ── keyboard, focus, and the page underneath ──────────────────────
  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement;
    // Focus the card, not the title. You opened this to read it; a caret in
    // the title puts a ring round the first thing you look at and throws the
    // keyboard up on a phone.
    const t = window.setTimeout(() => cardRef.current?.focus(), OPEN_MS * 0.5);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); return; }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusable = [...cardRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('is-carded');
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('is-carded');
      returnTo.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Both text areas grow with what is in them: an item's title is a
  // sentence, not a field, and a note has no natural length.
  useLayoutEffect(() => { grow(titleRef.current); }, [title]);
  useLayoutEffect(() => { grow(noteRef.current); }, [note, more]);

  const section = sections.find((s) => s.id === sectionId);
  const streamId = section?.stream_id ?? task.stream_id;
  const stream = streams.find((s) => s.id === streamId);
  const grouped = streams.map((s) => ({ stream: s, sections: leavesFor(sections, s.id) }));

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
      unclear,
    });
    close();
  };

  const dirty =
    title.trim() !== task.title || (note.trim() || null) !== (task.note ?? null)
    || (due || null) !== (task.due ?? null) || doNow !== task.do_now
    || kind !== task.kind || sectionId !== task.section_id || unclear !== task.unclear;

  return (
    <div
      className="scrim scrim--card"
      ref={scrimRef}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="sheet card"
        data-stream={streamId}
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={`Open item: ${task.title}`}
      >
        {/* The tinted head is what the row's colour becomes when it grows. */}
        <div className="card__head">
          <div className="card__where">
            <span className="card__stream">{stream?.short ?? streamId}</span>
            <span className="card__crumb">{pathOf(sections, sectionId)}</span>
          </div>
          <button className="rowbtn card__close" onClick={close} aria-label="Close">
            <Close />
          </button>

          <textarea
            id="sheet-title"
            ref={titleRef}
            className="card__title"
            rows={1}
            value={title}
            spellCheck={false}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Title"
          />

          <div className="card__marks">
            <button
              type="button"
              className="mark mark--now"
              aria-pressed={doNow}
              onClick={() => setDoNow((v) => !v)}
            >
              <span className="mark__dot" />Do now
            </button>
            <button
              type="button"
              className="mark"
              aria-pressed={unclear}
              onClick={() => setUnclear((v) => !v)}
            >
              <span className="mark__dot" />Not clear yet
            </button>
            <button
              type="button"
              className="mark"
              aria-pressed={kind === 'watch'}
              onClick={() => setKind((k) => (k === 'watch' ? 'task' : 'watch'))}
            >
              <span className="mark__dot" />Keep tabs only
            </button>
          </div>
        </div>

        <div className="card__body">
          {task.context && (
            <section className="card__block card__block--quoted">
              <h3>From the register</h3>
              <p>{task.context}</p>
            </section>
          )}

          <section className="card__block">
            <h3>
              <label htmlFor="sheet-note">Your note</label>
            </h3>
            <textarea
              id="sheet-note"
              ref={noteRef}
              className="card__note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Where this got to, who said what, what happens next…"
            />
          </section>

          <section className="card__block card__grid">
            <div>
              <h3><label htmlFor="sheet-due">Due date</label></h3>
              <input
                id="sheet-due"
                type="date"
                className="input"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div>
              <h3><label htmlFor="sheet-section">Filed under</label></h3>
              <select
                id="sheet-section"
                className="select"
                value={sectionId}
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
          </section>

          <section className="card__block">
            <button
              type="button"
              className="card__more"
              aria-expanded={more}
              onClick={() => setMore((v) => !v)}
            >
              <span className="card__morechev" aria-hidden="true">›</span>
              Its history
            </button>
            <div className="collapse" data-open={more}>
              <div>
                <dl className="card__history">
                  <div><dt>Added</dt><dd>{fmtWhen(task.created_at)}</dd></div>
                  <div><dt>Last touched</dt><dd>{fmtAgo(task.touched_at)}</dd></div>
                  <div><dt>Last reviewed</dt><dd>{fmtAgo(task.reviewed_at)}</dd></div>
                  {task.done && <div><dt>Completed</dt><dd>{fmtWhen(task.done_at)}</dd></div>}
                  <div>
                    <dt>Came from</dt>
                    <dd>{task.natural_key ? 'the register' : 'you'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </div>

        <div className="card__foot">
          <button className="btn btn--danger" onClick={onDelete}>Delete</button>
          <button className="btn btn--ghost" onClick={close}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>
            {dirty ? 'Save' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Let a textarea take the height of its own content. */
function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

function fmtAgo(iso: string | null) {
  if (!iso) return 'not since it was seeded';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 21) return `${days} days ago`;
  return `${fmtWhen(iso)} — ${days} days`;
}

/**
 * A native picker only nests one level, and the stream already owns that.
 * So a section inside a group carries its group in its own label.
 */
function labelFor(sections: Section[], section: Section) {
  const group = groupOf(sections, section.id);
  return group ? `${group.title} › ${section.title}` : section.title;
}
