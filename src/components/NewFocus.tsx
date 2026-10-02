import { useEffect, useRef, useState } from 'react';
import { useAllStreams, useStructure } from '@/data/store';
import { useRealm } from '@/lib/modes';
import type { Section } from '@/lib/types';

const NEW_PROJECT = '__new__';

/**
 * "+ New" beside a sub-focus picker: make the sub-focus (or a whole new
 * project with its first sub-focus) without leaving what you are filing,
 * and have it picked straight away.
 *
 * Not a <form>: it sits inside forms (New item), and a nested form is
 * invalid. Enter is caught here so it never submits the outer one.
 */
export function NewFocus({ idPrefix, streamId, onCreated }: {
  /** Keeps field ids unique where several pickers share a page. */
  idPrefix: string;
  /** The project the picker is on now: the natural place for a new one. */
  streamId?: string;
  onCreated: (section: Section) => void;
}) {
  const { data: streams = [] } = useAllStreams();
  const realm = useRealm();
  const act = useStructure();
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState(streamId ?? '');
  const [projectName, setProjectName] = useState('');
  const [name, setName] = useState('');
  const first = useRef<HTMLInputElement>(null);
  // One creation at a time: a double-click or a held Enter must not make two.
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const pname = useRef<HTMLInputElement>(null);

  // Offer the projects in the life on show first; both when on Both.
  const shown = streams
    .filter((s) => realm === 'all' || s.realm === realm)
    .sort((a, b) => a.position - b.position);

  useEffect(() => {
    if (!open) return;
    setProject(streamId && shown.some((s) => s.id === streamId) ? streamId : shown[0]?.id ?? NEW_PROJECT);
    window.setTimeout(() => first.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const making = project === NEW_PROJECT;
  const ready = making ? projectName.trim().length > 0 : name.trim().length > 0 && Boolean(project);

  const close = () => { setOpen(false); setName(''); setProjectName(''); };

  const create = async () => {
    if (!ready || busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await make();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const make = async () => {
    let target = project;
    if (making) {
      const p = await act.addProject({
        title: projectName.trim(), code: '', realm: realm === 'personal' ? 'personal' : 'work',
      });
      target = p.id;
    }
    const s = await act.addFocus(target, name.trim() || 'General');
    onCreated(s);
    close();
  };

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void create(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };

  if (!open) {
    return (
      <button type="button" className="newfocus__open" onClick={() => setOpen(true)}
        aria-label="New sub-focus or project">
        + New
      </button>
    );
  }

  return (
    <div className="newfocus" role="group" aria-label="New sub-focus" onKeyDown={keys}>
      <div className="newfocus__row">
        <label className="label" htmlFor={`${idPrefix}-nf-project`}>In</label>
        <select id={`${idPrefix}-nf-project`} className="select" value={project}
          onChange={(e) => {
            setProject(e.target.value);
            // A new project needs its name first.
            if (e.target.value === NEW_PROJECT) window.setTimeout(() => pname.current?.focus(), 0);
          }}>
          {shown.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          <option value={NEW_PROJECT}>New project…</option>
        </select>
      </div>
      {making && (
        <div className="newfocus__row">
          <label className="label" htmlFor={`${idPrefix}-nf-pname`}>Project</label>
          <input id={`${idPrefix}-nf-pname`} ref={pname} className="input" value={projectName}
            onChange={(e) => setProjectName(e.target.value)} placeholder="Name of the new project" />
        </div>
      )}
      <div className="newfocus__row">
        <label className="label" htmlFor={`${idPrefix}-nf-name`}>Sub-focus</label>
        <input id={`${idPrefix}-nf-name`} ref={first} className="input" value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={making ? 'General' : 'e.g. Sponsorship'} />
      </div>
      <div className="newfocus__acts">
        <button type="button" className="btn btn--ghost" onClick={close}>Cancel</button>
        <button type="button" className="btn btn--primary" disabled={!ready || saving} onClick={() => void create()}>
          {making ? 'Add project' : 'Add sub-focus'}
        </button>
      </div>
    </div>
  );
}
