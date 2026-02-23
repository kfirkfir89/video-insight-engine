import { memo, type ReactNode } from 'react';
import { Award, Star, Scale, GitCompare, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { ViewLayout, LayoutSection, buildPairedOrStack, renderSections } from './ViewLayout';

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
 * Layout: verdict + rating side-by-side top, pros/cons + comparisons full-width below.
 */
export const ReviewView = memo(function ReviewView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: ReviewViewProps) {
  const groups = useGroupedBlocks(chapter.content, REVIEW_RULES);

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  const sections: { key: string; node: ReactNode }[] = [];

  // Top row: verdict (main) + rating (sidebar) side-by-side
  sections.push(...buildPairedOrStack(
    { key: 'verdicts', width: 'main', node: groups.verdicts.length > 0 ? (
      <LayoutSection icon={Award} label="Verdicts">
        <ContentBlocks blocks={groups.verdicts} {...blockProps} />
      </LayoutSection>
    ) : null },
    { key: 'ratings', width: 'sidebar', node: groups.ratings.length > 0 ? (
      <LayoutSection icon={Star} label="Ratings">
        <ContentBlocks blocks={groups.ratings} {...blockProps} />
      </LayoutSection>
    ) : null },
  ));

  if (groups.proCons.length > 0) {
    sections.push({ key: 'proCons', node: (
      <LayoutSection icon={Scale} label="Pros & Cons">
        <ContentBlocks blocks={groups.proCons} {...blockProps} />
      </LayoutSection>
    )});
  }

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
    )});
  }

  if (groups.comparisons.length > 0) {
    sections.push({ key: 'comparisons', node: (
      <LayoutSection icon={GitCompare} label="Comparisons">
        <ContentBlocks blocks={groups.comparisons} {...blockProps} />
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
