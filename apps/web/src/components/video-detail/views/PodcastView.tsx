import { memo, useMemo } from 'react';
import { Clock } from 'lucide-react';
import type { SummaryChapter, ContentBlock } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';

interface PodcastViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

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
  // Group blocks by type for podcast-optimized layout
  const { guestBlocks, quoteBlocks, transcriptBlocks, timestampBlocks, otherBlocks } = useMemo(() => {
    const guests: ContentBlock[] = [];
    const quotes: ContentBlock[] = [];
    const transcripts: ContentBlock[] = [];
    const timestamps: ContentBlock[] = [];
    const other: ContentBlock[] = [];

    for (const block of chapter.content ?? []) {
      if (block.type === 'guest') {
        guests.push(block);
      } else if (block.type === 'quote') {
        quotes.push(block);
      } else if (block.type === 'transcript') {
        transcripts.push(block);
      } else if (block.type === 'timestamp') {
        timestamps.push(block);
      } else {
        other.push(block);
      }
    }

    return {
      guestBlocks: guests,
      quoteBlocks: quotes,
      transcriptBlocks: transcripts,
      timestampBlocks: timestamps,
      otherBlocks: other,
    };
  }, [chapter.content]);

  const hasGuests = guestBlocks.length > 0;
  const hasQuotes = quoteBlocks.length > 0;
  const hasTranscripts = transcriptBlocks.length > 0;
  const hasTimestamps = timestampBlocks.length > 0;
  const hasOtherBlocks = otherBlocks.length > 0;

  // Early return for empty content
  if (!hasGuests && !hasQuotes && !hasTranscripts && !hasTimestamps && !hasOtherBlocks) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Guests Section - Bio cards at the top */}
      {hasGuests && (
        <ContentBlocks
          blocks={guestBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Key Quotes Section */}
      {hasQuotes && (
        <ContentBlocks
          blocks={quoteBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Main content (non-categorized blocks) */}
      {hasOtherBlocks && (
        <ContentBlocks
          blocks={otherBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Transcript Segments */}
      {hasTranscripts && (
        <ContentBlocks
          blocks={transcriptBlocks}
          onPlay={onPlay}
          onStop={onStop}
          isVideoActive={isVideoActive}
          activeStartSeconds={activeStartSeconds}
        />
      )}

      {/* Topic Timestamps */}
      {hasTimestamps && (
        <div className="mt-3">
          <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Topics Discussed</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            <ContentBlocks
              blocks={timestampBlocks}
              onPlay={onPlay}
              onStop={onStop}
              isVideoActive={isVideoActive}
              activeStartSeconds={activeStartSeconds}
            />
          </div>
        </div>
      )}
    </div>
  );
});
