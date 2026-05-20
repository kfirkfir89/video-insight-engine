import { memo, useEffect, useImperativeHandle, forwardRef, useCallback, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { TabDefinition, ContentTag } from '@vie/types';
import { getDomainGradient } from '@vie/shared/config';
import { useTabCoordination } from './TabCoordinationContext';
import { withViewTransition } from '@/lib/view-transitions';
import { getAccentForTag } from './lib/content-accent';

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
    const accent = getAccentForTag(primaryTag);
    const domainAccent: React.CSSProperties = {
      ['--domain-gradient' as string]: gradient,
      ['--vie-accent' as string]: accent,
    };

    const visibleTabs = tabs.filter(t => !t.hidden);
    const renderedCount = visibleTabs.length;
    const expectedCount = Math.max(totalCount, renderedCount);
    const showProgress = isStreaming || (renderedCount > 0 && renderedCount < totalCount);
    const progressPercent = expectedCount > 0
      ? Math.min(100, Math.max(0, (renderedCount / expectedCount) * 100))
      : 0;

    // Track which tab IDs have already been seen so the *newly arrived* tab
    // gets a brief scale-pulse on its first render. Using a ref keeps this
    // ambient — no re-render churn from set-state during streaming.
    const seenTabIds = useRef<Set<string>>(new Set());
    const isFreshArrival = !seenTabIds.current.has(activeTab);
    useEffect(() => {
      seenTabIds.current.add(activeTab);
    }, [activeTab]);

    // Cross-fade the phaseLabel when it ticks over (e.g. "Extracting…" →
    // "Enriching…"). React's key drives a fresh remount + fadeUp each time
    // the label changes; when the label is absent we render nothing rather
    // than filler.

    return (
      <div className={cn('flex flex-col gap-4', className)} data-domain={primaryTag} style={domainAccent}>
        {showProgress && (
          <div className="flex flex-col gap-1.5 px-1 pt-1 animate-[fadeUp_0.35s_var(--ease-out-expo)_both]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-2.5">
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                  {isStreaming ? 'Generating' : 'Ready'}
                </span>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {renderedCount} <span className="text-muted-foreground/50">of</span> {expectedCount}
                </span>
              </div>
              {phaseLabel && (
                <span
                  key={phaseLabel}
                  className="hidden sm:block truncate text-xs text-muted-foreground/80 animate-[fadeUp_0.2s_var(--ease-out-quint)_both] motion-reduce:animate-none"
                >
                  {phaseLabel}
                </span>
              )}
            </div>
            {/* Progress arc: width transitions on tab arrival; a travelling
                shimmer reads the wait as ambient activity. Reduced-motion
                strips the shimmer and keeps the width transition. */}
            <div
              className="relative h-0.5 w-full overflow-hidden rounded-full bg-muted/40"
              role="progressbar"
              aria-valuenow={renderedCount}
              aria-valuemin={0}
              aria-valuemax={expectedCount}
              aria-label="Tabs generated"
            >
              <div
                className="relative h-full overflow-hidden rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  background: 'var(--vie-accent, var(--primary))',
                  transition: 'width 600ms var(--ease-out-quint)',
                }}
              >
                {isStreaming && (
                  <div
                    aria-hidden="true"
                    className="progress-shimmer absolute inset-y-0 left-0 w-full motion-reduce:hidden"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent 0%, oklch(100% 0 0 / 0.5) 50%, transparent 100%)',
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className={cn(
            'animate-[fadeUp_0.3s_var(--ease-out-expo,ease)_both]',
            // First-time arrivals get a brief scale-pulse so the user catches
            // the new tab landing; revisits stay calm.
            isFreshArrival && 'scale-pulse-once',
          )}
          key={activeTab}
        >
          {children(activeTab, switchTo)}
        </div>
      </div>
    );
  },
);

export const TabLayout = memo(TabLayoutInner);
