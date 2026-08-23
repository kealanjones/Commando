import { useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Magic link, with `shouldCreateUser: false`.
 *
 * That flag is the important one. Left at its default, anyone who reads the
 * anon key out of the JS bundle could sign themselves up and create an
 * account inside the project. With it off, only accounts invited from the
 * Supabase dashboard can ever sign in, and an unknown address gets a clean
 * refusal instead of a mailbox.
 *
 * RLS, not this screen, is what protects the data — but there is no reason
 * to let strangers through the door either.
 */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      setError(
        /signups not allowed|not found|invalid/i.test(error.message)
          ? 'That address is not on this register. Invite it from the Supabase dashboard first.'
          : error.message,
      );
    } else {
      setSent(true);
    }
  };

  return (
    <div className="setup">
      <h1>Work Register</h1>
      <p style={{ marginTop: 0 }}>
        What must I do today, and which stream is falling behind.
      </p>

      {sent ? (
        <div className="nudge" style={{ marginTop: 26 }}>
          <span className="nudge__dot" />
          <p>
            Check <b>{email}</b> — the link signs you straight in. It expires in an hour.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ marginTop: 26 }}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13.5, marginTop: 10 }}>{error}</p>
          )}
          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send me a link'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function NotConfigured() {
  return (
    <div className="setup">
      <h1>Almost there</h1>
      <p>
        The app has no Supabase connection yet. Copy <code>.env.example</code> to{' '}
        <code>.env</code>, fill in your project URL and anon key, then restart the dev server.
      </p>
      <pre>
{`cp .env.example .env
# edit .env
npm run dev`}
      </pre>
      <p>
        Full setup, including the migrations and how to seed the register, is in the README.
      </p>
    </div>
  );
}
