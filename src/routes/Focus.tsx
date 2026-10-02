import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Close } from '@/components/icons';
import { Num } from '@/components/Motion';
import { useToast } from '@/components/Toasts';
import { useDay, usePeople, useSections, useSoftDelete, useStreams, useTasks, useUpdateTask } from '@/data/store';
import { quickDates, useTaskPeople } from '@/data/review';
import { useMemory } from '@/data/memory';
import { announceTick } from '@/lib/progress';
import { prefersReducedMotion } from '@/lib/expand';
import {
  ORDER, WHICH, clock, dueLine, minutes, pile, scopeFrom, scopeParams, type FocusScope,
} from '@/lib/focus';
import type { Section, Stream, Task } from '@/lib/types';

type Outcome = 'done' | 'snoozed' | 'gone';
type Exit = 'done' | 'later' | 'snoozed' | 'gone';
type Menu = null | 'snooze' | 'move' | 'delete' | 'note';

interface Step {
  queue: string[];
  outcomes: Record<string, Outcome>;
  passed: Record<string, number>;
  /** Puts the item itself back the way it was. */
  revert?: () => void;
}

/** How long each way out takes before the next card arrives (ms). */
const EXIT_MS: Record<Exit, number> = { done: 620, later: 380, snoozed: 420, gone: 380 };
/** Above this, the progress strip is one bar rather than a tick each. */
const MAX_TICKS = 40;

const ageOf = (iso: string, today: string) =>
  Math.max(0, Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(iso.slice(0, 10) + 'T00:00:00').getTime()) / 86_400_000));

/**
 * One by one: a pile you choose, then each item on its own, large, with
 * everything known about it. Done, stay with it, later, snooze, and the
 * smaller moves, all from the keys too.
 */
export function Focus() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const today = useDay();

  const { data: tasks = [] } = useTasks();
  const { data: streams = [] } = useStreams();
  const { data: sections = [] } = useSections();

  const [scope, setScopeState] = useState<FocusScope>(() => scopeFrom(params));
  const setScope = (next: FocusScope) => {
    setScopeState(next);
    setParams(new URLSearchParams(scopeParams(next)), { replace: true });
  };
  const preview = useMemo(() => pile(tasks, sections, scope, today), [tasks, sections, scope, today]);

  const [phase, setPhase] = useState<'setup' | 'run' | 'end'>('setup');
  const [ids, setIds] = useState<string[]>([]);
  const [runKey, setRunKey] = useState(0);

  const leave = useCallback(() => {
    // Back where it was opened from; straight in from a link goes Today.
    if (location.key !== 'default') navigate(-1); else navigate('/');
  }, [location.key, navigate]);

  const start = () => {
    if (!preview.length) return;
    setIds(preview.map((t) => t.id));
    setRunKey((k) => k + 1);
    setPhase('run');
  };

  return (
    <div className="fx" data-phase={phase} role="dialog" aria-modal="true" aria-label="One by one">
      {phase === 'setup' && (
        <Setup
          scope={scope} setScope={setScope} streams={streams} sections={sections}
          preview={preview} today={today} onStart={start} onClose={leave}
        />
      )}
      {phase !== 'setup' && (
        <Run
          key={runKey}
          ids={ids}
          tasks={tasks}
          streams={streams}
          sections={sections}
          today={today}
          finished={phase === 'end'}
          onFinish={() => setPhase('end')}
          onAgain={() => setPhase('setup')}
          onClose={leave}
        />
      )}
    </div>
  );
}

// ── choosing the pile ──────────────────────────────────────────────

function Setup({ scope, setScope, streams, sections, preview, today, onStart, onClose }: {
  scope: FocusScope; setScope: (s: FocusScope) => void;
  streams: Stream[]; sections: Section[]; preview: Task[]; today: string;
  onStart: () => void; onClose: () => void;
}) {
  const startBtn = useRef<HTMLButtonElement>(null);
  const project = streams.find((s) => s.id === scope.stream);
  // A project's top level: bare sub-focuses and groups, in their order.
  const focuses = useMemo(
    () => sections.filter((s) => s.stream_id === scope.stream && !s.parent_id).sort((a, b) => a.position - b.position),
    [sections, scope.stream],
  );
  const children = useMemo(() => {
    const picked = sections.find((s) => s.id === scope.section);
    const groupId = picked ? (picked.parent_id ?? picked.id) : null;
    return groupId ? sections.filter((s) => s.parent_id === groupId).sort((a, b) => a.position - b.position) : [];
  }, [sections, scope.section]);
  const parentOfPicked = sections.find((s) => s.id === scope.section)?.parent_id ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      // Enter starts from anywhere on this screen, a chip just chosen included.
      if (e.key === 'Enter' && !el.classList.contains('fx__start')) { e.preventDefault(); onStart(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart, onClose]);

  useEffect(() => { startBtn.current?.focus({ preventScroll: true }); }, []);

  const first = preview[0];
  const n = preview.length;

  return (
    <div className="fx__setup">
      <header className="fx__top">
        <span className="label">One by one</span>
        <button type="button" className="fx__close" onClick={onClose} aria-label="Close one by one"><Close /></button>
      </header>

      <div className="fx__setupgrid">
        <div className="fx__choose">
          <h1 className="fx__h1">What are we going through?</h1>

          <fieldset className="fx__row" style={{ '--i': 0 } as React.CSSProperties}>
            <legend className="label">Which</legend>
            <div className="fx__chips">
              {WHICH.map((w) => (
                <button key={w.id} type="button" className="fx__chip" aria-pressed={scope.which === w.id}
                  onClick={() => setScope({ ...scope, which: w.id })}>{w.label}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="fx__row" style={{ '--i': 1 } as React.CSSProperties}>
            <legend className="label">Where</legend>
            <div className="fx__chips">
              <button type="button" className="fx__chip" aria-pressed={!scope.stream}
                onClick={() => setScope({ ...scope, stream: null, section: null })}>All projects</button>
              {streams.map((s) => (
                <button key={s.id} type="button" className="fx__chip" aria-pressed={scope.stream === s.id}
                  onClick={() => setScope({ ...scope, stream: s.id, section: null })}>
                  {s.code.toLowerCase() !== s.short.toLowerCase() && <span className="fx__chipcode">{s.code}</span>}{s.short}
                </button>
              ))}
            </div>
            {project && focuses.length > 0 && (
              <div className="fx__chips fx__chips--sub" key={project.id}>
                <button type="button" className="fx__chip" aria-pressed={!scope.section}
                  onClick={() => setScope({ ...scope, section: null })}>All of {project.short}</button>
                {focuses.map((f) => (
                  <button key={f.id} type="button" className="fx__chip"
                    aria-pressed={scope.section === f.id || parentOfPicked === f.id}
                    onClick={() => setScope({ ...scope, section: f.id })}>{f.title}</button>
                ))}
              </div>
            )}
            {children.length > 0 && (
              <div className="fx__chips fx__chips--sub" key={`c-${children[0].parent_id}`}>
                <button type="button" className="fx__chip" aria-pressed={scope.section === children[0].parent_id}
                  onClick={() => setScope({ ...scope, section: children[0].parent_id })}>All of it</button>
                {children.map((c) => (
                  <button key={c.id} type="button" className="fx__chip" aria-pressed={scope.section === c.id}
                    onClick={() => setScope({ ...scope, section: c.id })}>{c.title}</button>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="fx__row" style={{ '--i': 2 } as React.CSSProperties}>
            <legend className="label">Order</legend>
            <div className="fx__chips">
              {ORDER.map((o) => (
                <button key={o.id} type="button" className="fx__chip" aria-pressed={scope.order === o.id}
                  onClick={() => setScope({ ...scope, order: o.id })}>{o.label}</button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="fx__deck" aria-live="polite">
          <div className="fx__stack" data-n={Math.min(n, 3)}>
            {first ? (
              <div className="fx__peek" key={first.id}>
                <span className="fx__peekwhere">
                  <span className="fx__code">{streams.find((s) => s.id === first.stream_id)?.code}</span>
                  {sections.find((s) => s.id === first.section_id)?.title}
                </span>
                <span className="fx__peektitle">{first.title}</span>
                <span className={`fx__peekdue${dueLine(first.due, today).late ? ' is-late' : ''}`}>{dueLine(first.due, today).text}</span>
              </div>
            ) : (
              <div className="fx__peek fx__peek--empty">
                <span className="fx__peektitle">Nothing in this pile.</span>
                <span className="fx__peekwhere">Widen it: another project, or Everything open.</span>
              </div>
            )}
          </div>
          <div className="fx__go">
            <span className="fx__count"><Num value={n} /> <span>{n === 1 ? 'item' : 'items'}</span></span>
            <button ref={startBtn} type="button" className="fx__start" onClick={onStart} disabled={!n}>
              Start <kbd>↵</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── the run ────────────────────────────────────────────────────────

function Run({ ids, tasks, streams, sections, today, finished, onFinish, onAgain, onClose }: {
  ids: string[]; tasks: Task[]; streams: Stream[]; sections: Section[]; today: string;
  finished: boolean; onFinish: () => void; onAgain: () => void; onClose: () => void;
}) {
  const update = useUpdateTask();
  const { remove, restore } = useSoftDelete();
  const { push } = useToast();
  const { data: people = [] } = usePeople();
  const { data: links = [] } = useTaskPeople();
  const { notes: memory } = useMemory();

  const [queue, setQueue] = useState<string[]>(ids);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [passed, setPassed] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Step[]>([]);
  const [exit, setExit] = useState<Exit | null>(null);
  /** The card on its way out: it stays on screen until it has gone. */
  const [leaving, setLeaving] = useState<Task | null>(null);
  /** Counts cards dealt, so even the same item coming round again arrives afresh. */
  const [turn, setTurn] = useState(0);
  const [menu, setMenu] = useState<Menu>(null);
  const [staying, setStaying] = useState<number | null>(null);
  const [spent, setSpent] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [pressed, setPressed] = useState<string | null>(null);
  const busy = useRef(false);

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  // An item finished or deleted somewhere else drops out of the run.
  const live = queue.filter((id) => { const t = byId.get(id); return t && !t.done; });
  // A deleted or finished card is held as it was until it has gone.
  const task = leaving ?? (live[0] ? byId.get(live[0]) ?? null : null);

  useEffect(() => {
    if (!finished && !task && !exit) onFinish();
  }, [finished, task, exit, onFinish]);

  // The clock while staying with something.
  useEffect(() => {
    if (staying === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [staying]);

  const stopStaying = useCallback(() => {
    if (staying !== null) setSpent((s) => s + (Date.now() - staying));
    setStaying(null);
  }, [staying]);

  const snapshot = (revert?: () => void): Step => ({ queue, outcomes, passed, revert });

  /** Leave the current card a particular way, then bring on the next. */
  const go = useCallback((how: Exit, act: () => (() => void) | void, message: string) => {
    if (!task || busy.current) return;
    busy.current = true;
    stopStaying();
    setMenu(null);
    const revert = act() ?? undefined;
    const step = snapshot(revert);
    setHistory((h) => [...h, step]);
    const id = task.id;
    setLeaving(task);
    setExit(how);
    window.setTimeout(() => {
      setQueue((q) => {
        const rest = q.filter((x) => x !== id);
        return how === 'later' ? [...rest, id] : rest;
      });
      if (how === 'later') setPassed((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
      else setOutcomes((o) => ({ ...o, [id]: how }));
      setExit(null);
      setLeaving(null);
      setTurn((n) => n + 1);
      busy.current = false;
    }, prefersReducedMotion() ? 0 : EXIT_MS[how]);
    push({ message, actionLabel: 'Undo', onAction: () => undoRef.current(), duration: 5000, replaceKey: 'focus' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, queue, outcomes, passed, stopStaying, push]);

  /** A change that keeps the card on screen: pin, move, note. */
  const tweak = useCallback((act: () => () => void, message: string) => {
    if (!task) return;
    const revert = act();
    setHistory((h) => [...h, snapshot(revert)]);
    setMenu(null);
    push({ message, actionLabel: 'Undo', onAction: () => undoRef.current(), duration: 5000, replaceKey: 'focus' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, queue, outcomes, passed, push]);

  const historyRef = useRef(history);
  historyRef.current = history;
  const undo = useCallback(() => {
    const last = historyRef.current.at(-1);
    if (busy.current || !last) return;
    last.revert?.();
    setQueue(last.queue);
    setOutcomes(last.outcomes);
    setPassed(last.passed);
    setMenu(null);
    setHistory(historyRef.current.slice(0, -1));
  }, []);
  const undoRef = useRef(undo);
  undoRef.current = undo;

  const patch = (t: Task, p: Parameters<typeof update.mutate>[0]['patch']) => {
    const before = Object.fromEntries(Object.keys(p).map((k) => [k, t[k as keyof Task]])) as typeof p;
    update.mutate({ id: t.id, patch: p });
    return () => update.mutate({ id: t.id, patch: before });
  };

  const actions = {
    done: () => task && go('done', () => {
      announceTick();
      return patch(task, { done: true, cleared_at: null });
    }, 'Done.'),
    later: () => task && go('later', () => undefined, 'Later. It comes round again.'),
    snooze: (iso: string, label: string) => task && go('snoozed', () => patch(task, { due: iso }), `Snoozed to ${label.toLowerCase()}.`),
    remove: () => {
      if (!task) return;
      const copy = { ...task };
      go('gone', () => { remove(copy.id); return () => restore(copy); }, 'Deleted.');
    },
    pin: () => task && tweak(() => patch(task, { do_now: !task.do_now }), task.do_now ? 'Off Do now.' : 'On Do now.'),
    move: (s: Section) => task && tweak(
      () => patch(task, { section_id: s.id, stream_id: s.stream_id }),
      `Moved to ${streams.find((x) => x.id === s.stream_id)?.short ?? 'that project'} → ${s.title}.`,
    ),
    note: (text: string) => task && tweak(() => patch(task, { note: text.trim() || null }), 'Note saved.'),
    stay: () => {
      if (staying !== null) { stopStaying(); return; }
      setNow(Date.now());
      setStaying(Date.now());
    },
  };

  // The keys. A pressed key lights its button, so the keyboard is seen to act.
  useEffect(() => {
    if (finished) return;
    const flash = (k: string) => { setPressed(k); window.setTimeout(() => setPressed((p) => (p === k ? null : p)), 180); };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT';
      if (e.key === 'Escape') {
        e.preventDefault();
        if (menu) setMenu(null); else if (staying !== null) stopStaying(); else onClose();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (menu === 'delete' && e.key === 'Enter') { e.preventDefault(); actions.remove(); return; }
      if (menu === 'snooze' && /^[1-4]$/.test(e.key)) {
        const d = quickDates()[Number(e.key) - 1];
        e.preventDefault(); actions.snooze(d.iso, d.label); return;
      }
      if (menu) return;
      const k = e.key.toLowerCase();
      const map: Record<string, () => void> = {
        d: actions.done, s: actions.stay, l: actions.later, t: () => setMenu('snooze'),
        p: actions.pin, m: () => setMenu('move'), n: () => setMenu('note'), z: undo,
        backspace: () => setMenu('delete'), delete: () => setMenu('delete'),
      };
      if (map[k]) { e.preventDefault(); flash(k === 'delete' ? 'backspace' : k); map[k](); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (finished) {
    const count = (o: Outcome) => Object.values(outcomes).filter((x) => x === o).length;
    return <End done={count('done')} snoozed={count('snoozed')} gone={count('gone')} total={ids.length} spent={spent} onAgain={onAgain} onClose={onClose} />;
  }

  const doneCount = Object.values(outcomes).filter((o) => o === 'done').length;
  const allPassed = live.length > 0 && live.every((id) => (passed[id] ?? 0) > 0);

  return (
    <div className="fx__run" data-staying={staying !== null ? '' : undefined}>
      <header className="fx__top fx__fade">
        <span className="label">One by one</span>
        {ids.length <= MAX_TICKS ? (
          <ol className="fx__ticks" aria-hidden="true">
            {ids.map((id) => (
              <li key={id} data-state={outcomes[id] ?? (id === task?.id ? 'here' : (passed[id] ? 'passed' : 'open'))} />
            ))}
          </ol>
        ) : (
          // Too many for a tick each: one bar, filling as the pile goes down.
          <span className="fx__bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${(ids.length - live.length) / ids.length})` }} />
          </span>
        )}
        <span className="fx__tally"><Num value={doneCount} /> done · <Num value={live.length} /> to go</span>
        <button type="button" className="fx__close" onClick={onClose} aria-label="Stop and go back"><Close /></button>
      </header>

      <div className="fx__stage">
        {allPassed && !exit && (
          <p className="fx__round fx__fade">Everything left is something you&rsquo;ve passed over once. Go round again, or stop here.</p>
        )}
        {task && (
          <Card
            key={`${task.id}:${turn}`}
            task={task}
            exit={exit}
            today={today}
            stream={streams.find((s) => s.id === task.stream_id)}
            section={sections.find((s) => s.id === task.section_id)}
            parent={sections.find((s) => s.id === sections.find((x) => x.id === task.section_id)?.parent_id)}
            waiting={people.filter((p) => links.some((l) => l.task_id === task.id && l.person_id === p.id)).map((p) => p.name)}
            memory={memory.find((m) => m.kind === 'project' && m.key === task.stream_id)?.now || null}
            staying={staying === null ? null : now - staying}
            editingNote={menu === 'note'}
            onSaveNote={actions.note}
            onCancelNote={() => setMenu(null)}
            onEditNote={() => setMenu('note')}
          />
        )}

        {task && (
          <div className="fx__actions" key={menu ?? 'main'}>
            {menu === null && (
              <>
                <div className="fx__main">
                  <Act k="d" pressed={pressed} primary label="Done" onClick={actions.done} />
                  <Act k="s" pressed={pressed} label={staying !== null ? 'Step away' : 'Stay with it'} on={staying !== null} onClick={actions.stay} />
                  <Act k="l" pressed={pressed} label="Later" onClick={actions.later} />
                  <Act k="t" pressed={pressed} label="Snooze…" onClick={() => setMenu('snooze')} />
                </div>
                <div className="fx__more fx__fade">
                  <Small k="p" pressed={pressed} label={task.do_now ? 'Take off Do now' : 'Put on Do now'} onClick={actions.pin} />
                  <Small k="m" pressed={pressed} label="Move…" onClick={() => setMenu('move')} />
                  <Small k="z" pressed={pressed} label="Undo" onClick={undo} disabled={!history.length} />
                  <Small k="backspace" pressed={pressed} label="Delete" danger onClick={() => setMenu('delete')} />
                </div>
              </>
            )}
            {menu === 'snooze' && (
              <div className="fx__menu" role="group" aria-label="Snooze until">
                {quickDates().map((d, i) => (
                  <button key={d.iso} type="button" className="fx__opt" onClick={() => actions.snooze(d.iso, d.label)}>
                    {d.label}<kbd>{i + 1}</kbd>
                  </button>
                ))}
                <label className="fx__opt fx__opt--date">
                  <span>Pick a day</span>
                  <input type="date" min={today} aria-label="Pick a day"
                    onChange={(e) => e.target.value && actions.snooze(e.target.value, dueLine(e.target.value, today).text)} />
                </label>
                <button type="button" className="fx__opt fx__opt--quiet" onClick={() => setMenu(null)}>Cancel <kbd>esc</kbd></button>
              </div>
            )}
            {menu === 'move' && (
              <MovePicker streams={streams} sections={sections} current={task.section_id} onPick={actions.move} onCancel={() => setMenu(null)} />
            )}
            {menu === 'delete' && (
              <div className="fx__menu fx__menu--confirm" role="group" aria-label="Delete this item?">
                <span>Delete this item?</span>
                <button type="button" className="fx__opt fx__opt--danger" onClick={actions.remove}>Delete <kbd>↵</kbd></button>
                <button type="button" className="fx__opt fx__opt--quiet" onClick={() => setMenu(null)}>Keep it <kbd>esc</kbd></button>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="fx__keys fx__fade" aria-hidden="true">
        <span><kbd>D</kbd> done</span><span><kbd>S</kbd> stay</span><span><kbd>L</kbd> later</span>
        <span><kbd>T</kbd> snooze</span><span><kbd>N</kbd> note</span><span><kbd>M</kbd> move</span>
        <span><kbd>P</kbd> do now</span><span><kbd>Z</kbd> undo</span><span><kbd>esc</kbd> back</span>
      </footer>
    </div>
  );
}

function Act({ k, label, onClick, primary, on, pressed }: {
  k: string; label: string; onClick: () => void; primary?: boolean; on?: boolean; pressed: string | null;
}) {
  return (
    <button type="button" className={`fx__act${primary ? ' fx__act--primary' : ''}`} onClick={onClick}
      aria-pressed={on === undefined ? undefined : on} data-pressed={pressed === k ? '' : undefined}>
      <span>{label}</span><kbd>{k.toUpperCase()}</kbd>
    </button>
  );
}

function Small({ k, label, onClick, danger, disabled, pressed }: {
  k: string; label: string; onClick: () => void; danger?: boolean; disabled?: boolean; pressed: string | null;
}) {
  return (
    <button type="button" className={`fx__small${danger ? ' fx__small--danger' : ''}`} onClick={onClick}
      disabled={disabled} data-pressed={pressed === k ? '' : undefined}>
      {label}
    </button>
  );
}

// ── the card ───────────────────────────────────────────────────────

function Card({
  task, exit, today, stream, section, parent, waiting, memory, staying,
  editingNote, onSaveNote, onCancelNote, onEditNote,
}: {
  task: Task; exit: Exit | null; today: string;
  stream?: Stream; section?: Section; parent?: Section;
  waiting: string[]; memory: string | null; staying: number | null;
  editingNote: boolean; onSaveNote: (text: string) => void; onCancelNote: () => void; onEditNote: () => void;
}) {
  const due = dueLine(task.due, today);
  const age = ageOf(task.created_at, today);
  const [draft, setDraft] = useState(task.note ?? '');
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editingNote) return;
    setDraft(task.note ?? '');
    const t = box.current;
    if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNote]);

  let i = 0;
  const lift = () => ({ '--i': i++ } as React.CSSProperties);

  return (
    <article className="fx__card" data-exit={exit ?? undefined} data-staying={staying !== null ? '' : undefined}
      aria-labelledby="fx-title">
      {staying !== null && <span className="fx__sweep" aria-hidden="true" />}
      <div className="fx__where" style={lift()}>
        <span className="fx__code">{stream?.code ?? '—'}</span>
        <span className="fx__crumb">
          {stream?.title}
          {parent && <> <i>→</i> {parent.title}</>}
          {section && <> <i>→</i> {section.title}</>}
        </span>
        <span className="fx__badges">
          {task.kind === 'watch' && <span className="fx__badge fx__badge--line">Watching</span>}
          {task.do_now && <span className="fx__badge">Do now</span>}
        </span>
      </div>

      <h2 id="fx-title" className="fx__title" style={lift()}>
        <span>{task.title}</span>
      </h2>
      {exit === 'done' && <span className="fx__stamp" aria-hidden="true">Done</span>}

      <dl className="fx__facts" style={lift()}>
        <div><dt className="label">Due</dt><dd className={due.late ? 'is-late' : undefined}>{due.text}</dd></div>
        <div><dt className="label">On the list</dt><dd>{age === 0 ? 'Since today' : `${age} day${age === 1 ? '' : 's'}`}</dd></div>
        {waiting.length > 0 && <div><dt className="label">Waiting on</dt><dd>{waiting.join(', ')}</dd></div>}
        {task.tag && <div><dt className="label">Filed under</dt><dd>{task.tag}</dd></div>}
      </dl>

      {task.context && <p className="fx__context" style={lift()}>{task.context}</p>}

      <div className="fx__note" style={lift()}>
        {editingNote ? (
          <form onSubmit={(e) => { e.preventDefault(); onSaveNote(draft); }}>
            <label className="label" htmlFor="fx-note">Your note</label>
            <textarea id="fx-note" ref={box} className="textarea" value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSaveNote(draft); }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancelNote(); }
              }} />
            <div className="fx__noteacts">
              <button type="submit" className="fx__opt fx__opt--solid">Save note <kbd>⌘↵</kbd></button>
              <button type="button" className="fx__opt fx__opt--quiet" onClick={onCancelNote}>Cancel</button>
            </div>
          </form>
        ) : task.note ? (
          <button type="button" className="fx__notebody" onClick={onEditNote} aria-label="Edit your note">
            <span className="label">Your note</span>
            <span>{task.note}</span>
          </button>
        ) : (
          <button type="button" className="fx__addnote" onClick={onEditNote}>+ Add a note</button>
        )}
      </div>

      {memory && (
        <aside className="fx__memory" style={lift()}>
          <span className="label">Where {stream?.short ?? 'this'} stands</span>
          <p>{memory}</p>
        </aside>
      )}

      {staying !== null && (
        <div className="fx__staying">
          <span className="fx__breath" aria-hidden="true" />
          <span className="fx__clock" role="timer" aria-label="Time with this item">{clock(staying)}</span>
          <span className="fx__stayline">With this one. Everything else can wait.</span>
        </div>
      )}
    </article>
  );
}

function MovePicker({ streams, sections, current, onPick, onCancel }: {
  streams: Stream[]; sections: Section[]; current: string; onPick: (s: Section) => void; onCancel: () => void;
}) {
  const label = (s: Section) => {
    const parent = s.parent_id ? sections.find((p) => p.id === s.parent_id) : null;
    return parent ? `${parent.title} → ${s.title}` : s.title;
  };
  return (
    <div className="fx__move" role="group" aria-label="Move to">
      <div className="fx__movelist">
        {streams.map((st) => {
          const mine = sections.filter((s) => s.stream_id === st.id).sort((a, b) => a.position - b.position);
          if (!mine.length) return null;
          return (
            <div key={st.id} className="fx__movegroup">
              <span className="label">{st.code} · {st.short}</span>
              <div className="fx__chips">
                {mine.map((s) => (
                  <button key={s.id} type="button" className="fx__chip" aria-pressed={s.id === current}
                    disabled={s.id === current} onClick={() => onPick(s)}>{label(s)}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="fx__opt fx__opt--quiet" onClick={onCancel}>Cancel <kbd>esc</kbd></button>
    </div>
  );
}

// ── the end ────────────────────────────────────────────────────────

function End({ done, snoozed, gone, total, spent, onAgain, onClose }: {
  done: number; snoozed: number; gone: number; total: number; spent: number;
  onAgain: () => void; onClose: () => void;
}) {
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => { again.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lines: [string, string | number][] = [
    ['Done', done],
    ['Snoozed', snoozed],
    ['Deleted', gone],
    ['Left as they were', Math.max(0, total - done - snoozed - gone)],
  ];
  if (spent > 0) lines.push(['Time staying with things', minutes(spent)]);

  return (
    <div className="fx__end">
      <span className="label fx__endkicker">End of the run</span>
      <div className="fx__endnum">{done}</div>
      <h2 className="fx__endh">
        {done === 0 ? 'All looked at.' : done === total ? 'Every one done.' : `${done} done. The list is ${done + gone} lighter.`}
      </h2>
      <ul className="fx__ledger">
        {lines.map(([k, v], i) => (
          <li key={k} style={{ '--i': i } as React.CSSProperties}><span>{k}</span><b>{v}</b></li>
        ))}
      </ul>
      <div className="fx__endacts">
        <button ref={again} type="button" className="fx__start" onClick={onAgain}>Another pile</button>
        <button type="button" className="fx__opt fx__opt--quiet" onClick={onClose}>Back to the list</button>
      </div>
    </div>
  );
}
