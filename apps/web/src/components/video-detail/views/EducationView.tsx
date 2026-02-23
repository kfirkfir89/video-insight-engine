import { memo, type ReactNode } from 'react';
import { BookOpen, Calculator, Hash, HelpCircle, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { ViewLayout, LayoutSection, buildPairedSection, renderSections } from './ViewLayout';

interface EducationViewProps {
  chapter: SummaryChapter;
  onPlay?: (seconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  activeStartSeconds?: number;
}

const EDUCATION_RULES: readonly BlockGroupRule[] = [
  { name: 'definitions', match: (b) => b.type === 'definition' },
  { name: 'formulas', match: (b) => b.type === 'formula' },
  { name: 'keyvalues', match: (b) => b.type === 'keyvalue' },
  { name: 'quizzes', match: (b) => b.type === 'quiz' },
  { name: 'tips', match: (b) => b.type === 'callout' && b.variant === 'learning_tip' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for educational content.
 * Layout: sidebar (formulas/keyvalues) + main (definitions), quizzes/tips full-width below.
 */
export const EducationView = memo(function EducationView({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: EducationViewProps) {
  const groups = useGroupedBlocks(chapter.content, EDUCATION_RULES);

  const blockProps = { onPlay, onStop, isVideoActive, activeStartSeconds };

  const sections: { key: string; node: ReactNode }[] = [];

  // Top row: sidebar (formulas + keyvalues) + main (definitions)
  const sidebarBlocks = [...groups.formulas, ...groups.keyvalues];
  const hasSidebar = sidebarBlocks.length > 0;
  const hasDefinitions = groups.definitions.length > 0;

  if (hasSidebar && hasDefinitions) {
    sections.push(buildPairedSection(
      { width: 'sidebar', node: (
        <>
          {groups.formulas.length > 0 && (
            <LayoutSection icon={Calculator} label="Formulas">
              <ContentBlocks blocks={groups.formulas} {...blockProps} />
            </LayoutSection>
          )}
          {groups.keyvalues.length > 0 && (
            <div className={groups.formulas.length > 0 ? 'mt-6' : ''}>
              <LayoutSection icon={Hash} label="Key Facts">
                <ContentBlocks blocks={groups.keyvalues} {...blockProps} />
              </LayoutSection>
            </div>
          )}
        </>
      )},
      { width: 'main', node: (
        <>
          <LayoutSection icon={BookOpen} label="Definitions">
            <ContentBlocks blocks={groups.definitions} {...blockProps} />
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
    if (hasDefinitions) {
      sections.push({ key: 'definitions', node: (
        <LayoutSection icon={BookOpen} label="Definitions">
          <ContentBlocks blocks={groups.definitions} {...blockProps} />
        </LayoutSection>
      )});
    }

    if (groups.other.length > 0) {
      sections.push({ key: 'other', node: (
        <ContentBlocks blocks={groups.other} {...blockProps} />
      )});
    }

    if (groups.formulas.length > 0) {
      sections.push({ key: 'formulas', node: (
        <LayoutSection icon={Calculator} label="Formulas">
          <ContentBlocks blocks={groups.formulas} {...blockProps} />
        </LayoutSection>
      )});
    }

    if (groups.keyvalues.length > 0) {
      sections.push({ key: 'keyvalues', node: (
        <LayoutSection icon={Hash} label="Key Facts">
          <ContentBlocks blocks={groups.keyvalues} {...blockProps} />
        </LayoutSection>
      )});
    }
  }

  if (groups.quizzes.length > 0) {
    sections.push({ key: 'quizzes', node: (
      <LayoutSection icon={HelpCircle} label="Questions">
        <ContentBlocks blocks={groups.quizzes} {...blockProps} />
      </LayoutSection>
    )});
  }

  if (groups.tips.length > 0) {
    sections.push({ key: 'tips', node: (
      <ContentBlocks blocks={groups.tips} {...blockProps} />
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
