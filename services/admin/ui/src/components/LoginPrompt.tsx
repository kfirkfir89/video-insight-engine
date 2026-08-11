import { useState } from 'react';
import { setApiKey } from '../lib/api';

export function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      if (res.status === 401 || res.status === 403) {
        setError('Invalid email or password.');
        return;
      }
      if (!res.ok) {
        setError(`Admin API returned ${res.status}. Try again.`);
        return;
      }
      const data: { token: string } = await res.json();
      setApiKey(data.token);
      onLogin();
    } catch {
      setError("Couldn't reach the admin API. Is the server running?");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] mb-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-60';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)]">
        <h1 className="text-xl font-semibold mb-1">VIE Admin</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">Sign in with your admin account</p>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
          placeholder="Email"
          autoComplete="email"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          disabled={submitting}
          className={inputClass}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
          placeholder="Password"
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          disabled={submitting}
          className={inputClass}
        />
        {error && (
          <p
            id="login-error"
            role="alert"
            className="text-xs text-[var(--color-danger)] mb-3"
          >
            {error}
          </p>
        )}
        {!error && <div className="mb-3" />}
        <button
          type="submit"
          disabled={submitting || !email.trim() || !password}
          className="w-full py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
