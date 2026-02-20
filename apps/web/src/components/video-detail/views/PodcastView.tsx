import { Fragment, memo, type ReactNode } from 'react';
import { Users, Quote, FileText, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

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
 * Emphasizes:
 * - Guest bios at the top
 * - Key quotes and highlights
 * - Transcript segments
 * - Topic timestamps
 */
export const PodcastView = memo(function PodcastView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: PodcastViewProps) {
  const groups = useGroupedBlocks(chapter.content, PODCAST_RULES);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (groups.guests.length > 0) {
    sections.push({ key: 'guests', node: (
      <div className="space-y-2">
        <SectionHeader icon={Users} label="Guests" />
        <ContentBlocks blocks={groups.guests} {...blockProps} />
      </div>
    )});
  }

  if (groups.quotes.length > 0) {
    sections.push({ key: 'quotes', node: (
      <div className="space-y-2">
        <SectionHeader icon={Quote} label="Quotes" />
        <ContentBlocks blocks={groups.quotes} {...blockProps} />
      </div>
    )});
  }

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <div className="space-y-2">
        <SectionHeader icon={FileText} label="Topics" />
        <ContentBlocks blocks={groups.other} {...blockProps} />
      </div>
    )});
  }

  if (groups.transcripts.length > 0) {
    sections.push({ key: 'transcripts', node: (
      <ContentBlocks blocks={groups.transcripts} {...blockProps} />
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
