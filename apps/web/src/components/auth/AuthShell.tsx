import type { ReactNode } from "react";
import { GlassCard } from "@/components/vie/cards/GlassCard";
import { VieMark } from "@/components/brand/VieMark";
import { AuthSidePreview } from "./AuthSidePreview";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  /** Eyebrow label rendered above the title (monospace, uppercase). */
  eyebrow?: string;
  /** Headline displayed at the top of the form column. */
  title: string;
  /** Short supporting copy rendered in the muted caption tone. */
  subtitle?: string;
  /** The form contents (already composed in the parent page). */
  children: ReactNode;
  /** Footer slot — typically the "switch to sign in / sign up" link row. */
  footer?: ReactNode;
  /** Optional class for tests or one-off overrides on the outer surface. */
  className?: string;
}

/**
 * Shared chrome for the Login/Register pages.
 *
 * Borrows the ambient treatment used on GeneratePage: a soft primary orb drifts
 * behind the form while the VieMark floats above it with a quiet radial glow.
 * The card itself is an elevated GlassCard so the first authenticated moment
 * reads as part of the product — not a generic shadcn form.
 *
 * Light + dark are both first-class: orb alpha is low, card is opaque, and
 * animations gate on `prefers-reduced-motion` via the shared utility classes.
 */
export function AuthShell({
  eyebrow = "Video Insight Engine",
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthShellProps) {
  return (
    <div
      className={cn(
        "surface-ambient relative min-h-dvh overflow-hidden",
        className,
      )}
    >
      {/* Ambient accent orb — primary halo bottom-right. One hero moment,
          quieter than before so the split layout carries the composition. */}
      <div
        aria-hidden="true"
        className="vie-accent-orb"
        style={{
          ["--orb-size" as string]: "520px",
          bottom: "-160px",
          right: "-140px",
          background:
            "radial-gradient(closest-side, oklch(from var(--primary) l c h / 0.42), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="vie-accent-orb"
        style={{
          ["--orb-size" as string]: "420px",
          top: "-140px",
          left: "-120px",
          background:
            "radial-gradient(closest-side, oklch(from var(--vie-coral) l c h / 0.22), transparent 70%)",
        }}
      />

      {/* Split layout: editorial preview left, form right.
          Under lg the preview drops away — auth stays a single-column focus. */}
      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* Preview column — hidden on narrow viewports to keep mobile focused. */}
        <aside
          aria-hidden="true"
          className="hidden lg:flex items-center justify-center px-10 xl:px-14 py-12 border-e border-border/30"
        >
          <AuthSidePreview />
        </aside>

        {/* Form column — the real task. */}
        <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md stack-lg">
            <header className="stack-sm">
              <div className="flex items-center gap-2.5">
                <VieMark size="lg" glow animated />
                <p className="type-eyebrow text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-muted-foreground/80">
                  {eyebrow}
                </p>
              </div>
              <h1 className="type-page-title text-balance">{title}</h1>
              {subtitle && (
                <p className="type-caption text-pretty max-w-sm">{subtitle}</p>
              )}
            </header>

            <GlassCard variant="elevated" className="p-6 sm:p-7">
              {children}
            </GlassCard>

            {footer && (
              <p className="text-sm text-muted-foreground">{footer}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
