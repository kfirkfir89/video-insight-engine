import { memo, useId } from "react";
import { cn } from "@/lib/utils";

// ─── Standalone brand mark ───────────────────────────────────

interface VieMarkProps {
  /** Render size. `xl` is reserved for hero moments (auth, landing). */
  size?: "sm" | "md" | "lg" | "xl";
  /** Quiet radial halo behind the mark in dark mode. Opt-in. */
  glow?: boolean;
  /** Staggered entrance on mount; respects `prefers-reduced-motion`. */
  animated?: boolean;
  className?: string;
  title?: string;
}

const MARK_SIZES = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
  lg: "h-9 w-9",
  xl: "h-14 w-14",
} as const;

/**
 * VIE brand mark — "The Distillate".
 *
 * A faceted downward triangle (∇) — the nabla, mathematics' symbol for
 * gradient and divergence — rendered as a three-plane cut gem. The
 * composition visualizes the product's single promise: a wide surface
 * of raw video content (the top edge) distilled through the extraction
 * pipeline (the three converging faces) down to a concentrated point of
 * insight (the apex).
 *
 * Three planes split the silhouette from a central inflection point:
 * the top face catches light (lightest OKLCH step), the left flank sits
 * in mid-tone, and the right flank drops into shadow. All three shifts
 * stay inside the brand's violet hue — no rainbow gradient, no AI slop.
 *
 * The coral vertex dot sits precisely at the inflection point where the
 * three planes meet — the "moment of understanding" the product delivers.
 * It is the one coral element in the mark, intentional and singular.
 *
 * The shape reads as a nabla regardless of size: at favicon scale the
 * planes blur into a solid violet triangle with a coral center; at hero
 * scale the gem faceting and the inflection vertex become visible.
 */
export const VieMark = memo(function VieMark({
  size = "md",
  glow = false,
  animated = false,
  className,
  title = "VIE",
}: VieMarkProps) {
  const haloId = useId();
  const topId = useId();
  const leftId = useId();
  const rightId = useId();
  return (
    <svg
      viewBox="0 0 112 112"
      role="img"
      aria-label={title}
      className={cn(
        "vie-mark shrink-0 overflow-visible",
        MARK_SIZES[size],
        animated && "vie-mark--animated",
        className,
      )}
    >
      <title>{title}</title>
      <defs>
        {/* Top face — catches light. Brightest of the three, shifts from
            a lifted tint at the top edge down into the base primary at
            the inflection vertex. */}
        <linearGradient id={topId} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="oklch(from var(--primary) calc(l + 0.12) c h)"
          />
          <stop
            offset="100%"
            stopColor="oklch(from var(--primary) calc(l + 0.02) c h)"
          />
        </linearGradient>
        {/* Left flank — mid-tone. Anchors the composition on the lit
            side of the inflection crease. */}
        <linearGradient id={leftId} x1="0" y1="0" x2="1" y2="1">
          <stop
            offset="0%"
            stopColor="oklch(from var(--primary) calc(l - 0.02) c h)"
          />
          <stop
            offset="100%"
            stopColor="oklch(from var(--primary) calc(l - 0.07) c h)"
          />
        </linearGradient>
        {/* Right flank — shadow face. Deepest of the three, sells the
            sense of a cut volume catching light from the upper-left. */}
        <linearGradient id={rightId} x1="0" y1="0" x2="1" y2="1">
          <stop
            offset="0%"
            stopColor="oklch(from var(--primary) calc(l - 0.06) c h)"
          />
          <stop
            offset="100%"
            stopColor="oklch(from var(--primary) calc(l - 0.12) c h)"
          />
        </linearGradient>
        {glow && (
          <radialGradient id={haloId} cx="50%" cy="52%" r="58%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="55%" stopColor="var(--primary)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      {glow && (
        <circle
          cx="56"
          cy="58"
          r="68"
          fill={`url(#${haloId})`}
          className="vie-mark__halo opacity-0 dark:opacity-100"
          aria-hidden="true"
        />
      )}
      {/* Top face — spans the full top edge down to the inflection vertex */}
      <path
        d="M 10 18 L 102 18 L 56 60 Z"
        fill={`url(#${topId})`}
        className="vie-mark__face vie-mark__face--top"
      />
      {/* Left flank — runs from the top-left corner through the inflection
          vertex to the apex. Thin tall triangle. */}
      <path
        d="M 10 18 L 56 60 L 56 102 Z"
        fill={`url(#${leftId})`}
        className="vie-mark__face vie-mark__face--left"
      />
      {/* Right flank — mirror of the left flank, on the shadow side */}
      <path
        d="M 102 18 L 56 102 L 56 60 Z"
        fill={`url(#${rightId})`}
        className="vie-mark__face vie-mark__face--right"
      />
      {/* Coral vertex — the inflection point where the three planes meet.
          The "moment of understanding." One dot, deliberately placed. */}
      <circle
        cx="56"
        cy="60"
        r="5.5"
        fill="var(--vie-coral)"
        className="vie-mark__vertex"
      />
    </svg>
  );
});

// ─── Full wordmark ───────────────────────────────────────────

interface VieWordmarkProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const WORDMARK_SIZES = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-6xl",
} as const;

/**
 * VIE wordmark — "vie" set in Bricolage Grotesque, the app's display
 * family. Extra-bold lowercase with tight tracking and a compressed
 * leading so the letters read as one confident unit — not three floaty
 * characters. `currentColor` keeps it theme-aware across any surface.
 */
export const VieWordmark = memo(function VieWordmark({
  size = "md",
  className,
}: VieWordmarkProps) {
  return (
    <span
      role="img"
      aria-label="vie"
      className={cn(
        "vie-wordmark font-display font-extrabold leading-[0.9] tracking-[-0.035em] select-none lowercase",
        WORDMARK_SIZES[size],
        className,
      )}
    >
      vie
    </span>
  );
});

// ─── Mark + wordmark lockup ──────────────────────────────────

interface VieLogotypeProps {
  /** Overall size preset. Drives both mark and wordmark together. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Enable the radial halo on the mark. */
  glow?: boolean;
  /** Staggered mount animation on the mark. */
  animated?: boolean;
  className?: string;
}

const LOCKUP_GAP = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
  xl: "gap-4",
} as const;

const LOCKUP_WORDMARK_SIZE: Record<NonNullable<VieLogotypeProps["size"]>, VieWordmarkProps["size"]> = {
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
};

/**
 * Mark + wordmark lockup tuned for optical balance.
 *
 * The wordmark's lowercase x-height sits at roughly the same visual
 * weight as the mark — neither element shrinks next to the other. Use
 * anywhere the full identity should register at a glance: sidebar
 * header, landing marquee, auth hero, share-page signature row.
 */
export const VieLogotype = memo(function VieLogotype({
  size = "md",
  glow = false,
  animated = false,
  className,
}: VieLogotypeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center leading-none",
        LOCKUP_GAP[size],
        className,
      )}
      aria-label="VIE — Video Insight Engine"
    >
      <VieMark size={size} glow={glow} animated={animated} />
      <VieWordmark size={LOCKUP_WORDMARK_SIZE[size]} />
    </span>
  );
});
