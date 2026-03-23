import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ActionButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'default';
  disabled?: boolean;
  className?: string;
}

const VARIANT_MAP = {
  primary: 'default',
  ghost: 'ghost',
  outline: 'outline',
} as const;

/**
 * Domain-free action button.
 * Wraps shadcn Button with common patterns for interactive views.
 */
export const ActionButton = memo(function ActionButton({
  children,
  icon,
  onClick,
  variant = 'ghost',
  size = 'sm',
  disabled,
  className,
}: ActionButtonProps) {
  return (
    <Button
      variant={VARIANT_MAP[variant]}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn('gap-1.5', className)}
    >
      {icon && <span className="[&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>}
      {children}
    </Button>
  );
});
