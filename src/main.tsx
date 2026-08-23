import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import { DEMO, demoSections, demoStreams, demoTasks } from './lib/demo';
import { keys } from './data/store';
import { ToastProvider } from './components/Toasts';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';

// A standalone single-file build has no server to rewrite /streams, so it
// routes on the hash instead.
const Router = import.meta.env.VITE_HASH_ROUTER === '1' ? HashRouter : BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The app is opened on the Underground. Serve from cache, refetch
      // when it can, and never throw the screen away because a fetch failed.
      retry: 2,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
      gcTime: 24 * 60 * 60 * 1000,
    },
    mutations: { networkMode: 'always' },
  },
});

if (DEMO) {
  queryClient.setQueryData(keys.streams, demoStreams());
  queryClient.setQueryData(keys.sections, demoSections());
  queryClient.setQueryData(keys.tasks, demoTasks());
  queryClient.setQueryData(keys.people, []);
  queryClient.setQueryData(['task_people'], []);
  queryClient.setDefaultOptions({ queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <ToastProvider>
          <App />
        </ToastProvider>
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
