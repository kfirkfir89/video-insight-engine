import { memo, useEffect, useImperativeHandle, forwardRef, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { TabDefinition, ContentTag } from '@vie/types';
import { getDomainGradient } from '@vie/shared/config';
import { useTabCoordination } from './TabCoordinationContext';
import { withViewTransition } from '@/lib/view-transitions';

interface TabLayoutProps {
  tabs: TabDefinition[];
  primaryTag: ContentTag;
  children: (activeTabId: string, onNavigateTab: (id: string) => void) => ReactNode;
  className?: string;
  isStreaming?: boolean;
  totalCount?: number;
  phaseLabel?: string;
}

export interface TabLayoutHandle {
  setActiveTab: (tabId: string) => void;
}

const TabLayoutInner = forwardRef<TabLayoutHandle, TabLayoutProps>(
  function TabLayout(
    { tabs, primaryTag, children, className, isStreaming = false, totalCount = 0, phaseLabel },
    ref,
  ) {
    const coordination = useTabCoordination();
    const activeTab = coordination?.activeTab ?? tabs[0]?.id ?? '';
    const setActiveTab = coordination?.setActiveTab ?? (() => {});

    useEffect(() => {
      if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
        const fallback = tabs.find(t => !t.hidden) ?? tabs[0];
        setActiveTab(fallback.id);
      }
    }, [tabs, activeTab, setActiveTab]);

    useImperativeHandle(ref, () => ({ setActiveTab }), [setActiveTab]);

    const switchTo = useCallback(
      (id: string) => {
        if (id === activeTab) return;
        withViewTransition(() => setActiveTab(id), { type: 'tab-switch' });
      },
      [activeTab, setActiveTab],
    );

    const gradient = getDomainGradient(primaryTag);
    const domainAccent: React.CSSProperties = {
      ['--domain-gradient' as string]: gradient,
    };

    const visibleTabs = tabs.filter(t => !t.hidden);
    const renderedCount = visibleTabs.length;
    const expectedCount = Math.max(totalCount, renderedCount);
    const showProgress = isStreaming || (renderedCount > 0 && renderedCount < totalCount);

    return (
      <div className={cn('flex flex-col gap-4', className)} data-domain={primaryTag} style={domainAccent}>
        {showProgress && (
          <div className="flex items-center justify-between gap-4 px-1 pt-1 animate-[fadeUp_0.35s_var(--ease-out-expo)_both]">
            <div className="flex items-baseline gap-2.5">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                {isStreaming ? 'Generating' : 'Ready'}
              </span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {renderedCount} <span className="text-muted-foreground/50">of</span> {expectedCount}
              </span>
            </div>
            {phaseLabel && (
              <span className="hidden sm:block truncate text-xs text-muted-foreground/80">
                {phaseLabel}
              </span>
            )}
          </div>
        )}

        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="animate-[fadeUp_0.3s_var(--ease-out-expo,ease)_both]"
          key={activeTab}
        >
          {children(activeTab, switchTo)}
        </div>
      </div>
    );
  },
);

export const TabLayout = memo(TabLayoutInner);
