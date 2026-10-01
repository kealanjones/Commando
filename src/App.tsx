import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import { Header, Nav } from '@/components/Chrome';
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
import { NotConfigured, SignIn } from '@/routes/SignIn';

import { configured, supabase } from '@/lib/supabase';
import { DEMO } from '@/lib/demo';
import { useRealm } from '@/lib/modes';
import { ensureProfile } from '@/lib/profile';
import {
  useCreateTask, useRealtime, useSections, useSoftDelete, useStreams, useUpdateTask,
} from '@/data/store';
import type { Task } from '@/lib/types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

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

  if (DEMO) return <Register />;
  if (!configured) return <NotConfigured />;
  if (!ready) return null;
  if (!session) return <SignIn />;
  return <Register />;
}

function Register() {
  const location = useLocation();
  const navigate = useNavigate();
  const { push } = useToast();
  useRealtime();

  const { data: streams = [] } = useStreams();
  const { data: sections = [] } = useSections();
  const update = useUpdateTask();
  const create = useCreateTask();
  const { remove, restore } = useSoftDelete();

  const [editing, setEditing] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  const [recentlyDone, setRecentlyDone] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);

  // The page wears the realm, so which life is showing is ambient.
  const realm = useRealm();
  useEffect(() => {
    document.body.dataset.realm = realm;
    return () => { delete document.body.dataset.realm; };
  }, [realm]);

  // Cmd/Ctrl+K and plain "/" both open search, the two conventions people
  // already have in their fingers. Ignored while typing into a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearching(true);
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>

      <main className="page" id="main">
        <Header onAdd={() => setAdding(true)} onSearch={() => setSearching(true)} />
        {/* Inline in the document so it sits under the header on desktop;
            CSS pins it to the bottom of the viewport on a phone. */}
        <Nav />

        <Routes>
          <Route path="/" element={<Today onToggle={onToggle} onOpen={setEditing} recentlyDone={recentlyDone} />} />
          <Route path="/streams" element={<Streams onToggle={onToggle} onOpen={setEditing} />} />
          <Route path="/streams/:streamId" element={<Streams onToggle={onToggle} onOpen={setEditing} />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:personId" element={<Person onToggle={onToggle} onOpen={setEditing} />} />
          <Route path="/people/:personId/review" element={<Review />} />
          <Route path="/review" element={<ReviewHub />} />
          <Route path="/review/decide" element={<Review />} />
          <Route path="/review/plan" element={<Plan onOpenTask={setEditing} />} />
          <Route path="/brief" element={<Brief onOpenTask={setEditing} />} />
          <Route path="/intake" element={<Intake />} />
          {/* Old addresses, so a bookmark or the installed app still lands. */}
          <Route path="/plan" element={<Navigate to="/review/plan" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {searching && (
        <Search onOpenTask={setEditing} onClose={() => setSearching(false)} />
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
    </div>
  );
}
