import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type RangeOption = 7 | 30 | 90;

const MIN_DAYS = 1;
const MAX_DAYS = 365;

function clamp(value: number): number {
  if (value < MIN_DAYS) return MIN_DAYS;
  if (value > MAX_DAYS) return MAX_DAYS;
  return value;
}

/**
 * Read and write `?range=N` (days) from the URL.
 * Falls back to `defaultDays` when the param is missing or invalid.
 * Preserves other search params when writing.
 */
export function useUrlRange(defaultDays = 30): [number, (days: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const raw = searchParams.get('range');
    if (raw == null) return clamp(defaultDays);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return clamp(defaultDays);
    return clamp(Math.floor(parsed));
  }, [searchParams, defaultDays]);

  const setValue = useCallback(
    (days: number) => {
      const next = clamp(Math.floor(days));
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('range', String(next));
          return params;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  return [value, setValue];
}
