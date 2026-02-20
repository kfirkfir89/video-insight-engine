import { Fragment, memo, type ReactNode } from 'react';
import { Wrench, ListOrdered, Lightbulb, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

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
 * Emphasizes:
 * - Tools and materials at the top
 * - Step-by-step instructions
 * - Safety tips
 * - Video timestamps for demonstrations
 */
export const DIYView = memo(function DIYView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: DIYViewProps) {
  const groups = useGroupedBlocks(chapter.content, DIY_RULES);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (groups.tools.length > 0 || groups.materials.length > 0) {
    const toolMaterialBlocks = [...groups.tools, ...groups.materials];
    sections.push({ key: 'tools', node: (
      <div className="space-y-2">
        <SectionHeader icon={Wrench} label="Tools & Materials" />
        <ContentBlocks blocks={toolMaterialBlocks} {...blockProps} />
      </div>
    )});
  }

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
    )});
  }

  if (groups.steps.length > 0) {
    sections.push({ key: 'steps', node: (
      <div className="space-y-2">
        <SectionHeader icon={ListOrdered} label="Steps" />
        <ContentBlocks blocks={groups.steps} {...blockProps} />
      </div>
    )});
  }

  if (groups.tips.length > 0) {
    sections.push({ key: 'tips', node: (
      <div className="space-y-2">
        <SectionHeader icon={Lightbulb} label="Tips" />
        <ContentBlocks blocks={groups.tips} {...blockProps} />
      </div>
    )});
  }

  if (groups.timestamps.length > 0) {
    sections.push({ key: 'timestamps', node: (
      <div className="space-y-2">
        <SectionHeader icon={Clock} label="Timestamps" />
        <div className="flex flex-wrap gap-2">
          <ContentBlocks blocks={groups.timestamps} {...blockProps} />
        </div>
      </div>
    )});
  }

  if (sections.length === 0) return null;

  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <Fragment key={section.key}>
          {i > 0 && <div className="fade-divider" />}
          {section.node}
        </Fragment>
      ))}
    </div>
  );
});
