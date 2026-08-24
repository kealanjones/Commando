import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from './Toasts';

/**
 * Offer the new version when one lands.
 *
 * The app deploys on every push, and the service worker keeps the shell
 * cached — so without this an open tab, or an installed home-screen app,
 * carries on running whatever it started with. Offering a reload rather than
 * forcing one matters: a forced refresh mid-sentence would lose a note being
 * typed, which is the one thing this app must never do.
 */
export function UpdatePrompt() {
  const { push } = useToast();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // A long-lived install would otherwise only notice on a cold start.
      if (registration) {
        window.setInterval(() => void registration.update(), 60 * 60 * 1000);
      }
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    push({
      message: 'A new version is ready.',
      actionLabel: 'Reload',
      onAction: () => void updateServiceWorker(true),
      duration: 0,
      replaceKey: 'sw-update',
    });
  }, [needRefresh, updateServiceWorker, push]);

  return null;
}
