import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('should export ErrorState component', () => {
    expect(typeof ErrorState).toBe('function');
  });

  it('should render default title when no title provided', () => {
    render(<ErrorState error={new Error('boom')} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('should render sanitized message from Error instance', () => {
    render(<ErrorState error={new Error('Network down')} />);
    expect(screen.getByText('Network down')).toBeTruthy();
  });

  it('should stringify non-Error error values', () => {
    render(<ErrorState error={'plain string'} />);
    expect(screen.getByText('plain string')).toBeTruthy();
  });

  it('should show retry button only when onRetry provided', () => {
    const { rerender } = render(<ErrorState error={new Error('x')} />);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();

    const onRetry = vi.fn();
    rerender(<ErrorState error={new Error('x')} onRetry={onRetry} />);
    const btn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('should render custom title when provided', () => {
    render(<ErrorState error={new Error('x')} title="Couldn't load stats" />);
    expect(screen.getByText("Couldn't load stats")).toBeTruthy();
  });

  it('should render compact variant with role=alert', () => {
    render(<ErrorState error={new Error('x')} compact />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.className).toContain('py-2');
  });
});
