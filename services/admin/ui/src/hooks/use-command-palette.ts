import { useCallback, useEffect, useState } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export interface UseCommandPaletteResult {
  open: boolean;
  setOpen: (v: boolean) => void;
}

/**
 * Global command palette open-state hook.
 * Cmd/Ctrl+K opens, '/' opens when no editable element has focus, Esc closes.
 */
export function useCommandPalette(): UseCommandPaletteResult {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setOpen((prev) => !prev);
      return;
    }
    if (event.key === '/' && !isEditableTarget(event.target)) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === 'Escape') {
      setOpen((prev) => (prev ? false : prev));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return { open, setOpen };
}
