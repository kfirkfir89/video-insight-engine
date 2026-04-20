import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import { useUrlRange } from './use-url-range';

function wrapperWith(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries }, children);
  };
}

describe('useUrlRange', () => {
  it('should return default when param missing', () => {
    const { result } = renderHook(() => useUrlRange(30), { wrapper: wrapperWith(['/']) });
    expect(result.current[0]).toBe(30);
  });

  it('should read a valid range from URL', () => {
    const { result } = renderHook(() => useUrlRange(30), { wrapper: wrapperWith(['/?range=7']) });
    expect(result.current[0]).toBe(7);
  });

  it('should fall back to default when value is invalid', () => {
    const { result } = renderHook(() => useUrlRange(30), { wrapper: wrapperWith(['/?range=abc']) });
    expect(result.current[0]).toBe(30);
  });

  it('should fall back to default when value is negative', () => {
    const { result } = renderHook(() => useUrlRange(14), { wrapper: wrapperWith(['/?range=-5']) });
    expect(result.current[0]).toBe(14);
  });

  it('should clamp large values to 365', () => {
    const { result } = renderHook(() => useUrlRange(30), { wrapper: wrapperWith(['/?range=10000']) });
    expect(result.current[0]).toBe(365);
  });

  it('should write to URL and preserve other params', () => {
    const { result } = renderHook(() => useUrlRange(30), { wrapper: wrapperWith(['/?foo=bar']) });
    act(() => {
      result.current[1](90);
    });
    expect(result.current[0]).toBe(90);
  });

  it('should default to 30 when defaultDays is omitted', () => {
    const { result } = renderHook(() => useUrlRange(), { wrapper: wrapperWith(['/']) });
    expect(result.current[0]).toBe(30);
  });
});
