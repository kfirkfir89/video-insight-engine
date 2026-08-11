import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette, type Command } from './CommandPalette';

function makeCommands(actions: Record<string, () => void> = {}): Command[] {
  return [
    { id: 'dash', label: 'Go to Dashboard', hint: 'g d', keywords: ['home'], action: actions.dash ?? (() => {}) },
    { id: 'videos', label: 'Go to Videos', hint: 'g v', keywords: ['list'], action: actions.videos ?? (() => {}) },
    { id: 'usage', label: 'Go to Usage', hint: 'g u', action: actions.usage ?? (() => {}) },
  ];
}

describe('CommandPalette', () => {
  it('should render nothing when closed', () => {
    const { container } = render(<CommandPalette open={false} onClose={() => {}} commands={makeCommands()} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render all commands when open', () => {
    render(<CommandPalette open={true} onClose={() => {}} commands={makeCommands()} />);
    expect(screen.getByText('Go to Dashboard')).toBeTruthy();
    expect(screen.getByText('Go to Videos')).toBeTruthy();
    expect(screen.getByText('Go to Usage')).toBeTruthy();
  });

  it('should filter by label substring', () => {
    render(<CommandPalette open={true} onClose={() => {}} commands={makeCommands()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'videos' } });
    expect(screen.getByText('Go to Videos')).toBeTruthy();
    expect(screen.queryByText('Go to Dashboard')).toBeNull();
  });

  it('should filter by keyword', () => {
    render(<CommandPalette open={true} onClose={() => {}} commands={makeCommands()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'home' } });
    expect(screen.getByText('Go to Dashboard')).toBeTruthy();
    expect(screen.queryByText('Go to Videos')).toBeNull();
  });

  it('should show empty state when no commands match', () => {
    render(<CommandPalette open={true} onClose={() => {}} commands={makeCommands()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzzzz' } });
    expect(screen.getByText('No commands match')).toBeTruthy();
  });

  it('should invoke action and close on Enter', () => {
    const dash = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={makeCommands({ dash })} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(dash).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should navigate with ArrowDown and run second command', () => {
    const videos = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={makeCommands({ videos })} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(videos).toHaveBeenCalled();
  });

  it('should close on Escape', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={makeCommands()} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('should invoke action when clicking a row', () => {
    const usage = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={makeCommands({ usage })} />);
    fireEvent.click(screen.getByText('Go to Usage'));
    expect(usage).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should have role=dialog and aria-modal', () => {
    render(<CommandPalette open={true} onClose={() => {}} commands={makeCommands()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Command palette');
  });

  it('should render backdrop as a non-focusable div, not a button', () => {
    const onClose = vi.fn();
    const { container } = render(
      <CommandPalette open={true} onClose={onClose} commands={makeCommands()} />,
    );
    // No button should exist with "close" accessible name
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
    // The backdrop element (absolute inset-0) should be a DIV, not a BUTTON
    const backdrop = container.querySelector('.absolute.inset-0');
    expect(backdrop).not.toBeNull();
    expect(backdrop?.tagName).toBe('DIV');
    expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
    // Clicking backdrop should still close
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalled();
  });
});
