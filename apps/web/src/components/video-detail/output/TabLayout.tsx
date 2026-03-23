import { useEffect, useImperativeHandle, forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { TabDefinition, ContentTag } from '@vie/types';
import { getDomainGradient } from '@vie/shared/config';
import { useTabCoordination } from './TabCoordinationContext';
import { Check } from 'lucide-react';

interface TabLayoutProps {
  tabs: TabDefinition[];
  primaryTag: ContentTag;
  children: (activeTabId: string, onNavigateTab: (id: string) => void) => ReactNode;
  className?: string;
}

export interface TabLayoutHandle {
  setActiveTab: (tabId: string) => void;
}

/** Strip leading emoji from label if it duplicates the separate emoji field. */
function dedupEmojiLabel(label: string, emoji?: string): string {
  if (!emoji || !label) return label;
  // Check if label starts with the emoji (with optional trailing space)
  if (label.startsWith(emoji)) {
    return label.slice(emoji.length).trimStart();
  }
  return label;
}

export const TabLayout = forwardRef<TabLayoutHandle, TabLayoutProps>(
  function TabLayout({ tabs, primaryTag, children, className }, ref) {
    const coordination = useTabCoordination();
    const activeTab = coordination?.activeTab ?? tabs[0]?.id ?? '';
    const setActiveTab = coordination?.setActiveTab ?? (() => {});
    const completedTabs = coordination?.completedTabs ?? new Set<string>();

    // Ensure activeTab is valid
    useEffect(() => {
      if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
        setActiveTab(tabs[0].id);
      }
    }, [tabs, activeTab, setActiveTab]);

    useImperativeHandle(ref, () => ({ setActiveTab }), [setActiveTab]);

    const gradient = getDomainGradient(primaryTag);

    return (
      <div className={cn('flex flex-col gap-4', className)}>
        {/* Tab bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const isCompleted = completedTabs.has(tab.id);
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200',
                  isActive
                    ? 'text-white shadow-md'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                )}
                style={isActive ? { background: gradient } : undefined}
              >
                <span role="img" aria-hidden="true">{tab.emoji}</span>
                <span>{dedupEmojiLabel(tab.label, tab.emoji)}</span>
                {isCompleted && !isActive && (
                  <Check className="h-3 w-3 text-success" aria-label="Completed" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          className="animate-[fadeUp_0.3s_var(--ease-spring,ease)_both]"
          key={activeTab}
        >
          {children(activeTab, setActiveTab)}
        </div>
      </div>
    );
  }
);
