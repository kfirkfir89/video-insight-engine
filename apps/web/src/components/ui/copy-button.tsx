import { memo, useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

export interface CopyButtonProps {
  /** Text to copy to clipboard */
  text: string;
  /** Button variant */
  variant?: 'default' | 'ghost' | 'outline';
  /** Button size */
  size?: 'default' | 'sm' | 'icon';
  /** Custom class name */
  className?: string;
  /** Label for accessibility */
  label?: string;
  /** Show tooltip */
  showTooltip?: boolean;
  /** Callback after successful copy */
  onCopy?: () => void;
}

/**
 * Copy to clipboard button with success feedback.
 */
export const CopyButton = memo(function CopyButton({
  text,
  variant = 'ghost',
  size = 'icon',
  className,
  label = 'Copy to clipboard',
  showTooltip = true,
  onCopy,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-HTTPS or restricted contexts
    }
  }, [text, onCopy]);

  const button = (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn(
        'transition-colors',
        copied && 'text-emerald-500',
        className
      )}
      aria-label={copied ? 'Copied!' : label}
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );

  if (!showTooltip) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>{copied ? 'Copied!' : label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
