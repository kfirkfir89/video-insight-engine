import { memo, useMemo } from 'react';
import { BookOpen, Calculator, Hash, HelpCircle, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { useBlockProps } from '@/hooks/use-block-props';
import { ProgressView } from '../containers/ProgressView';
import { ViewLayout, LayoutSection, sidebarMainOrFallback, renderSections } from './ViewLayout';

interface EducationViewProps {
  chapter: SummaryChapter;
  chapterId?: string;
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
 * Uses ProgressView for definitions (trackable completion).
 * Layout: definitions with progress tracking, sidebar (formulas/keyvalues), quizzes/tips below.
 */
export const EducationView = memo(function EducationView({
  chapter,
  chapterId,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: EducationViewProps) {
  const groups = useGroupedBlocks(chapter.content, EDUCATION_RULES);

  const blockProps = useBlockProps(onPlay, onStop, isVideoActive, activeStartSeconds);

  // Build progress items from definitions (trackable)
  const progressItems = useMemo(() => {
    return groups.definitions.map((block, i) => ({
      id: `def-${i}`,
      label: 'term' in block && typeof block.term === 'string' ? block.term : `Concept ${i + 1}`,
      content: <ContentBlocks blocks={[block]} {...blockProps} />,
    }));
  }, [groups.definitions, blockProps]);

  const sections: { key: string; node: React.ReactNode }[] = [];

  // Definitions wrapped in ProgressView (trackable completion)
  if (progressItems.length > 0) {
    sections.push({ key: 'definitions', node: (
      <LayoutSection icon={BookOpen} label="Concepts to Learn">
        <ProgressView
          items={progressItems}
          storageKey={chapterId ? `edu-${chapterId}` : undefined}
        />
      </LayoutSection>
    )});
  }

  // Other content + formulas/keyvalues in sidebar layout
  const hasSidebar = groups.formulas.length > 0 || groups.keyvalues.length > 0;
  const hasOther = groups.other.length > 0;

  const fallback: { key: string; node: React.ReactNode }[] = [];
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
    hasOther ? (
      <ContentBlocks blocks={groups.other} {...blockProps} />
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
