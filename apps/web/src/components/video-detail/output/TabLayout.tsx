import { useState, useEffect, useImperativeHandle, forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { TabDefinition, ContentTag } from '@vie/types';
import { CONTENT_TAG_GRADIENT } from './output-constants';
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

export const TabLayout = forwardRef<TabLayoutHandle, TabLayoutProps>(
  function TabLayout({ tabs, primaryTag, children, className }, ref) {
    const { activeTab, setActiveTab, completedTabs } = useTabCoordination();

    // Ensure activeTab is valid
    useEffect(() => {
      if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
        setActiveTab(tabs[0].id);
      }
    }, [tabs, activeTab, setActiveTab]);

    useImperativeHandle(ref, () => ({ setActiveTab }), [setActiveTab]);

    const gradient = CONTENT_TAG_GRADIENT[primaryTag] ?? CONTENT_TAG_GRADIENT.learning;

    return (
      <div className={cn('flex flex-col gap-4', className)}>
        {/* Tab bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist">
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
                  'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'text-white shadow-md'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                )}
                style={isActive ? { background: gradient } : undefined}
              >
                <span role="img" aria-hidden="true">{tab.emoji}</span>
                <span>{tab.label}</span>
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
