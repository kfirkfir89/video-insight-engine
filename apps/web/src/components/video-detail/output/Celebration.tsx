// Backward-compatible adapter for old Celebration API.
// New code should import { Celebration, CelebrationNextButton } from '@/components/vie'.
import { memo } from 'react';
import { Celebration as VieCelebration, CelebrationNextButton } from '@/components/vie';

interface LegacyCelebrationProps {
  emoji: string;
  title: string;
  subtitle?: string;
  nextTabId?: string;
  nextLabel?: string;
  onNavigateTab?: (tabId: string) => void;
}

export const Celebration = memo(function Celebration({
  emoji,
  title,
  subtitle,
  nextTabId,
  nextLabel,
  onNavigateTab,
}: LegacyCelebrationProps) {
  const action =
    nextTabId && nextLabel && onNavigateTab ? (
      <CelebrationNextButton label={nextLabel} onClick={() => onNavigateTab(nextTabId)} />
    ) : undefined;

  return (
    <VieCelebration
      emoji={emoji}
      title={title}
      subtitle={subtitle}
      action={action}
    />
  );
});
