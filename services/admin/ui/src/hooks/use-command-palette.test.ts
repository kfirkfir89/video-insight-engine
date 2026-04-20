import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandPalette } from './use-command-palette';

function fireKey(init: KeyboardEventInit & { key: string }, target?: EventTarget) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  if (target) {
    Object.defineProperty(event, 'target', { value: target, writable: false });
    target.dispatchEvent(event);
  } else {
    window.dispatchEvent(event);
  }
  return event;
}

describe('useCommandPalette', () => {
  it('should default closed', () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.open).toBe(false);
  });

  it('should open on Cmd+K', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      fireKey({ key: 'k', metaKey: true });
    });
    expect(result.current.open).toBe(true);
  });

  it('should toggle off with Cmd+K when already open', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      fireKey({ key: 'k', metaKey: true });
    });
    act(() => {
      fireKey({ key: 'k', metaKey: true });
    });
    expect(result.current.open).toBe(false);
  });

  it('should open on Ctrl+K', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      fireKey({ key: 'K', ctrlKey: true });
    });
    expect(result.current.open).toBe(true);
  });

  it('should open on / when no input is focused', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      fireKey({ key: '/' });
    });
    expect(result.current.open).toBe(true);
  });

  it('should NOT open on / when an input is the target', () => {
    const { result } = renderHook(() => useCommandPalette());
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      fireKey({ key: '/' }, input);
    });
    expect(result.current.open).toBe(false);
    document.body.removeChild(input);
  });

  it('should close on Escape', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      result.current.setOpen(true);
    });
    act(() => {
      fireKey({ key: 'Escape' });
    });
    expect(result.current.open).toBe(false);
  });

  it('should allow manual setOpen', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);
  });
});
