/**
 * The date sweep.
 *
 * One item in two hundred carried a due date, which is why everything felt
 * equally urgent. The dates were never missing — they were in the wrong
 * field, written into notes and titles: "9 October, 1-2pm", "outbound 14
 * September". This puts each one in front of you with the words it came
 * from, and you accept or skip it.
 *
 * Every proposal shows its evidence. Nothing is set without a tap.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSections, useSoftDelete, useTasks, useUpdateTask } from '@/data/store';
import { useDecide } from '@/data/review';
import { useToast } from '@/components/Toasts';
import { pathOf } from '@/lib/tree';
import { fmtDate, findDates, findDeadlineHints } from '@/lib/dates';
import type { Task } from '@/lib/types';

export function Dates() {
  const { data: tasks = [] } = useTasks();
  const { data: sections = [] } = useSections();
  const decide = useDecide();
  const update = useUpdateTask();
  const { remove, restore } = useSoftDelete();
  const { push } = useToast();

  /** Skipped for this sitting only — nothing is written to say no. */
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [set, setSet] = useState<Set<string>>(new Set());

  const finds = useMemo(() => findDates(tasks), [tasks]);
  const hints = useMemo(() => findDeadlineHints(tasks), [tasks]);

  const open = finds.filter((f) => !skipped.has(f.task.id) && !set.has(f.task.id));
  const openHints = hints.filter((h) => !skipped.has(h.task.id) && !set.has(h.task.id));
  const sure = open.filter((f) => f.certainty !== 'vague');

  const apply = (task: Task, due: string) => {
    decide(task, { kind: 'date', due });
    setSet((s) => new Set(s).add(task.id));
  };

  const applyAll = () => {
    for (const f of sure) decide(f.task, { kind: 'date', due: f.due });
    setSet((s) => {
      const next = new Set(s);
      for (const f of sure) next.add(f.task.id);
      return next;
    });
    push({ message: `${sure.length} dates set.` });
  };

  const skip = (id: string) => setSkipped((s) => new Set(s).add(id));

  /**
   * Not every item in here wants a date. Some are already done and a few
   * should never have been on the list, and asking "when?" about those is
   * the wrong question.
   */
  const finish = (task: Task) => {
    update.mutate({ id: task.id, patch: { done: true } });
    setSet((s) => new Set(s).add(task.id));
    push({
      message: 'Done.',
      actionLabel: 'Undo',
      onAction: () => {
        update.mutate({ id: task.id, patch: { done: false } });
        setSet((s) => { const n = new Set(s); n.delete(task.id); return n; });
      },
    });
  };

  const drop = (task: Task) => {
    remove(task.id);
    setSet((s) => new Set(s).add(task.id));
    push({
      message: 'Deleted.',
      actionLabel: 'Undo',
      onAction: () => {
        restore(task);
        setSet((s) => { const n = new Set(s); n.delete(task.id); return n; });
      },
      duration: 9000,
    });
  };

  const done = open.length === 0 && openHints.length === 0;

  return (
    <section aria-labelledby="dates-head" className="sweep">
      <div className="shead">
        <h2 id="dates-head">Dates you already wrote down</h2>
        <span className="shead__meta">{set.size > 0 ? `${set.size} set` : `${finds.length} found`}</span>
      </div>

      <p className="sweep__lede">
        The dates were never missing. They were in your notes and titles rather than in the
        date field, which is why nothing in the register could be ranked by when it is due.
      </p>

      {done ? (
        <div className="empty">
          <h3>{set.size > 0 ? 'That is all of them' : 'Nothing left to read'}</h3>
          <p>
            {set.size > 0
              ? `${set.size} ${set.size === 1 ? 'date is' : 'dates are'} now in the register, so Today can rank by them.`
              : 'No item is carrying a date in its wording that is not already in its date field.'}
          </p>
          <p style={{ marginTop: 12 }}>
            <Link to="/">Back to Today</Link>
          </p>
        </div>
      ) : null}

      {open.length > 0 && (
        <>
          <div className="sweep__bar">
            <h3>Found in your own words</h3>
            {sure.length > 1 && (
              <button className="btn btn--primary sweep__all" onClick={applyAll}>
                Set the {sure.length} sure ones
              </button>
            )}
          </div>

          <ul className="list">
            {open.map((f, i) => (
              <li
                key={f.task.id}
                className="sweep__row"
                data-stream={f.task.stream_id}
                style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}
              >
                <div className="sweep__body">
                  <p className="sweep__title">{f.task.title}</p>
                  <p className="sweep__where">{pathOf(sections, f.task.section_id)}</p>
                  <p className="sweep__quote">
                    <span className="sweep__field">{f.where === 'title' ? 'in the title' : f.where === 'note' ? 'in your note' : 'from the register'}</span>
                    {quoteWith(textOf(f.task, f.where), f.evidence)}
                  </p>
                </div>

                <div className="sweep__verdict">
                  <span className="sweep__date">{fmtDate(f.due)}</span>
                  <span className={`sweep__sure sweep__sure--${f.certainty}`}>{f.reason}</span>
                  <div className="sweep__acts">
                    <button className="btn btn--ghost" onClick={() => skip(f.task.id)}>Skip</button>
                    <button className="btn btn--primary" onClick={() => apply(f.task, f.due)}>
                      Set it
                    </button>
                  </div>
                  <div className="sweep__else">
                    <button className="linkish" onClick={() => finish(f.task)}>Already done</button>
                    <button className="linkish linkish--danger" onClick={() => drop(f.task)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {openHints.length > 0 && (
        <>
          <div className="sweep__bar sweep__bar--second">
            <h3>Says when, but not which day</h3>
            <span className="shead__meta">{openHints.length}</span>
          </div>
          <p className="sweep__lede sweep__lede--tight">
            These promise a deadline in words only — <i>ahead of the Australia trip</i>,{' '}
            <i>before Sydney</i>. No parser should guess at those, so they are only put in
            front of you.
          </p>

          <ul className="list">
            {openHints.map((h) => (
              <li key={h.task.id} className="sweep__row" data-stream={h.task.stream_id}>
                <div className="sweep__body">
                  <p className="sweep__title">{h.task.title}</p>
                  <p className="sweep__where">{pathOf(sections, h.task.section_id)}</p>
                  <p className="sweep__quote">
                    <span className="sweep__field">the promise</span>
                    <b>{h.evidence}</b>
                  </p>
                </div>
                <div className="sweep__verdict">
                  <input
                    type="date"
                    className="input sweep__pick"
                    aria-label={`Due date for ${h.task.title}`}
                    onChange={(e) => { if (e.target.value) apply(h.task, e.target.value); }}
                  />
                  <div className="sweep__acts">
                    <button className="btn btn--ghost" onClick={() => skip(h.task.id)}>Skip</button>
                  </div>
                  <div className="sweep__else">
                    <button className="linkish" onClick={() => finish(h.task)}>Already done</button>
                    <button className="linkish linkish--danger" onClick={() => drop(h.task)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {skipped.size > 0 && (
        <p className="sweep__foot">
          {skipped.size} skipped this sitting. Nothing was written — they will be here next time.
          <button className="linkish" onClick={() => setSkipped(new Set())}>Bring them back</button>
        </p>
      )}
    </section>
  );
}

const textOf = (task: Task, where: 'title' | 'context' | 'note') => task[where] ?? '';

/** Your own sentence, with the words the date came from picked out. */
function quoteWith(text: string, evidence: string) {
  const at = text.toLowerCase().indexOf(evidence.toLowerCase());
  if (at === -1) return <i>{trim(text)}</i>;
  const before = text.slice(Math.max(0, at - 46), at);
  const after = text.slice(at + evidence.length, at + evidence.length + 46);
  return (
    <i>
      {at > 46 ? '…' : ''}{before}
      <b>{text.slice(at, at + evidence.length)}</b>
      {after}{at + evidence.length + 46 < text.length ? '…' : ''}
    </i>
  );
}

const trim = (s: string) => (s.length > 110 ? `${s.slice(0, 109)}…` : s);
