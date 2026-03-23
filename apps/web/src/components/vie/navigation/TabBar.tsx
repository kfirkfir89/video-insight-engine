import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  emoji?: string;
}

interface TabBarProps {
  tabs: TabItem[];
  activeId: string;
  onTabChange: (id: string) => void;
  /** Set of completed tab IDs (show checkmark) */
  completedIds?: Set<string>;
  /** CSS gradient string for active tab background */
  activeGradient?: string;
  className?: string;
}

/**
 * Decoupled tab bar.
 * No internal state — parent controls activeId and onTabChange.
 * Domain gradient is passed in, not imported.
 */
export const TabBar = memo(function TabBar({
  tabs,
  activeId,
  onTabChange,
  completedIds,
  activeGradient,
  className,
}: TabBarProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1 scrollbar-none', className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const isCompleted = completedIds?.has(tab.id);
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
              isActive
                ? 'text-white shadow-md'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted',
            )}
            style={isActive && activeGradient ? { background: activeGradient } : undefined}
          >
            {tab.emoji && <span role="img" aria-hidden="true">{tab.emoji}</span>}
            <span>{tab.label}</span>
            {isCompleted && !isActive && (
              <Check className="h-3 w-3 text-success" aria-label="Completed" />
            )}
          </button>
        );
      })}
    </div>
  );
});
