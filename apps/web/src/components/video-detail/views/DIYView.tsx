import { memo, type ReactNode } from 'react';
import { Wrench, ListOrdered, Lightbulb, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { ViewLayout, LayoutSection, sidebarMainOrFallback, renderSections } from './ViewLayout';

interface DIYViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const DIY_RULES: readonly BlockGroupRule[] = [
  { name: 'tools', match: (b) => b.type === 'tool_list' },
  { name: 'materials', match: (b) => b.type === 'bullets' && b.variant === 'materials' },
  { name: 'steps', match: (b) => (b.type === 'numbered' && b.variant === 'steps') || b.type === 'step' },
  { name: 'tips', match: (b) => b.type === 'callout' && (b.variant === 'safety_tip' || b.variant === 'pro_tip') },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for DIY/crafts content.
 * Layout: sidebar (tools/materials) + main (steps), tips/timestamps full-width below.
 */
export const DIYView = memo(function DIYView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: DIYViewProps) {
  const groups = useGroupedBlocks(chapter.content, DIY_RULES);

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  const sections: { key: string; node: ReactNode }[] = [];

  const toolMaterialBlocks = [...groups.tools, ...groups.materials];
  const hasSidebar = toolMaterialBlocks.length > 0;
  const hasSteps = groups.steps.length > 0;

  const fallback: { key: string; node: ReactNode }[] = [];
  if (hasSidebar) fallback.push({ key: 'tools', node: (
    <LayoutSection icon={Wrench} label="Tools & Materials">
      <ContentBlocks blocks={toolMaterialBlocks} {...blockProps} />
    </LayoutSection>
  )});
  if (groups.other.length > 0) fallback.push({ key: 'other', node: (
    <ContentBlocks blocks={groups.other} {...blockProps} />
  )});
  if (hasSteps) fallback.push({ key: 'steps', node: (
    <LayoutSection icon={ListOrdered} label="Steps">
      <ContentBlocks blocks={groups.steps} {...blockProps} />
    </LayoutSection>
  )});

  sections.push(...sidebarMainOrFallback(
    hasSidebar ? (
      <LayoutSection icon={Wrench} label="Tools & Materials">
        <ContentBlocks blocks={toolMaterialBlocks} {...blockProps} />
      </LayoutSection>
    ) : null,
    (hasSteps || groups.other.length > 0) ? (
      <>
        {hasSteps && (
          <LayoutSection icon={ListOrdered} label="Steps">
            <ContentBlocks blocks={groups.steps} {...blockProps} />
          </LayoutSection>
        )}
        {groups.other.length > 0 && (
          <div className={hasSteps ? 'mt-6' : ''}>
            <ContentBlocks blocks={groups.other} {...blockProps} />
          </div>
        )}
      </>
    ) : null,
    fallback,
  ));

  if (groups.tips.length > 0) {
    sections.push({ key: 'tips', node: (
      <LayoutSection icon={Lightbulb} label="Tips">
        <ContentBlocks blocks={groups.tips} {...blockProps} />
      </LayoutSection>
    )});
  }

  if (groups.timestamps.length > 0) {
    sections.push({ key: 'timestamps', node: (
      <LayoutSection icon={Clock} label="Timestamps">
        <div className="flex flex-wrap gap-2">
          <ContentBlocks blocks={groups.timestamps} {...blockProps} />
        </div>
      </LayoutSection>
    )});
  }

  if (sections.length === 0) return null;

  return (
    <ViewLayout>
      {renderSections(sections)}
    </ViewLayout>
  );
});
