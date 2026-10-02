import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllSections, useAllStreams, useAllTasks, useStructure } from '@/data/store';
import { useToast } from '@/components/Toasts';
import type { Realm, Section, Stream } from '@/lib/types';

const REALMS: [Realm, string][] = [['work', 'Work'], ['personal', 'Personal']];

/**
 * Organise: the whole structure on one page. Every project in both lives,
 * the sub-focuses inside each, and everything you can do to them.
 *
 * Nothing here ever deletes an item. A project or sub-focus with items in
 * it asks where they should go first, which is also how two sub-focuses
 * merge.
 */
export function Organise() {
  const { data: streams = [] } = useAllStreams();
  const { data: sections = [] } = useAllSections();
  const { data: tasks = [] } = useAllTasks();
  const act = useStructure();

  const count = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) m.set(t.section_id, (m.get(t.section_id) ?? 0) + 1);
    return m;
  }, [tasks]);

  const ordered = [...streams].sort((a, b) => a.position - b.position);
  const focusesOf = (id: string) =>
    sections.filter((s) => s.stream_id === id).sort((a, b) => a.position - b.position);

  return (
    <section className="org" aria-labelledby="org-head">
      <Link to="/projects" className="back">← Projects</Link>
      <header className="shead">
        <h2 id="org-head">Organise</h2>
        <span className="shead__meta">{streams.length} projects · {sections.length} sub-focuses</span>
      </header>
      <p className="org__lede">
        Projects and the sub-focuses inside them. Rename anything by typing over it.
        Deleting never deletes items: anything inside is moved somewhere first.
      </p>

      {REALMS.map(([realm, label]) => {
        const mine = ordered.filter((s) => s.realm === realm);
        if (!mine.length) return null;
        return (
          <div key={realm} className="org__realm">
            <h3 className="zone">{label}</h3>
            {mine.map((p, i) => (
              <Project
                key={p.id}
                project={p}
                first={i === 0}
                last={i === mine.length - 1}
                focuses={focusesOf(p.id)}
                count={count}
                streams={ordered}
                sections={sections}
                act={act}
              />
            ))}
          </div>
        );
      })}

      <NewProject act={act} />
    </section>
  );
}

type Act = ReturnType<typeof useStructure>;

/** Saves on Enter or when you leave the field, and only if it changed. */
function NameField({ value, onSave, label, className = '' }: {
  value: string; onSave: (v: string) => void; label: string; className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [was, setWas] = useState(value);
  if (value !== was) { setWas(value); setDraft(value); }
  const commit = () => {
    const v = draft.trim();
    if (!v) { setDraft(value); return; }
    if (v !== value) onSave(v);
  };
  return (
    <input
      className={`org__name ${className}`}
      value={draft}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

function Arrows({ name, first, last, onMove }: {
  name: string; first: boolean; last: boolean; onMove: (by: -1 | 1) => void;
}) {
  return (
    <span className="org__arrows">
      <button type="button" className="iconbtn" disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${name} up`}>↑</button>
      <button type="button" className="iconbtn" disabled={last} onClick={() => onMove(1)} aria-label={`Move ${name} down`}>↓</button>
    </span>
  );
}

/** Where items should go: every sub-focus except the ones being removed. */
function Destination({ sections, streams, exclude, value, onChange, label }: {
  sections: Section[]; streams: Stream[]; exclude: (s: Section) => boolean;
  value: string; onChange: (id: string) => void; label: string;
}) {
  return (
    <select className="select org__dest" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">Move them to…</option>
      {streams.map((p) => {
        const opts = sections.filter((s) => s.stream_id === p.id && !exclude(s));
        if (!opts.length) return null;
        return (
          <optgroup key={p.id} label={p.title}>
            {opts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}

function Project({ project: p, first, last, focuses, count, streams, sections, act }: {
  project: Stream; first: boolean; last: boolean; focuses: Section[];
  count: Map<string, number>; streams: Stream[]; sections: Section[]; act: Act;
}) {
  const { push } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [dest, setDest] = useState('');
  const [adding, setAdding] = useState('');
  const items = focuses.reduce((n, s) => n + (count.get(s.id) ?? 0), 0);

  const remove = () => {
    const to = sections.find((s) => s.id === dest);
    if (items && !to) return;
    if (act.deleteProject(p.id, to)) push({ message: `Deleted ${p.title}.` });
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = adding.trim();
    if (!t) return;
    await act.addFocus(p.id, t);
    setAdding('');
  };

  return (
    <article className="org__project" data-project={p.id}>
      <div className="org__phead">
        <NameField value={p.code} label={`Code for ${p.title}`} className="org__code" onSave={(v) => act.recodeProject(p.id, v)} />
        <NameField value={p.title} label={`Name of ${p.title}`} className="org__pname" onSave={(v) => act.renameProject(p.id, v)} />
        <span className="seg org__realmseg" role="group" aria-label={`${p.title} is`}>
          {REALMS.map(([r, l]) => (
            <button key={r} type="button" aria-pressed={p.realm === r} onClick={() => act.setRealm(p.id, r)}>{l}</button>
          ))}
        </span>
        <Arrows name={p.title} first={first} last={last} onMove={(by) => act.moveProject(p.id, by)} />
        <button type="button" className="linkish org__del" onClick={() => setDeleting((v) => !v)}>Delete</button>
      </div>

      {deleting && (
        <div className="org__confirm" role="group" aria-label={`Delete ${p.title}`}>
          {items ? (
            <>
              <span>{p.title} has {items} item{items === 1 ? '' : 's'}.</span>
              <Destination sections={sections} streams={streams} exclude={(s) => s.stream_id === p.id}
                value={dest} onChange={setDest} label={`Where ${p.title}'s items go`} />
            </>
          ) : <span>Delete {p.title} and its {focuses.length} empty sub-focus{focuses.length === 1 ? '' : 'es'}?</span>}
          <button type="button" className="btn btn--primary" disabled={Boolean(items) && !dest} onClick={remove}>
            {items ? 'Move and delete' : 'Delete'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setDeleting(false)}>Keep</button>
        </div>
      )}

      <ul className="org__focuses">
        {focuses.map((s, i) => (
          <Focus key={s.id} focus={s} first={i === 0} last={i === focuses.length - 1}
            n={count.get(s.id) ?? 0} streams={streams} sections={sections} act={act} />
        ))}
      </ul>

      <form className="org__add" onSubmit={add}>
        <input className="input" value={adding} onChange={(e) => setAdding(e.target.value)}
          placeholder="Add a sub-focus" aria-label={`New sub-focus in ${p.title}`} />
        <button type="submit" className="btn btn--ghost" disabled={!adding.trim()} aria-label={`Add sub-focus to ${p.title}`}>Add</button>
      </form>
    </article>
  );
}

function Focus({ focus: s, first, last, n, streams, sections, act }: {
  focus: Section; first: boolean; last: boolean; n: number;
  streams: Stream[]; sections: Section[]; act: Act;
}) {
  const { push } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [dest, setDest] = useState('');

  const remove = () => {
    const to = sections.find((x) => x.id === dest);
    if (n && !to) return;
    if (act.deleteFocus(s.id, to)) {
      push({ message: to ? `Merged ${s.title} into ${to.title}.` : `Deleted ${s.title}.` });
    }
  };

  return (
    <li className="org__focus" data-focus={s.id}>
      <div className="org__frow">
        <NameField value={s.title} label={`Name of ${s.title}`} onSave={(v) => act.renameFocus(s.id, v)} />
        <span className="org__n" title={`${n} item${n === 1 ? '' : 's'}`}>{n}</span>
        <Arrows name={s.title} first={first} last={last} onMove={(by) => act.moveFocus(s.id, by)} />
        <select className="select org__move" value="" aria-label={`Move ${s.title} to another project`}
          onChange={(e) => { if (e.target.value) { act.reparentFocus(s.id, e.target.value); push({ message: `Moved ${s.title}.` }); } }}>
          <option value="">Move to…</option>
          {streams.filter((p) => p.id !== s.stream_id).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button type="button" className="linkish org__del" onClick={() => setDeleting((v) => !v)}>Delete</button>
      </div>
      {deleting && (
        <div className="org__confirm" role="group" aria-label={`Delete ${s.title}`}>
          {n ? (
            <>
              <span>{n} item{n === 1 ? '' : 's'} in {s.title}.</span>
              <Destination sections={sections} streams={streams} exclude={(x) => x.id === s.id}
                value={dest} onChange={setDest} label={`Where ${s.title}'s items go`} />
            </>
          ) : <span>Delete {s.title}? It is empty.</span>}
          <button type="button" className="btn btn--primary" disabled={Boolean(n) && !dest} onClick={remove}>
            {n ? 'Move and delete' : 'Delete'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setDeleting(false)}>Keep</button>
        </div>
      )}
    </li>
  );
}

/** A new project starts with one sub-focus, so it can take items at once. */
function NewProject({ act }: { act: Act }) {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [realm, setRealmChoice] = useState<Realm>('work');
  const { push } = useToast();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const p = await act.addProject({ title: t, code: code.trim(), realm });
    await act.addFocus(p.id, 'General');
    setTitle(''); setCode('');
    push({ message: `Added ${t}.` });
  };

  return (
    <form className="org__new" onSubmit={add} aria-labelledby="org-new">
      <h3 id="org-new" className="zone">New project</h3>
      <div className="org__newrow">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name, e.g. ISODP 2027" aria-label="Project name" />
        <input className="input org__newcode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="Code" aria-label="Short code" />
        <span className="seg" role="group" aria-label="New project is">
          {REALMS.map(([r, l]) => (
            <button key={r} type="button" aria-pressed={realm === r} onClick={() => setRealmChoice(r)}>{l}</button>
          ))}
        </span>
        <button type="submit" className="btn btn--primary" disabled={!title.trim()}>Add project</button>
      </div>
      <p className="org__hint">It starts with one sub-focus, General. Rename it or add more above.</p>
    </form>
  );
}
