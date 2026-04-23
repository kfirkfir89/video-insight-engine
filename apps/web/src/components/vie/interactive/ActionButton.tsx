import { memo, useRef, type ReactNode } from 'react';
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
 * Wraps shadcn Button with a CSS click ripple. No motion runtime.
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
  const hostRef = useRef<HTMLSpanElement>(null);

  const fireRipple = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const host = hostRef.current;
    if (host) {
      const rect = host.getBoundingClientRect();
      host.style.setProperty('--ripple-x', `${e.clientX - rect.left}px`);
      host.style.setProperty('--ripple-y', `${e.clientY - rect.top}px`);
      host.classList.remove('vie-rippling');
      void host.offsetWidth;
      host.classList.add('vie-rippling');
    }
    onClick();
  };

  return (
    <span ref={hostRef} className={cn('vie-ripple inline-flex rounded-md', className)}>
      <Button
        variant={VARIANT_MAP[variant]}
        size={size}
        onClick={fireRipple}
        disabled={disabled}
        className="gap-1.5 hover:-translate-y-px active:translate-y-0 transition-transform duration-150 motion-reduce:hover:translate-y-0 motion-reduce:transition-none"
      >
        {icon && <span className="[&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>}
        {children}
      </Button>
    </span>
  );
});
