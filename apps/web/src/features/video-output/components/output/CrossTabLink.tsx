// Backward-compatible adapter for old CrossTabLink API.
// New code should import { CrossTabButton } from '@/components/vie'.
import { memo, useCallback } from 'react';
import { CrossTabButton } from '@/components/vie';

interface CrossTabLinkProps {
  tabId: string;
  label: string;
  /** Optional 1-line description from the target tab's goal. */
  description?: string;
  onNavigate: (tabId: string) => void;
}

export const CrossTabLink = memo(function CrossTabLink({
  tabId,
  label,
  description,
  onNavigate,
}: CrossTabLinkProps) {
  const handleClick = useCallback(() => {
    onNavigate(tabId);
  }, [tabId, onNavigate]);

  return <CrossTabButton label={label} description={description} onClick={handleClick} />;
});
