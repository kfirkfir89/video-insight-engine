import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import { useUrlSort } from './use-sort';

function wrapperWith(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries }, children);
  };
}

describe('useUrlSort', () => {
  it('should return null key and desc direction by default', () => {
    const { result } = renderHook(() => useUrlSort(), { wrapper: wrapperWith(['/']) });
    expect(result.current.sort.key).toBe(null);
    expect(result.current.sort.direction).toBe('desc');
  });

  it('should honor provided defaults', () => {
    const { result } = renderHook(() => useUrlSort({ key: 'cost', direction: 'asc' }), {
      wrapper: wrapperWith(['/']),
    });
    expect(result.current.sort.key).toBe('cost');
    expect(result.current.sort.direction).toBe('asc');
  });

  it('should read sort and dir from URL', () => {
    const { result } = renderHook(() => useUrlSort(), { wrapper: wrapperWith(['/?sort=cost&dir=asc']) });
    expect(result.current.sort.key).toBe('cost');
    expect(result.current.sort.direction).toBe('asc');
  });

  it('should fall back to desc when dir is invalid', () => {
    const { result } = renderHook(() => useUrlSort(), { wrapper: wrapperWith(['/?sort=cost&dir=sideways']) });
    expect(result.current.sort.direction).toBe('desc');
  });

  it('should toggle direction when toggling same key', () => {
    const { result } = renderHook(() => useUrlSort(), { wrapper: wrapperWith(['/?sort=cost&dir=desc']) });
    act(() => {
      result.current.toggleSort('cost');
    });
    expect(result.current.sort.key).toBe('cost');
    expect(result.current.sort.direction).toBe('asc');
  });

  it('should set key with desc when switching to a different key', () => {
    const { result } = renderHook(() => useUrlSort(), { wrapper: wrapperWith(['/?sort=cost&dir=asc']) });
    act(() => {
      result.current.toggleSort('tokens');
    });
    expect(result.current.sort.key).toBe('tokens');
    expect(result.current.sort.direction).toBe('desc');
  });

  it('should set sort via setSort', () => {
    const { result } = renderHook(() => useUrlSort(), { wrapper: wrapperWith(['/']) });
    act(() => {
      result.current.setSort({ key: 'duration', direction: 'asc' });
    });
    expect(result.current.sort.key).toBe('duration');
    expect(result.current.sort.direction).toBe('asc');
  });

  it('should clear sort when setSort receives null key', () => {
    const { result } = renderHook(() => useUrlSort(), { wrapper: wrapperWith(['/?sort=cost&dir=asc']) });
    act(() => {
      result.current.setSort({ key: null, direction: 'desc' });
    });
    expect(result.current.sort.key).toBe(null);
  });
});
