import { useEffect, useMemo, useRef, useState } from 'react';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.25 9.25L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function matchesQuery(cmd: Command, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (cmd.label.toLowerCase().includes(needle)) return true;
  if (cmd.keywords?.some((k) => k.toLowerCase().includes(needle))) return true;
  return false;
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQueryState] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [prevOpen, setPrevOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Reset transient state synchronously when `open` transitions, using the
  // "derive state during render" pattern so we avoid setState-in-effect.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open && query !== '') setQueryState('');
    if (activeIdx !== 0) setActiveIdx(0);
  }

  const setQuery = (next: string) => {
    setQueryState(next);
    setActiveIdx(0);
  };

  const filtered = useMemo(() => commands.filter((c) => matchesQuery(c, query)), [commands, query]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[activeIdx];
      if (cmd) {
        cmd.action();
        onClose();
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onKeyDown={handleKeyDown}
      data-testid="command-palette"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full px-4 py-3 bg-transparent outline-none text-sm text-[var(--color-text)]"
            aria-label="Command search"
          />
        </div>
        <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">No commands match</li>
          ) : (
            filtered.map((cmd, i) => {
              const active = i === activeIdx;
              const cls = `w-full flex items-center justify-between gap-3 px-4 py-2 text-sm text-left ${
                active
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-text)]'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-surface-dim)]'
              }`;
              return (
                <li key={cmd.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cls}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                  >
                    <span className="truncate">{cmd.label}</span>
                    {cmd.hint ? (
                      <span className="text-xs text-[var(--color-text-faint)] font-mono">{cmd.hint}</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
