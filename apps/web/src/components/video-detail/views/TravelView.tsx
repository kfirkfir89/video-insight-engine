import { Fragment, memo, type ReactNode } from 'react';
import { MapPin, Route, DollarSign, Lightbulb, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

interface TravelViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const TRAVEL_RULES: readonly BlockGroupRule[] = [
  { name: 'locations', match: (b) => b.type === 'location' },
  { name: 'itinerary', match: (b) => b.type === 'itinerary' },
  { name: 'costs', match: (b) => b.type === 'cost' },
  { name: 'tips', match: (b) => b.type === 'callout' && b.variant === 'travel_tip' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for travel content.
 * Emphasizes:
 * - Location highlights at the top
 * - Itinerary/day-by-day plans
 * - Cost breakdowns
 * - Travel tips and callouts
 */
export const TravelView = memo(function TravelView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: TravelViewProps) {
  const groups = useGroupedBlocks(chapter.content, TRAVEL_RULES);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  if (groups.locations.length > 0) {
    sections.push({ key: 'locations', node: (
      <div className="space-y-2">
        <SectionHeader icon={MapPin} label="Itineraries" />
        <ContentBlocks blocks={groups.locations} {...blockProps} />
      </div>
    )});
  }

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
    )});
  }

  if (groups.itinerary.length > 0) {
    sections.push({ key: 'itinerary', node: (
      <div className="space-y-2">
        <SectionHeader icon={Route} label="Routes" />
        <ContentBlocks blocks={groups.itinerary} {...blockProps} />
      </div>
    )});
  }

  if (groups.costs.length > 0) {
    sections.push({ key: 'costs', node: (
      <div className="space-y-2">
        <SectionHeader icon={DollarSign} label="Costs" />
        <ContentBlocks blocks={groups.costs} {...blockProps} />
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
