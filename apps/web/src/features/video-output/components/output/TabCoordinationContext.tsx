import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';

interface TabCoordinationState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  completedTabs: Set<string>;
  markTabCompleted: (tab: string) => void;
}

const TabCoordinationContext = createContext<TabCoordinationState | null>(null);

interface TabCoordinationProviderProps {
  videoId: string;
  initialTab: string;
  children: ReactNode;
}

const STORAGE_PREFIX = 'vie-completed-tabs-';

function loadCompletedTabs(videoId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${videoId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === 'string')) return new Set(parsed as string[]);
    }
  } catch {
    // Ignore storage errors
  }
  return new Set();
}

function saveCompletedTabs(videoId: string, tabs: Set<string>) {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${videoId}`, JSON.stringify(Array.from(tabs)));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Provider for cross-tab coordination state.
 * Tracks active tab and completed tabs, persisted in sessionStorage per videoId.
 */
export function TabCoordinationProvider({
  videoId,
  initialTab,
  children,
}: TabCoordinationProviderProps) {
  const [activeTab, setActiveTabRaw] = useState(initialTab);
  const [completedTabs, setCompletedTabs] = useState<Set<string>>(() => loadCompletedTabs(videoId));

  // Track whether the initial tab has been applied for this videoId
  const appliedInitialRef = useRef<string | null>(null);

  // Reset state when videoId changes
  useEffect(() => {
    setCompletedTabs(loadCompletedTabs(videoId));
    appliedInitialRef.current = null;
  }, [videoId]);

  // Apply initialTab when it changes (e.g., first tab becomes available during streaming)
  useEffect(() => {
    if (initialTab && appliedInitialRef.current !== initialTab) {
      setActiveTabRaw(initialTab);
      appliedInitialRef.current = initialTab;
    }
  }, [initialTab]);

  const setActiveTab = useCallback((tab: string) => setActiveTabRaw(tab), []);

  const markTabCompleted = useCallback((tab: string) => {
    setCompletedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  // Persist completedTabs to sessionStorage
  useEffect(() => {
    saveCompletedTabs(videoId, completedTabs);
  }, [videoId, completedTabs]);

  const value = useMemo<TabCoordinationState>(() => ({
    activeTab, setActiveTab, completedTabs, markTabCompleted,
  }), [activeTab, setActiveTab, completedTabs, markTabCompleted]);

  return (
    <TabCoordinationContext.Provider value={value}>
      {children}
    </TabCoordinationContext.Provider>
  );
}

/**
 * Hook to access tab coordination state.
 * Returns null when used outside a TabCoordinationProvider.
 */
export function useTabCoordination(): TabCoordinationState | null {
  return useContext(TabCoordinationContext);
}
