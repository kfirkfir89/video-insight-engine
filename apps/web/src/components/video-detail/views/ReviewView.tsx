import { Fragment, memo, type ReactNode } from 'react';
import { Award, Star, Scale, GitCompare, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

interface ReviewViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const REVIEW_RULES: readonly BlockGroupRule[] = [
  { name: 'verdicts', match: (b) => b.type === 'verdict' },
  { name: 'ratings', match: (b) => b.type === 'rating' },
  { name: 'proCons', match: (b) => b.type === 'pro_con' },
  { name: 'comparisons', match: (b) => b.type === 'comparison' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for product review content.
 * Emphasizes:
 * - Verdict/overall assessment at the top
 * - Rating breakdown
 * - Pros and cons
 * - Comparison highlights
 */
export const ReviewView = memo(function ReviewView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: ReviewViewProps) {
  const groups = useGroupedBlocks(chapter.content, REVIEW_RULES);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (groups.verdicts.length > 0) {
    sections.push({ key: 'verdicts', node: (
      <div className="space-y-2">
        <SectionHeader icon={Award} label="Verdicts" />
        <ContentBlocks blocks={groups.verdicts} {...blockProps} />
      </div>
    )});
  }

  if (groups.ratings.length > 0) {
    sections.push({ key: 'ratings', node: (
      <div className="space-y-2">
        <SectionHeader icon={Star} label="Ratings" />
        <ContentBlocks blocks={groups.ratings} {...blockProps} />
      </div>
    )});
  }

  if (groups.proCons.length > 0) {
    sections.push({ key: 'proCons', node: (
      <div className="space-y-2">
        <SectionHeader icon={Scale} label="Pros & Cons" />
        <ContentBlocks blocks={groups.proCons} {...blockProps} />
      </div>
    )});
  }

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
    )});
  }

  if (groups.comparisons.length > 0) {
    sections.push({ key: 'comparisons', node: (
      <div className="space-y-2">
        <SectionHeader icon={GitCompare} label="Comparisons" />
        <ContentBlocks blocks={groups.comparisons} {...blockProps} />
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
