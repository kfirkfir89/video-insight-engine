import { memo, type ReactNode } from 'react';
import { Lightbulb, AlertTriangle, Info, ShieldAlert, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

type CalloutStyle = 'tip' | 'warning' | 'note' | 'security' | 'chef_tip';

interface CalloutProps {
  style: CalloutStyle;
  text: string;
  className?: string;
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
  borderColor: string;
}

const CALLOUT_CONFIG: Record<CalloutStyle, CalloutConfig> = {
  tip: {
    accentColor: 'warning',
    icon: <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    label: 'Tip',
    bgTint: 'callout-gradient-tip',
    borderColor: 'border-warning/20',
  },
  warning: {
    accentColor: 'destructive',
    icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    label: 'Warning',
    bgTint: 'callout-gradient-warning',
    borderColor: 'border-destructive/20',
  },
  note: {
    accentColor: 'info',
    icon: <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    label: 'Note',
    bgTint: 'callout-gradient-note',
    borderColor: 'border-info/20',
  },
  security: {
    accentColor: 'destructive',
    icon: <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    label: 'Security',
    bgTint: 'callout-gradient-security',
    borderColor: 'border-destructive/20',
  },
  chef_tip: {
    accentColor: 'warning',
    icon: <ChefHat className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    label: 'Chef Tip',
    bgTint: 'callout-gradient-tip',
    borderColor: 'border-warning/20',
  },
};

/**
 * Domain-free callout display.
 * Renders a callout with full border + background tint based on style.
 * Styles: tip, warning, note, security, chef_tip
 */
export const Callout = memo(function Callout({ style, text, className }: CalloutProps) {
  const config = CALLOUT_CONFIG[style] ?? CALLOUT_CONFIG.note;

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        config.borderColor,
        config.bgTint,
        className,
      )}
      role="note"
      aria-label={config.label}
    >
      <div className="flex items-start gap-1.5">
        <span className={cn('mt-0.5', ACCENT_TEXT_COLOR[config.accentColor])}>{config.icon}</span>
        <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
});
