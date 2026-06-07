/**
 * Showcase primitives — Dev Only
 *
 * Shared building blocks for the `/dev/design-system` showcase tabs
 * (Interactive, Modes, …). Each demo lives inside a `SectionCard` — a numbered
 * GlassCard with a one-line description and a "What's new" badge — and is wrapped
 * in a `DemoBoundary` so a single broken demo can't crash the whole page.
 *
 * Extracted from InteractiveBlockShowcase so multiple showcase tabs render with
 * an identical look and the same `data-section` / `data-testid` test contract.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('showcase-primitives should not be imported in production');
}

import { memo, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from '@/components/ui/error-boundary';
import { GlassCard } from '@/components/vie';

export interface ShowcaseEntry {
  testId: string;
  name: string;
  description: string;
  whatsNew: string;
  /** A function so we can produce fresh handlers per render without leaking listeners. */
  render: () => ReactNode;
}

interface SectionCardProps {
  index: number;
  name: string;
  description: string;
  whatsNew: string;
  testId: string;
  children: ReactNode;
}

/**
 * Section container — each interactive demo lives inside one of these. The
 * `data-section="showcase"` + per-section `data-testid` attributes let
 * Playwright assert that every component in the new registry rendered.
 */
export const SectionCard = memo(function SectionCard({
  index,
  name,
  description,
  whatsNew,
  testId,
  children,
}: SectionCardProps) {
  return (
    <div data-section="showcase" data-testid={testId}>
      <GlassCard variant="default" className="space-y-4">
        <header className="space-y-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {String(index).padStart(2, '0')}
            </span>
            <h3 className="text-base font-semibold tracking-tight">{name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p
            className="inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground/80"
            data-testid={`${testId}-whats-new`}
          >
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">
              What&apos;s new
            </span>
            <span aria-hidden>·</span>
            <span>{whatsNew}</span>
          </p>
        </header>
        <div>{children}</div>
      </GlassCard>
    </div>
  );
});

function SectionErrorFallback({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <p className="font-semibold">Demo crashed</p>
      <p className="mt-1 text-xs opacity-80">{message}</p>
    </div>
  );
}

export function DemoSuspenseFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-32 items-center justify-center rounded-md border border-dashed border-border/40 bg-muted/10 text-sm text-muted-foreground"
    >
      Loading {label}…
    </div>
  );
}

interface DemoBoundaryProps {
  label: string;
  children: ReactNode;
}

export function DemoBoundary({ label: _label, children }: DemoBoundaryProps) {
  return <ErrorBoundary FallbackComponent={SectionErrorFallback}>{children}</ErrorBoundary>;
}
