import { Fragment, memo, type ReactNode } from 'react';
import { Target, Sparkles, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

interface GamingViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const GAMING_RULES: readonly BlockGroupRule[] = [
  { name: 'strategies', match: (b) => b.type === 'numbered' && b.variant === 'strategy' },
  { name: 'highlights', match: (b) => b.type === 'bullets' && b.variant === 'highlights' },
  { name: 'tips', match: (b) => b.type === 'callout' && (b.variant === 'pro_tip' || b.variant === 'strategy_tip') },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for gaming content.
 * Emphasizes:
 * - Strategies and tactics at the top
 * - Key moments/highlights
 * - Tips and tricks
 * - Video timestamps for gameplay
 */
export const GamingView = memo(function GamingView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: GamingViewProps) {
  const groups = useGroupedBlocks(chapter.content, GAMING_RULES);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (groups.strategies.length > 0) {
    sections.push({ key: 'strategies', node: (
      <div className="space-y-2">
        <SectionHeader icon={Target} label="Strategies" />
        <ContentBlocks blocks={groups.strategies} {...blockProps} />
      </div>
    )});
  }

  if (groups.highlights.length > 0) {
    sections.push({ key: 'highlights', node: (
      <ContentBlocks blocks={groups.highlights} {...blockProps} />
    )});
  }

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
    )});
  }

  if (groups.tips.length > 0) {
    sections.push({ key: 'tips', node: (
      <div className="space-y-2">
        <SectionHeader icon={Sparkles} label="Tips" />
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
