import { memo, type ReactNode } from 'react';
import { Users, Quote, FileText, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { ViewLayout, LayoutSection, buildPairedOrStack, renderSections } from './ViewLayout';

interface PodcastViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const PODCAST_RULES: readonly BlockGroupRule[] = [
  { name: 'guests', match: (b) => b.type === 'guest' },
  { name: 'quotes', match: (b) => b.type === 'quote' },
  { name: 'transcripts', match: (b) => b.type === 'transcript' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for podcast/interview content.
 * Layout: equal 2-col (guests + quotes) top, topics/transcripts/timestamps full-width below.
 */
export const PodcastView = memo(function PodcastView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: PodcastViewProps) {
  const groups = useGroupedBlocks(chapter.content, PODCAST_RULES);

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  const sections: { key: string; node: ReactNode }[] = [];

  // Top row: guests (equal) + quotes (equal) side-by-side
  sections.push(...buildPairedOrStack(
    { key: 'guests', width: 'equal', node: groups.guests.length > 0 ? (
      <LayoutSection icon={Users} label="Guests">
        <ContentBlocks blocks={groups.guests} {...blockProps} />
      </LayoutSection>
    ) : null },
    { key: 'quotes', width: 'equal', node: groups.quotes.length > 0 ? (
      <LayoutSection icon={Quote} label="Quotes">
        <ContentBlocks blocks={groups.quotes} {...blockProps} />
      </LayoutSection>
    ) : null },
  ));

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <LayoutSection icon={FileText} label="Topics">
        <ContentBlocks blocks={groups.other} {...blockProps} />
      </LayoutSection>
    )});
  }

  if (groups.transcripts.length > 0) {
    sections.push({ key: 'transcripts', node: (
      <ContentBlocks blocks={groups.transcripts} {...blockProps} />
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
