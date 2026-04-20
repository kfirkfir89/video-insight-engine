import { useState } from 'react';
import { setApiKey } from '../lib/api';

export function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = key.trim();
    if (!trimmed) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/health/services', {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (res.status === 401 || res.status === 403) {
        setError('Invalid API key. Check your .env.');
        return;
      }
      if (!res.ok) {
        setError(`Admin API returned ${res.status}. Try again.`);
        return;
      }
      setApiKey(trimmed);
      onLogin();
    } catch {
      setError("Couldn't reach the admin API. Is the server running?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)]">
        <h1 className="text-xl font-semibold mb-1">VIE Admin</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">Enter your API key to continue</p>
        <input
          type="password"
          value={key}
          onChange={(e) => { setKey(e.target.value); if (error) setError(null); }}
          placeholder="Admin API Key"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          disabled={submitting}
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] mb-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-60"
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
          disabled={submitting || !key.trim()}
          className="w-full py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
