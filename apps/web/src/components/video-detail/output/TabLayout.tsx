import { useState, useEffect, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import type { OutputSection, OutputType } from '@vie/types';
import { OUTPUT_GRADIENT_VAR } from './output-constants';

interface TabLayoutProps {
  sections: OutputSection[];
  outputType: OutputType;
  children: (activeTabId: string) => ReactNode;
  className?: string;
}

export function TabLayout({ sections, outputType, children, className }: TabLayoutProps) {
  const [activeTab, setActiveTab] = useState(sections[0]?.id ?? '');

  // Reset activeTab when sections change and current tab is no longer valid
  useEffect(() => {
    if (sections.length > 0 && !sections.some(s => s.id === activeTab)) {
      setActiveTab(sections[0].id);
    }
  }, [sections, activeTab]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist">
        {sections.map((section) => {
          const isActive = section.id === activeTab;
          return (
            <button
              key={section.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${section.id}`}
              onClick={() => setActiveTab(section.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'text-white shadow-md'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
              style={isActive ? { background: OUTPUT_GRADIENT_VAR[outputType] } : undefined}
            >
              <span role="img" aria-hidden="true">{section.emoji}</span>
              <span>{section.label}</span>
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
        {children(activeTab)}
      </div>
    </div>
  );
}
