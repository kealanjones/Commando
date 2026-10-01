import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import { DeskBar, Index, PhoneBottom, PhoneTop } from '@/components/Chrome';
import { Folio } from '@/components/Folio';
import { TaskSheet, type SheetPatch } from '@/components/TaskSheet';
import { AddSheet } from '@/components/AddSheet';
import { Search } from '@/components/Search';
import { useToast } from '@/components/Toasts';
import { Today } from '@/routes/Today';
import { Streams } from '@/routes/Streams';
import { Intake } from '@/routes/Intake';
import { Brief } from '@/routes/Brief';
import { Plan } from '@/routes/Plan';
import { Review } from '@/routes/Review';
import { ReviewHub } from '@/routes/ReviewHub';
import { People } from '@/routes/People';
import { Person } from '@/routes/Person';
import { Settings } from '@/routes/Settings';
import { NotConfigured, SignIn } from '@/routes/SignIn';

import { configured, supabase } from '@/lib/supabase';
import { DEMO } from '@/lib/demo';
import { useApplyLook, useRealm } from '@/lib/modes';
import { SelectedContext, useWide } from '@/lib/selection';
import { ensureProfile } from '@/lib/profile';
import {
  useCreateTask, usePeople, useRealtime, useSections, useSoftDelete, useStreams, useTasks, useUpdateTask,
} from '@/data/store';
import { useTaskPeople } from '@/data/review';
import type { Task } from '@/lib/types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  // The look applies to every screen, sign-in included.
  useApplyLook();

  useEffect(() => {
    if (DEMO || !configured) { setReady(true); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        await ensureProfile(data.session.user.id, data.session.user.email ?? '');
      }
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' && s?.user) {
        void ensureProfile(s.user.id, s.user.email ?? '');
      }
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (DEMO) return <Register email="you@example.com" />;
  if (!configured) return <NotConfigured />;
  if (!ready) return null;
  if (!session) return <SignIn />;
  return <Register email={session.user.email ?? ''} />;
}

function Register({ email }: { email: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { push } = useToast();
  const wide = useWide();
  useRealtime();

  const { data: streams = [] } = useStreams();
  const { data: sections = [] } = useSections();
  const { data: tasks = [] } = useTasks();
  const { data: people = [] } = usePeople();
  const { data: links = [] } = useTaskPeople();
  const update = useUpdateTask();
  const create = useCreateTask();
  const { remove, restore } = useSoftDelete();

  /** The card, on a narrow screen. */
  const [editing, setEditing] = useState<Task | null>(null);
  /** The folio, at a desk: an id, so it always shows the live row. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [recentlyDone, setRecentlyDone] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  const selected = useMemo(
    () => (selectedId ? tasks.find((t) => t.id === selectedId) ?? null : null),
    [tasks, selectedId],
  );
  const waitingOn = useMemo(() => {
    if (!selected) return [];
    const ids = new Set(links.filter((l) => l.task_id === selected.id).map((l) => l.person_id));
    return people.filter((p) => ids.has(p.id)).map((p) => p.name);
  }, [selected, links, people]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);

  // The page wears the realm, so which life is showing is ambient.
  const realm = useRealm();
  useEffect(() => {
    document.body.dataset.realm = realm;
    return () => { delete document.body.dataset.realm; };
  }, [realm]);

  const onToggle = useCallback(
    (task: Task) => {
      const next = !task.done;
      update.mutate({ id: task.id, patch: { done: next } });

      if (!next) {
        setRecentlyDone((ids) => ids.filter((id) => id !== task.id));
        return;
      }

      // Hold the row on screen for as long as the undo is offered.
      setRecentlyDone((ids) => (ids.includes(task.id) ? ids : [...ids, task.id]));
      window.setTimeout(
        () => setRecentlyDone((ids) => ids.filter((id) => id !== task.id)),
        5200,
      );

      push({
        message: 'Done.',
        actionLabel: 'Undo',
        onAction: () => {
          update.mutate({ id: task.id, patch: { done: false } });
          setRecentlyDone((ids) => ids.filter((id) => id !== task.id));
        },
        duration: 5000,
      });
    },
    [update, push],
  );

  const onDelete = useCallback(
    (task: Task) => {
      remove(task.id);
      setEditing(null);
      setSelectedId((id) => (id === task.id ? null : id));
      push({
        message: 'Deleted.',
        actionLabel: 'Undo',
        onAction: () => restore(task),
        duration: 9000,
      });
    },
    [remove, restore, push],
  );

  const onSave = useCallback(
    (task: Task, patch: SheetPatch) => update.mutate({ id: task.id, patch }),
    [update],
  );

  /** At a desk an item opens beside the list; on a phone it lifts off it. */
  const onOpen = useCallback(
    (task: Task) => (wide ? setSelectedId(task.id) : setEditing(task)),
    [wide],
  );

  // Keyboard. "/" and Cmd/Ctrl+K search and N adds anywhere; at a desk the
  // list is driven from the keys as well. Nothing fires while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
        || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setSearching(true); return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setSearching(true); return; }
      if (searching || adding || editing) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setAdding(true); return; }
      if (!wide) return;

      const rows = [...document.querySelectorAll<HTMLElement>('main [data-task]')];
      const ids = rows.map((r) => r.dataset.task!);
      const at = selectedId ? ids.indexOf(selectedId) : -1;
      const go = (i: number) => {
        const id = ids[Math.max(0, Math.min(ids.length - 1, i))];
        if (!id) return;
        setSelectedId(id);
        rows[ids.indexOf(id)]?.scrollIntoView({ block: 'nearest' });
      };

      switch (e.key) {
        case 'j': case 'J': e.preventDefault(); go(at + 1); break;
        case 'k': case 'K': e.preventDefault(); go(at < 0 ? 0 : at - 1); break;
        case 'Escape': setSelectedId(null); break;
        case 'Enter':
          if (selected) { e.preventDefault(); document.getElementById('folio-title')?.focus(); }
          break;
        case 'x': case 'X': if (selected) { e.preventDefault(); onToggle(selected); } break;
        case 'u': case 'U':
          if (selected) { e.preventDefault(); update.mutate({ id: selected.id, patch: { do_now: !selected.do_now } }); }
          break;
        case 'd': case 'D':
          if (selected) { e.preventDefault(); document.getElementById('folio-due')?.focus(); }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, selectedId, selected, searching, adding, editing, onToggle, update]);

  return (
    <SelectedContext.Provider value={wide ? selectedId : null}>
      <div className="shell">
        <a className="skip" href="#main">Skip to content</a>

        <Index />

        <main className="page" id="main">
          <PhoneTop onSearch={() => setSearching(true)} />
          <DeskBar onAdd={() => setAdding(true)} onSearch={() => setSearching(true)} />

          <div className="page__body">
            <Routes>
              <Route path="/" element={<Today onToggle={onToggle} onOpen={onOpen} recentlyDone={recentlyDone} />} />
              <Route path="/streams" element={<Streams onToggle={onToggle} onOpen={onOpen} />} />
              <Route path="/streams/:streamId" element={<Streams onToggle={onToggle} onOpen={onOpen} />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/:personId" element={<Person onToggle={onToggle} onOpen={onOpen} />} />
              <Route path="/people/:personId/review" element={<Review />} />
              <Route path="/review" element={<ReviewHub />} />
              <Route path="/review/decide" element={<Review />} />
              <Route path="/review/plan" element={<Plan onOpenTask={onOpen} />} />
              <Route path="/brief" element={<Brief onOpenTask={onOpen} />} />
              <Route path="/intake" element={<Intake />} />
              <Route path="/settings" element={<Settings email={email} />} />
              {/* Old addresses, so a bookmark or the installed app still lands. */}
              <Route path="/plan" element={<Navigate to="/review/plan" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          <PhoneBottom onAdd={() => setAdding(true)} />
        </main>

        {wide && (
          <aside className="folio-pane" aria-label="Selected item">
            <Folio
              task={selected}
              streams={streams}
              sections={sections}
              waitingOn={waitingOn}
              onSave={onSave}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          </aside>
        )}
      </div>

      {searching && (
        <Search onOpenTask={onOpen} onClose={() => setSearching(false)} />
      )}

      {editing && (
        <TaskSheet
          key={editing.id}
          task={editing}
          streams={streams}
          sections={sections}
          onSave={(patch) => onSave(editing, patch)}
          onDelete={() => onDelete(editing)}
          onClose={() => setEditing(null)}
        />
      )}

      {adding && (
        <AddSheet
          streams={streams}
          sections={sections}
          onCreate={(input) => {
            create.mutate(input);
            push({ message: 'Added.' });
          }}
          onIntake={() => { setAdding(false); navigate('/intake'); }}
          onClose={() => setAdding(false)}
        />
      )}
    </SelectedContext.Provider>
  );
}
