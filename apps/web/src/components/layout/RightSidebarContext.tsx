import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";

interface RightSidebarContextValue {
  sidebarContent: ReactNode | null;
  sidebarEnabled: boolean;
  setRightSidebarContent: (content: ReactNode | null) => void;
  setRightSidebarEnabled: (enabled: boolean) => void;
}

const RightSidebarCtx = createContext<RightSidebarContextValue | null>(null);

export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [sidebarContent, setSidebarContent] = useState<ReactNode | null>(null);
  const [sidebarEnabled, setSidebarEnabled] = useState(false);

  const setRightSidebarContent = useCallback((content: ReactNode | null) => {
    setSidebarContent(content);
  }, []);

  const setRightSidebarEnabled = useCallback((enabled: boolean) => {
    setSidebarEnabled(enabled);
  }, []);

  const value = useMemo(() => ({
    sidebarContent,
    sidebarEnabled,
    setRightSidebarContent,
    setRightSidebarEnabled,
  }), [sidebarContent, sidebarEnabled, setRightSidebarContent, setRightSidebarEnabled]);

  return (
    <RightSidebarCtx.Provider value={value}>
      {children}
    </RightSidebarCtx.Provider>
  );
}

export function useRightSidebarContext() {
  const ctx = useContext(RightSidebarCtx);
  if (!ctx) throw new Error("useRightSidebarContext must be used within RightSidebarProvider");
  return ctx;
}
