import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

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
      if (Array.isArray(parsed)) return new Set(parsed);
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
  const [activeTab, setActiveTab] = useState(initialTab);
  const [completedTabs, setCompletedTabs] = useState<Set<string>>(() => loadCompletedTabs(videoId));

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

  return (
    <TabCoordinationContext.Provider
      value={{ activeTab, setActiveTab, completedTabs, markTabCompleted }}
    >
      {children}
    </TabCoordinationContext.Provider>
  );
}

/**
 * Hook to access tab coordination state.
 * Must be used within a TabCoordinationProvider.
 */
export function useTabCoordination(): TabCoordinationState {
  const ctx = useContext(TabCoordinationContext);
  if (!ctx) {
    throw new Error('useTabCoordination must be used within a TabCoordinationProvider');
  }
  return ctx;
}
