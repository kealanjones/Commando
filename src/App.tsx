import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import { Header, Nav } from '@/components/Chrome';
import { TaskSheet, type SheetPatch } from '@/components/TaskSheet';
import { AddSheet } from '@/components/AddSheet';
import { useToast } from '@/components/Toasts';
import { Today } from '@/routes/Today';
import { Streams } from '@/routes/Streams';
import { Periphery } from '@/routes/Periphery';
import { NotConfigured, SignIn } from '@/routes/SignIn';

import { configured, supabase } from '@/lib/supabase';
import { DEMO } from '@/lib/demo';
import {
  useCreateTask, useRealtime, useSections, useSoftDelete, useStreams, useUpdateTask,
} from '@/data/store';
import type { Task } from '@/lib/types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (DEMO || !configured) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (DEMO) return <Register email="kealan.jones@example.com" />;
  if (!configured) return <NotConfigured />;
  if (!ready) return null;
  if (!session) return <SignIn />;
  return <Register email={session.user.email ?? ''} />;
}

function Register({ email }: { email: string }) {
  const location = useLocation();
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

  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);

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

  const onPromote = useCallback(
    (task: Task) => {
      update.mutate({ id: task.id, patch: { kind: 'task' } });
      push({
        message: `Moved into ${streams.find((s) => s.id === task.stream_id)?.title ?? 'the stream'}.`,
        actionLabel: 'Undo',
        onAction: () => update.mutate({ id: task.id, patch: { kind: 'watch' } }),
      });
    },
    [update, push, streams],
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
        <Header email={email} onAdd={() => setAdding(true)} />
        {/* Inline in the document so it sits under the header on desktop;
            CSS pins it to the bottom of the viewport on a phone. */}
        <Nav />

        <Routes>
          <Route
            path="/"
            element={
              <Today
                onToggle={onToggle}
                onOpen={setEditing}
                onPromote={onPromote}
                recentlyDone={recentlyDone}
              />
            }
          />
          <Route
            path="/streams"
            element={<Streams onToggle={onToggle} onOpen={setEditing} onPromote={onPromote} />}
          />
          <Route
            path="/streams/:streamId"
            element={<Streams onToggle={onToggle} onOpen={setEditing} onPromote={onPromote} />}
          />
          <Route
            path="/periphery"
            element={<Periphery onOpen={setEditing} onPromote={onPromote} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

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
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
