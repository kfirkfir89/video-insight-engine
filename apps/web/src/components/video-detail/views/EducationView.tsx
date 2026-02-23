import { memo, type ReactNode } from 'react';
import { BookOpen, Calculator, Hash, HelpCircle, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { ViewLayout, LayoutSection, sidebarMainOrFallback, renderSections } from './ViewLayout';

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

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  const sections: { key: string; node: ReactNode }[] = [];

  // Top row: sidebar (formulas + keyvalues) + main (definitions)
  const hasSidebar = groups.formulas.length > 0 || groups.keyvalues.length > 0;
  const hasDefinitions = groups.definitions.length > 0;
  const hasOther = groups.other.length > 0;

  const fallback: { key: string; node: ReactNode }[] = [];
  if (hasDefinitions) fallback.push({ key: 'definitions', node: (
    <LayoutSection icon={BookOpen} label="Definitions">
      <ContentBlocks blocks={groups.definitions} {...blockProps} />
    </LayoutSection>
  )});
  if (hasOther) fallback.push({ key: 'other', node: (
    <ContentBlocks blocks={groups.other} {...blockProps} />
  )});
  if (groups.formulas.length > 0) fallback.push({ key: 'formulas', node: (
    <LayoutSection icon={Calculator} label="Formulas">
      <ContentBlocks blocks={groups.formulas} {...blockProps} />
    </LayoutSection>
  )});
  if (groups.keyvalues.length > 0) fallback.push({ key: 'keyvalues', node: (
    <LayoutSection icon={Hash} label="Key Facts">
      <ContentBlocks blocks={groups.keyvalues} {...blockProps} />
    </LayoutSection>
  )});

  sections.push(...sidebarMainOrFallback(
    hasSidebar ? (
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
    ) : null,
    (hasDefinitions || hasOther) ? (
      <>
        {hasDefinitions && (
          <LayoutSection icon={BookOpen} label="Definitions">
            <ContentBlocks blocks={groups.definitions} {...blockProps} />
          </LayoutSection>
        )}
        {hasOther && (
          <div className={hasDefinitions ? 'mt-6' : ''}>
            <ContentBlocks blocks={groups.other} {...blockProps} />
          </div>
        )}
      </>
    ) : null,
    fallback,
  ));

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
