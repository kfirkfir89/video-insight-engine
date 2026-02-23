import { memo, type ReactNode } from 'react';
import { MapPin, Route, DollarSign, Lightbulb, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { ViewLayout, LayoutSection, buildPairedSection, renderSections } from './ViewLayout';

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
 * Layout: sidebar (costs/locations) + main (itineraries/routes), tips/timestamps full-width below.
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

  // Top row: sidebar (costs + locations) + main (itineraries)
  const sidebarBlocks = [...groups.costs, ...groups.locations];
  const hasSidebar = sidebarBlocks.length > 0;
  const hasMain = groups.itinerary.length > 0;

  if (hasSidebar && hasMain) {
    sections.push(buildPairedSection(
      { width: 'sidebar', node: (
        <>
          {groups.costs.length > 0 && (
            <LayoutSection icon={DollarSign} label="Costs">
              <ContentBlocks blocks={groups.costs} {...blockProps} />
            </LayoutSection>
          )}
          {groups.locations.length > 0 && (
            <div className={groups.costs.length > 0 ? 'mt-6' : ''}>
              <LayoutSection icon={MapPin} label="Locations">
                <ContentBlocks blocks={groups.locations} {...blockProps} />
              </LayoutSection>
            </div>
          )}
        </>
      )},
      { width: 'main', node: (
        <>
          <LayoutSection icon={Route} label="Routes">
            <ContentBlocks blocks={groups.itinerary} {...blockProps} />
          </LayoutSection>
          {groups.other.length > 0 && (
            <div className="mt-6">
              <ContentBlocks blocks={groups.other} {...blockProps} />
            </div>
          )}
        </>
      )},
    ));
  } else {
    if (groups.locations.length > 0) {
      sections.push({ key: 'locations', node: (
        <LayoutSection icon={MapPin} label="Locations">
          <ContentBlocks blocks={groups.locations} {...blockProps} />
        </LayoutSection>
      )});
    }

    if (groups.other.length > 0) {
      sections.push({ key: 'other', node: (
        <ContentBlocks blocks={groups.other} {...blockProps} />
      )});
    }

    if (groups.itinerary.length > 0) {
      sections.push({ key: 'itinerary', node: (
        <LayoutSection icon={Route} label="Routes">
          <ContentBlocks blocks={groups.itinerary} {...blockProps} />
        </LayoutSection>
      )});
    }

    if (groups.costs.length > 0) {
      sections.push({ key: 'costs', node: (
        <LayoutSection icon={DollarSign} label="Costs">
          <ContentBlocks blocks={groups.costs} {...blockProps} />
        </LayoutSection>
      )});
    }
  }

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
