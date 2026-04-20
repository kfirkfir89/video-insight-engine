import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ message = 'boom' }: { message?: string }): never {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should export ErrorBoundary class', () => {
    expect(typeof ErrorBoundary).toBe('function');
  });

  it('should render children when no error thrown', () => {
    render(
      <ErrorBoundary>
        <span>happy path</span>
      </ErrorBoundary>
    );
    expect(screen.getByText('happy path')).toBeTruthy();
  });

  it('should render ErrorState when child throws', () => {
    render(
      <ErrorBoundary>
        <Boom message="render failed" />
      </ErrorBoundary>
    );
    expect(screen.getByText('render failed')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('should log error to console.error', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={(err) => <p>custom: {err.message}</p>}>
        <Boom message="bad" />
      </ErrorBoundary>
    );
    expect(screen.getByText('custom: bad')).toBeTruthy();
  });

  it('should reset state when retry is clicked', () => {
    let shouldThrow = true;
    function Maybe() {
      if (shouldThrow) throw new Error('nope');
      return <span>recovered</span>;
    }

    render(
      <ErrorBoundary>
        <Maybe />
      </ErrorBoundary>
    );
    expect(screen.getByText('nope')).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(screen.getByText('recovered')).toBeTruthy();
  });

  it('should call onReset prop when retry is clicked', () => {
    const onReset = vi.fn();
    let shouldThrow = true;
    function Maybe() {
      if (shouldThrow) throw new Error('kaboom');
      return <span>ok</span>;
    }

    render(
      <ErrorBoundary onReset={onReset}>
        <Maybe />
      </ErrorBoundary>
    );
    expect(screen.getByText('kaboom')).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
