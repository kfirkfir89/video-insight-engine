import type { CSSProperties, ReactNode } from "react";
import { LogIn, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/vie/cards/GlassCard";
import { VieMark } from "@/components/brand/VieMark";
import { AuthSidePreview } from "./AuthSidePreview";
import { cn } from "@/lib/utils";

type AuthVariant = "signin" | "signup";

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
  /**
   * Chromatic + textual variant. Drives:
   *   - --vie-accent (primary for signin, coral for signup)
   *   - eyebrow copy + icon (LogIn vs Sparkles)
   *   - background blob lead (primary halo vs coral warmth)
   * Defaults to "signin".
   */
  variant?: AuthVariant;
}

interface VariantTokens {
  eyebrow: string;
  Icon: typeof LogIn;
  accent: string;
  /** Inline gradient for the ambient page background. */
  surfaceBg: string;
  /** Hue identifier on the wrapper for any downstream CSS hooks. */
  dataVariant: AuthVariant;
}

const VARIANT_TOKENS: Record<AuthVariant, VariantTokens> = {
  signin: {
    eyebrow: "Welcome back · Sign in",
    Icon: LogIn,
    accent: "var(--primary)",
    // The existing dual-blob auth gradient — primary halo leads, coral supports.
    surfaceBg:
      "radial-gradient(ellipse 60rem 40rem at 15% -10%, oklch(from var(--primary) l c h / 0.08), transparent 55%), radial-gradient(ellipse 50rem 35rem at 110% 110%, oklch(from var(--vie-coral) l c h / 0.06), transparent 55%)",
    dataVariant: "signin",
  },
  signup: {
    eyebrow: "Get started · Create your account",
    Icon: Sparkles,
    accent: "var(--vie-coral)",
    // Same composition as auth gradient, stops swapped — coral leads, primary supports.
    surfaceBg:
      "radial-gradient(ellipse 60rem 40rem at 15% -10%, oklch(from var(--vie-coral) l c h / 0.10), transparent 55%), radial-gradient(ellipse 50rem 35rem at 110% 110%, oklch(from var(--primary) l c h / 0.06), transparent 55%)",
    dataVariant: "signup",
  },
};

/**
 * Shared chrome for the Login/Register pages.
 *
 * Borrows the ambient treatment used on GeneratePage: a soft accent orb drifts
 * behind the form while the VieMark floats above it with a quiet radial glow.
 * The card itself is an elevated GlassCard so the first authenticated moment
 * reads as part of the product — not a generic shadcn form.
 *
 * Variant adds three small differentiation signals so a user landing on the
 * wrong page notices before they start typing:
 *   1. --vie-accent (primary for signin, coral for signup)
 *   2. Eyebrow label + lucide icon (LogIn vs Sparkles)
 *   3. Background blob lead (primary halo vs coral warmth)
 *
 * Light + dark are both first-class: orb alpha is low, card is opaque, and
 * animations gate on `prefers-reduced-motion` via the shared utility classes.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  className,
  variant = "signin",
}: AuthShellProps) {
  const tokens = VARIANT_TOKENS[variant];
  const VariantIcon = tokens.Icon;
  // Default eyebrow now leads with the variant label; callers can override.
  const eyebrowText = eyebrow ?? tokens.eyebrow;

  // Per-variant chromatic context: scopes --vie-accent and overrides
  // --gradient-empty-glow (consumed by .icon-glow::before) so the mark glow
  // picks up the variant accent without forking the utility.
  const accentStyle: CSSProperties = {
    ["--vie-accent" as string]: tokens.accent,
    ["--gradient-empty-glow" as string]: `radial-gradient(circle at center, oklch(from ${tokens.accent} l c h / 0.18), transparent 70%)`,
  };

  return (
    <div
      data-variant={tokens.dataVariant}
      style={accentStyle}
      className={cn(
        "relative min-h-dvh overflow-hidden bg-background",
        className,
      )}
    >
      {/* Variant-specific ambient gradient. Lives on a dedicated layer so the
          --vie-accent styling above doesn't pollute the inline background. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: tokens.surfaceBg }}
      />

      {/* Ambient accent orbs — bottom-right halo leads with the variant accent,
          top-left echoes the supporting hue so neither page reads monochrome. */}
      <div
        aria-hidden="true"
        className="vie-accent-orb"
        style={{
          ["--orb-size" as string]: "520px",
          bottom: "-160px",
          right: "-140px",
          background: `radial-gradient(closest-side, oklch(from ${tokens.accent} l c h / 0.42), transparent 70%)`,
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
            variant === "signup"
              ? "radial-gradient(closest-side, oklch(from var(--primary) l c h / 0.22), transparent 70%)"
              : "radial-gradient(closest-side, oklch(from var(--vie-coral) l c h / 0.22), transparent 70%)",
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
                <p className="type-eyebrow text-[color:var(--vie-accent)]">
                  {eyebrowText}
                </p>
              </div>
              <h1 className="type-page-title text-balance">{title}</h1>
              {subtitle && (
                <p className="type-caption text-pretty max-w-sm">{subtitle}</p>
              )}
              {/* Variant mark — a small accented icon directly above the form.
                  LogIn for return; Sparkles for new account. The icon-glow
                  utility picks up our --gradient-empty-glow override above so
                  the halo tints to the variant accent. */}
              <div
                className="icon-glow mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full border"
                style={{
                  borderColor:
                    "oklch(from var(--vie-accent) l c h / 0.25)",
                  backgroundColor:
                    "oklch(from var(--vie-accent) l c h / 0.08)",
                }}
                aria-hidden="true"
              >
                <VariantIcon
                  className="h-5 w-5 text-[color:var(--vie-accent)]"
                  strokeWidth={2}
                />
              </div>
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
