import type { ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * VieMenu — the unified menu language for the whole app.
 *
 * One surface, one type scale, one motion signature. Every dropdown
 * (context menu, picker, action menu, user card) renders through this.
 * Variants differ only in *content model* (what children they accept),
 * never in surface.
 */

export interface VieMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  /** Optional accent color token. Tints hover bg + leading-icon color. */
  accent?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MENU_SURFACE_CLASS =
  'rounded-xl border border-border/60 bg-popover/95 p-1 shadow-[var(--shadow-xl)] backdrop-blur-[12px] ring-1 ring-border/30';

export function VieMenu({
  trigger,
  children,
  accent,
  align = 'end',
  side,
  className,
  open,
  onOpenChange,
}: VieMenuProps) {
  const accentStyle = accent
    ? ({ ['--menu-accent' as string]: accent } as React.CSSProperties)
    : undefined;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        className={cn(MENU_SURFACE_CLASS, 'min-w-[14rem]', className)}
        style={accentStyle}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface VieMenuItemProps {
  icon?: ReactNode;
  hint?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  children: ReactNode;
  className?: string;
}

export function VieMenuItem({
  icon,
  hint,
  destructive,
  disabled,
  onSelect,
  children,
  className,
}: VieMenuItemProps) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'group/item h-9 px-2.5 rounded-md text-sm cursor-pointer transition-colors',
        'focus:bg-[oklch(from_var(--menu-accent,var(--primary))_l_c_h_/_0.1)]',
        'data-[highlighted]:bg-[oklch(from_var(--menu-accent,var(--primary))_l_c_h_/_0.1)]',
        destructive &&
          'text-destructive focus:bg-destructive/10 data-[highlighted]:bg-destructive/10',
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            'inline-flex items-center justify-center w-4 h-4 me-2 shrink-0 text-muted-foreground',
            'group-focus/item:text-[var(--menu-accent,var(--primary))]',
            'group-data-[highlighted]/item:text-[var(--menu-accent,var(--primary))]',
            destructive &&
              'group-focus/item:text-destructive group-data-[highlighted]/item:text-destructive',
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {hint && (
        <span className="ms-3 text-[11px] text-muted-foreground/80 tabular-nums shrink-0">
          {hint}
        </span>
      )}
    </DropdownMenuItem>
  );
}

export function VieMenuSeparator({ label }: { label?: string }) {
  if (label) {
    return (
      <div className="px-2.5 pt-2 pb-1">
        <span className="type-eyebrow text-[10px] text-muted-foreground/70">{label}</span>
      </div>
    );
  }
  return <DropdownMenuSeparator className="my-1 bg-border/40" />;
}

export function VieMenuDestructiveDivider() {
  return <DropdownMenuSeparator className="my-1 bg-destructive/10" />;
}

export function VieMenuHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-2.5 py-2 border-b border-border/40 mb-1', className)}>{children}</div>
  );
}

interface VieMenuSubProps {
  trigger: ReactNode;
  icon?: ReactNode;
  /** Right-aligned affordance mirroring VieMenuItem's hint — e.g. the active
   *  value for a submenu selector ("Newest first", "Medium"). Sits before the
   *  auto-appended chevron caret. */
  hint?: ReactNode;
  children: ReactNode;
}
export function VieMenuSub({ trigger, icon, hint, children }: VieMenuSubProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className={cn(
          'h-9 px-2.5 rounded-md text-sm cursor-pointer',
          'focus:bg-[oklch(from_var(--menu-accent,var(--primary))_l_c_h_/_0.1)]',
          'data-[highlighted]:bg-[oklch(from_var(--menu-accent,var(--primary))_l_c_h_/_0.1)]',
        )}
      >
        {icon && (
          <span className="inline-flex items-center justify-center w-4 h-4 me-2 shrink-0 text-muted-foreground">
            {icon}
          </span>
        )}
        <span className="flex-1 truncate">{trigger}</span>
        {hint && (
          <span className="ms-3 text-[11px] text-muted-foreground/80 tabular-nums shrink-0">
            {hint}
          </span>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={MENU_SURFACE_CLASS}>{children}</DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
