import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CommandPalette } from '../CommandPalette';

function renderPalette() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {/* eslint-disable-next-line no-restricted-syntax -- deliberate bare
            native button: the test asserts raw DOM focus mechanics without
            <Button>'s wrapper behavior */}
        <button type="button">trigger</button>
        <CommandPalette />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CommandPalette', () => {
  describe('focus restoration', () => {
    it('should move focus to the search input when opened', async () => {
      renderPalette();
      const trigger = screen.getByRole('button', { name: 'trigger' });
      act(() => trigger.focus());

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      const input = await screen.findByRole('combobox', {
        name: 'Command palette search',
      });
      // Input focus is deferred to the next animation frame after the portal mounts.
      await waitFor(() => expect(input).toHaveFocus());
    });

    it('should restore focus to the previously focused element when closed with Escape', async () => {
      renderPalette();
      const trigger = screen.getByRole('button', { name: 'trigger' });
      act(() => trigger.focus());

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      const input = await screen.findByRole('combobox', {
        name: 'Command palette search',
      });
      await waitFor(() => expect(input).toHaveFocus());

      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() =>
        expect(
          screen.queryByRole('combobox', { name: 'Command palette search' }),
        ).toBeNull(),
      );
      await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('should not steal focus on mount when the palette was never opened', () => {
      renderPalette();
      const trigger = screen.getByRole('button', { name: 'trigger' });
      act(() => trigger.focus());
      expect(trigger).toHaveFocus();
    });
  });
});
