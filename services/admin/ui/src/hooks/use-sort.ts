import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string | null;
  direction: SortDirection;
}

export interface UseUrlSortResult {
  sort: SortState;
  toggleSort: (key: string) => void;
  setSort: (state: SortState) => void;
}

function normalizeDirection(raw: string | null, fallback: SortDirection): SortDirection {
  return raw === 'asc' || raw === 'desc' ? raw : fallback;
}

/**
 * URL-persisted sort state via `?sort=<key>&dir=<asc|desc>`.
 * toggleSort flips direction when key matches; otherwise sets key with 'desc'.
 */
export function useUrlSort(defaults?: { key?: string; direction?: SortDirection }): UseUrlSortResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultKey = defaults?.key ?? null;
  const defaultDirection: SortDirection = defaults?.direction ?? 'desc';

  const sort = useMemo<SortState>(() => {
    const key = searchParams.get('sort') ?? defaultKey;
    const direction = normalizeDirection(searchParams.get('dir'), defaultDirection);
    return { key, direction };
  }, [searchParams, defaultKey, defaultDirection]);

  const writeParams = useCallback(
    (nextKey: string | null, nextDir: SortDirection) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (nextKey == null) {
            params.delete('sort');
            params.delete('dir');
          } else {
            params.set('sort', nextKey);
            params.set('dir', nextDir);
          }
          return params;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const toggleSort = useCallback(
    (key: string) => {
      if (sort.key === key) {
        writeParams(key, sort.direction === 'asc' ? 'desc' : 'asc');
      } else {
        writeParams(key, 'desc');
      }
    },
    [sort.key, sort.direction, writeParams],
  );

  const setSort = useCallback(
    (state: SortState) => {
      writeParams(state.key, state.direction);
    },
    [writeParams],
  );

  return { sort, toggleSort, setSort };
}
