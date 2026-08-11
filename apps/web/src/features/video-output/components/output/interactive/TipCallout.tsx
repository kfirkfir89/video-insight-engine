import { memo } from 'react';
import { Callout } from '@/components/vie';

type TipCalloutStyle = 'tip' | 'warning' | 'note';

interface TipCalloutProps {
  text: string;
  style?: TipCalloutStyle;
  title?: string;
  className?: string;
}

/**
 * TipCallout — a single highlighted aside. Secondary-tier (attachment-only).
 * Delegates to the `Callout` primitive, which uses a full border + background
 * tint (never a colored side-stripe, per DESIGN.md). When a `title` is given it
 * is prefixed inline so the callout still reads as one block.
 */
export const TipCallout = memo(function TipCallout({
  text,
  style = 'tip',
  title,
  className,
}: TipCalloutProps) {
  if (!text?.trim()) return null;
  const body = title ? `${title}: ${text}` : text;
  return <Callout style={style} text={body} className={className} />;
});
