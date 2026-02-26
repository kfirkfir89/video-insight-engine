import { useState } from 'react';
import { setApiKey } from '../lib/api';

export function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      setApiKey(key.trim());
      onLogin();
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
          onChange={(e) => setKey(e.target.value)}
          placeholder="Admin API Key"
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] mb-4 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <button
          type="submit"
          className="w-full py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-opacity"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
