import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CrossTabLinkProps {
  tabId: string;
  label: string;
  onNavigate: (tabId: string) => void;
}

/**
 * Navigation link between tabs. Full-width button with accent styling.
 * Uses VIE accent CSS variables for consistent theming.
 */
export const CrossTabLink = memo(function CrossTabLink({
  tabId,
  label,
  onNavigate,
}: CrossTabLinkProps) {
  return (
    <Button
      variant="ghost"
      size="bare"
      onClick={() => onNavigate(tabId)}
      className="w-full flex items-center justify-between px-4 py-3 rounded-lg
        bg-[var(--vie-accent-muted)] border border-[var(--vie-accent-border)]
        text-[var(--vie-accent)] text-sm font-medium
        active:scale-[0.97] transition-all duration-150"
    >
      <span>{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </Button>
  );
});
