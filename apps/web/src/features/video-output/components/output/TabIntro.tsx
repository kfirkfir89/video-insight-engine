import { memo } from 'react';

interface TabIntroProps {
  goal: string;
}

/** Subtle intro paragraph displaying a tab's goal/purpose. */
export const TabIntro = memo(function TabIntro({ goal }: TabIntroProps) {
  if (!goal) return null;

  return (
    <p className="text-sm text-muted-foreground border-s-2 border-primary/20 ps-3 mb-4 leading-relaxed">
      {goal}
    </p>
  );
});
