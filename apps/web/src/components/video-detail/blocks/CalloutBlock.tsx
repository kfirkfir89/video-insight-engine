import { memo } from 'react';
import { Lightbulb, AlertTriangle, Info, ShieldAlert, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import { ConceptHighlighter } from '../ConceptHighlighter';
import type { CalloutStyle } from '@vie/types';
import type { ReactNode } from 'react';

interface CalloutBlockProps {
  style: CalloutStyle;
  variant?: string;
  text: string;
  blockId?: string;
}

type AccentColor = 'primary' | 'destructive' | 'success' | 'warning' | 'info';

const ACCENT_TEXT_COLOR: Record<AccentColor, string> = {
  primary: 'text-primary',
  destructive: 'text-destructive',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
};

interface CalloutConfig {
  accentColor: AccentColor;
  icon: ReactNode;
  label: string;
  bgTint: string;
}

const CALLOUT_CONFIG: Record<CalloutStyle, CalloutConfig> = {
  tip: {
    accentColor: 'warning',
    icon: <Lightbulb className="h-4 w-4 shrink-0" aria-hidden="true" />,
    label: 'Tip',
    bgTint: 'callout-gradient-tip',
  },
  warning: {
    accentColor: 'destructive',
    icon: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    label: 'Warning',
    bgTint: 'callout-gradient-warning',
  },
  note: {
    accentColor: 'info',
    icon: <Info className="h-4 w-4 shrink-0" aria-hidden="true" />,
    label: 'Note',
    bgTint: 'callout-gradient-note',
  },
  security: {
    accentColor: 'destructive',
    icon: <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />,
    label: 'Security',
    bgTint: 'callout-gradient-security',
  },
  chef_tip: {
    accentColor: 'warning',
    icon: <ChefHat className="h-4 w-4 shrink-0" aria-hidden="true" />,
    label: 'Chef Tip',
    bgTint: 'callout-gradient-tip',
  },
};

/**
 * Renders a callout block with accent-left border and icon based on style.
 * Styles: tip, warning, note, security, chef_tip
 */
export const CalloutBlock = memo(function CalloutBlock({ style, variant, text, blockId }: CalloutBlockProps) {
  const effectiveStyle = variant === 'chef_tip' && style === 'tip' ? 'chef_tip' : style;
  const config = CALLOUT_CONFIG[effectiveStyle] ?? CALLOUT_CONFIG.note;

  return (
    <BlockWrapper
      blockId={blockId}
      variant="accent"
      accentColor={config.accentColor}
      label={config.label}
      className={config.bgTint}
    >
      <div className="flex items-start gap-2">
        <span className={cn('mt-0.5 animate-breathe', ACCENT_TEXT_COLOR[config.accentColor])}>{config.icon}</span>
        <p className="text-sm text-muted-foreground"><ConceptHighlighter text={text} /></p>
      </div>
    </BlockWrapper>
  );
});
