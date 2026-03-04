import { useState, useRef, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabbedViewProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

export function TabbedView({ tabs, defaultTab, className }: TabbedViewProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const tabListRef = useRef<HTMLDivElement>(null);

  // Derive valid tab — never call setState during render
  const validActiveTab = tabs.find((t) => t.id === activeTab) ? activeTab : tabs[0]?.id ?? "";

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIdx = tabs.findIndex((t) => t.id === validActiveTab);
      let nextIdx = currentIdx;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextIdx = (currentIdx + 1) % tabs.length;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIdx = tabs.length - 1;
      } else {
        return;
      }

      setActiveTab(tabs[nextIdx].id);
      // Focus the newly active tab button
      const buttons = tabListRef.current?.querySelectorAll('[role="tab"]');
      (buttons?.[nextIdx] as HTMLElement)?.focus();
    },
    [validActiveTab, tabs]
  );

  if (tabs.length === 0) return null;

  const activeContent = tabs.find((t) => t.id === validActiveTab)?.content;

  return (
    <div className={className}>
      {/* Glass pill tabs */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Content tabs"
        className="flex gap-1 p-1 glass rounded-xl mb-4 overflow-x-auto scrollbar-hide"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === validActiveTab}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === validActiveTab ? 0 : -1}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap min-w-0",
              tab.id === validActiveTab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={`panel-${validActiveTab}`}
        aria-labelledby={`tab-${validActiveTab}`}
        tabIndex={0}
      >
        {activeContent}
      </div>
    </div>
  );
}
