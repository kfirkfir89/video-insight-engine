import { Fragment, memo, type ReactNode } from 'react';
import { BookOpen, Calculator, HelpCircle, Clock } from 'lucide-react';
import type { SummaryChapter } from '@vie/types';
import { ContentBlocks } from '../ContentBlocks';
import { useGroupedBlocks, type BlockGroupRule } from '@/hooks/use-grouped-blocks';
import { SectionHeader } from './SectionHeader';

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
  { name: 'quizzes', match: (b) => b.type === 'quiz' },
  { name: 'tips', match: (b) => b.type === 'callout' && b.variant === 'learning_tip' },
  { name: 'timestamps', match: (b) => b.type === 'timestamp' },
];

/**
 * Specialized view for educational content.
 * Emphasizes:
 * - Key concepts/definitions at the top
 * - Formulas and equations
 * - Interactive quizzes
 * - Learning tips and callouts
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

  if (groups.definitions.length > 0) {
    sections.push({ key: 'definitions', node: (
      <div className="space-y-2">
        <SectionHeader icon={BookOpen} label="Definitions" />
        <ContentBlocks blocks={groups.definitions} {...blockProps} />
      </div>
    )});
  }

  if (groups.other.length > 0) {
    sections.push({ key: 'other', node: (
      <ContentBlocks blocks={groups.other} {...blockProps} />
    )});
  }

  if (groups.formulas.length > 0) {
    sections.push({ key: 'formulas', node: (
      <div className="space-y-2">
        <SectionHeader icon={Calculator} label="Formulas" />
        <ContentBlocks blocks={groups.formulas} {...blockProps} />
      </div>
    )});
  }

  if (groups.quizzes.length > 0) {
    sections.push({ key: 'quizzes', node: (
      <div className="space-y-2">
        <SectionHeader icon={HelpCircle} label="Questions" />
        <ContentBlocks blocks={groups.quizzes} {...blockProps} />
      </div>
    )});
  }

  if (groups.tips.length > 0) {
    sections.push({ key: 'tips', node: (
      <ContentBlocks blocks={groups.tips} {...blockProps} />
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
