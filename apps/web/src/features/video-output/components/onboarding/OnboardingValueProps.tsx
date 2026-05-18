import { BookText, Clock, HelpCircle, Languages, Layers, MessageCircle } from 'lucide-react';

interface ValueChip {
  Icon: typeof BookText;
  label: string;
}

const CHIPS: readonly ValueChip[] = [
  { Icon: BookText, label: 'Summary' },
  { Icon: Clock, label: 'Timestamps' },
  { Icon: Layers, label: 'Flashcards' },
  { Icon: HelpCircle, label: 'Quiz' },
  { Icon: MessageCircle, label: 'Q&A' },
  { Icon: Languages, label: 'Translation' },
];

/**
 * Compact "you'll get" chip row shown on the onboarding GeneratePage.
 * Communicates the surface area of a generated app without screenshots,
 * so it stays accurate as the output evolves.
 */
export function OnboardingValueProps() {
  return (
    <section
      aria-labelledby="onboarding-value-label"
      className="flex flex-col items-center gap-3"
      data-testid="onboarding-value-props"
    >
      <p
        id="onboarding-value-label"
        className="text-[0.6875rem] font-mono uppercase tracking-[0.18em] text-muted-foreground/70"
      >
        <span className="inline-block h-1 w-1 rounded-full bg-primary/60 align-middle me-2" />
        You'll get
      </p>
      <ul role="list" className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {CHIPS.map(({ Icon, label }) => (
          <li key={label}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/25 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground sm:px-3 sm:py-1.5">
              <Icon className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
              {label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
