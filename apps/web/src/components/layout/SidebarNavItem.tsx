import { memo } from "react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Active-state visual variants.
 * - "primary": violet tint (default for Library and other neutral rails)
 * - "coral": warm accent for wayfinding differentiation (Assistant)
 * Only backgrounds + ring tints are used; no side-stripe borders.
 */
export type NavItemAccent = "primary" | "coral";

interface SidebarNavItemBaseProps {
  /** lucide-react icon component. */
  icon: ComponentType<{ className?: string }>;
  /** Visible label (when expanded) and tooltip copy (when collapsed). */
  label: string;
  /** Required accessible name — may differ from `label` (e.g. "Create a new video summary"). */
  ariaLabel: string;
  /** Optional inline tooltip content for shortcut hints, rendered only when collapsed. */
  tooltipHint?: ReactNode;
  /** Collapsed = icon-only rail. Expanded = icon + label stacked. */
  collapsed: boolean;
  /** Whether this represents the current active section/route. */
  active?: boolean;
  /** Active-state color variant. */
  accent?: NavItemAccent;
  /** Visual emphasis — "solid" renders the item as the primary CTA (New summary). */
  variant?: "ghost" | "solid";
}

type SidebarNavItemProps =
  | (SidebarNavItemBaseProps & {
      as: "link";
      to: string;
      onClick?: () => void;
    })
  | (SidebarNavItemBaseProps & {
      as: "button";
      onClick: () => void;
    });

const ICON_BOX = "h-10 w-10";
const ICON_SIZE = "h-[18px] w-[18px]";

function activeClasses(accent: NavItemAccent): string {
  if (accent === "coral") {
    // Coral accent for Assistant — visual contrast vs. Library/primary items.
    return cn(
      "bg-[oklch(from_var(--vie-coral)_l_c_h_/_0.12)]",
      "text-[var(--vie-coral)]",
      "ring-1 ring-[oklch(from_var(--vie-coral)_l_c_h_/_0.22)]",
    );
  }
  return cn(
    "bg-primary/10",
    "text-primary",
    "ring-1 ring-primary/20",
  );
}

function idleClasses(): string {
  return "text-muted-foreground hover:bg-muted hover:text-foreground";
}

function solidClasses(): string {
  // Primary CTA — "New summary". Same hue in idle + hover so it reads as a button.
  return "bg-primary text-primary-foreground hover:bg-primary/90";
}

/**
 * Unified nav item for the left icon strip.
 * Renders both collapsed (icon-only + hover tooltip) and expanded
 * (icon + label below) layouts while preserving route/active semantics.
 *
 * When collapsed: trigger is wrapped in a Radix Tooltip so mouse users
 * can probe labels. When expanded: the label is visible in-rail, so the
 * tooltip is skipped to avoid redundant content.
 */
export const SidebarNavItem = memo(function SidebarNavItem(
  props: SidebarNavItemProps,
) {
  const {
    icon: Icon,
    label,
    ariaLabel,
    tooltipHint,
    collapsed,
    active = false,
    accent = "primary",
    variant = "ghost",
  } = props;

  const stateClasses =
    variant === "solid"
      ? solidClasses()
      : active
        ? activeClasses(accent)
        : idleClasses();

  const focusRing = cn(
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "focus-visible:ring-offset-1 focus-visible:ring-offset-card",
  );

  const collapsedClassName = cn(
    "flex items-center justify-center rounded-lg transition-colors",
    "motion-reduce:transition-none",
    focusRing,
    ICON_BOX,
    stateClasses,
  );

  const expandedClassName = cn(
    "flex flex-col items-center justify-center gap-1 w-14 py-1.5 rounded-lg transition-colors",
    "motion-reduce:transition-none",
    focusRing,
    stateClasses,
  );

  const renderContent = () => {
    if (collapsed) {
      return <Icon className={ICON_SIZE} aria-hidden="true" />;
    }
    return (
      <>
        <span className="flex items-center justify-center rounded-md h-8 w-8">
          <Icon className={ICON_SIZE} aria-hidden="true" />
        </span>
        <span
          className={cn(
            // text-xs (0.6875rem ≈ 11px) — tight tracking, single line, body font.
            "text-xs leading-none tracking-tight font-medium",
            "max-w-[3.25rem] truncate",
          )}
        >
          {label}
        </span>
      </>
    );
  };

  const trigger =
    props.as === "link" ? (
      <Link
        to={props.to}
        aria-label={ariaLabel}
        onClick={props.onClick}
        className={collapsed ? collapsedClassName : expandedClassName}
      >
        {renderContent()}
      </Link>
    ) : (
      <button
        type="button"
        onClick={props.onClick}
        aria-label={ariaLabel}
        aria-pressed={variant === "ghost" && active ? true : undefined}
        className={collapsed ? collapsedClassName : expandedClassName}
      >
        {renderContent()}
      </button>
    );

  // Expanded: label already visible — skip tooltip to avoid redundancy.
  if (!collapsed) {
    return trigger;
  }

  // Collapsed: near-instant tooltip so mouse probing works immediately.
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
        {tooltipHint ? (
          <span className="opacity-60 ms-1">{tooltipHint}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
});
