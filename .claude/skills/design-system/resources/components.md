# Component Patterns

CVA variants, shadcn/ui conventions, and component architecture for vie-web.

<rules>
- ALWAYS check shadcn/ui inventory before creating a new component (duplicate components create maintenance burden)
- ALWAYS use CVA when a component needs 2+ variants (adding variants to raw className is painful to refactor)
- ALWAYS use `cn()` for class merging, never string concatenation (Tailwind class conflicts if violated)
- ALWAYS forward ref and accept `className` prop on new components (breaks composition if omitted)
- ALWAYS compose output blocks from the `components/vie/**` library — check the barrel (`@/components/vie`) before building anything new (inconsistent visual language)
- NEVER inline-style themeable values like `backgroundColor: "#fff"` (breaks dark mode)
- NEVER recreate a component shadcn/ui already provides (inconsistency and wasted effort)
</rules>

---

## shadcn/ui Inventory

Available in `apps/web/src/components/ui/`:

**Form**: `button`, `input`, `textarea`, `checkbox`, `switch`, `select`, `slider`.
**Feedback**: `alert`, `badge`, `skeleton`, `progress`, `status-icon` (custom), `spinner` (custom).
**Overlays**: `dialog`, `sheet`, `dropdown-menu`, `popover`, `tooltip`, `context-menu`.
**Navigation**: `tabs`, `navigation-menu`, `breadcrumb`.
**Layout**: `card`, `separator`, `scroll-area`, `collapsible`, `sidebar` (custom).
**Data**: `table`, `avatar`.
**Notifications**: Sonner (`toast.success()`, `toast.error()`, `toast.promise()`).

---

## CVA Pattern

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const myVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", destructive: "..." },
    size: { default: "h-10 px-4", sm: "h-9 px-3", icon: "h-10 w-10" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

interface Props
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myVariants> {}

const MyComponent = React.forwardRef<HTMLDivElement, Props>(
  ({ className, variant, size, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(myVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
```

Key elements: base classes (always applied), variants object (mutually exclusive), `defaultVariants` (fallback), `VariantProps` (type inference), `cn()` (merge with custom className).

---

## shadcn/ui Conventions

**`data-slot`**: Components use `data-slot="name"` for CSS targeting and `contain: layout style` optimization.

**`asChild`**: Renders component as a different element via Radix Slot. `<Button asChild><Link to="/path">Go</Link></Button>` renders as `<a>`.

**Compound components**: Complex components use sub-components — `Card` > `CardHeader` > `CardTitle`, `Dialog` > `DialogTrigger` + `DialogContent` > `DialogHeader` + `DialogFooter`.

---

## The vie Component Library

Output/block UI composes the props-first, domain-free library in
`apps/web/src/components/vie/**` (there is no `BlockWrapper` — that pattern is
gone). Import from the barrel `@/components/vie`:

| Category      | Directory      | Examples                                              |
| ------------- | -------------- | ----------------------------------------------------- |
| Cards         | `cards/`       | `GlassCard`, `ExpandableCard`, `HeroCard`, `VideoHero` |
| Content       | `content/`     | `TextBlock`, `CodeSnippet`, `QuoteBlock`, `TableView`, `ListItems`, `DefinitionItem` |
| Data display  | `data/`        | `ScoreRing`, `StatPill`, `Badge`, `KeyValue`, `Timer`, `Timestamp`, `VisualEvidence` |
| Interactive   | `interactive/` | Quiz/checklist/canvas interactives                     |
| Media         | `media/`       | Frame/image components                                 |
| Navigation    | `navigation/`  | Tabs, section navigation                               |
| Feedback      | `feedback/`    | Loading, empty, error states                           |
| Effects       | `effects/`     | Visual effect wrappers                                 |
| Canvas        | `canvas/`      | React Flow canvas pieces (floating edges need hidden handles — RF error #008 otherwise) |

Rules for extending the library:

- Components are **props-first and domain-free** — they take plain data props,
  never fetch, and never import feature/domain types.
- New components are registered in `components/vie/index.ts` and picked up by
  the output `component-registry`.
- Output components color with `--vie-accent` ONLY — never primary/cta
  (Accent-Only-In-Outputs, DESIGN.md §6).

### Design Scales

| Element        | Classes                                           |
| -------------- | ------------------------------------------------- |
| Card padding   | `p-5` (20px)                                      |
| Card inner gap | `space-y-3` (12px)                                |
| List item gap  | `space-y-1.5` (6px)                               |
| Header text    | `text-xs font-semibold uppercase tracking-widest` |
| Body text      | `text-sm leading-relaxed`                         |
| Metadata       | `text-xs text-muted-foreground`                   |
| Header icon    | `h-4 w-4 shrink-0`                                |
| Inline icon    | `h-3.5 w-3.5 shrink-0`                            |

### Premium Utility Application

| Scenario                       | Utility                                                   |
| ------------------------------ | --------------------------------------------------------- |
| Lists >3 items                 | `stagger-children` on parent                              |
| Interactive sub-cards          | `hover-lift`                                              |
| Section headers / control bars | `glass-surface`                                           |
| Hero numbers / scores          | `text-gradient-primary`                                   |
| Rating scores                  | `text-gradient-warm`                                      |
| Between list items             | `fade-divider`                                            |
| Callout icons                  | Color matches `accentColor` (not `text-muted-foreground`) |
| Dark mode colored elements     | Appropriate `*-glow` class                                |
| Interactive options            | `hover-scale`                                             |

---

## Status Mapping Pattern

Map status values to visual variants via lookup objects:

```tsx
const STATUS_STYLES = {
  pending: "text-status-pending",
  processing: "text-status-processing",
  completed: "text-status-success",
  failed: "text-status-error",
} as const;
```

---

## Loading States

**Button**: Swap icon to `<Loader2 className="h-4 w-4 mr-2 animate-spin" />` and set `disabled={isLoading}`.

**Skeleton**: Use `<Skeleton className="h-40 w-full rounded-lg" />` for placeholder shapes matching final layout.

---

## Accessibility

Focus ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. Use roving tabindex for keyboard navigation in lists (`tabIndex={i === focusIndex ? 0 : -1}`).

---

## Edge Cases

- **CVA vs plain className**: If a component has only one visual style and will never need variants, plain `cn()` is fine. Reach for CVA at the second variant.
- **Custom shadcn extensions**: Extend shadcn components via `className` prop and `cn()` merge. Do not fork the component file unless modifying internal behavior.
- **Bespoke block containers**: don't hand-roll card/containers in output components — use `GlassCard`/`ExpandableCard` (or another `vie/cards` surface) so hover, radius, and dark-mode effects stay consistent.

---

## Rules Summary

Check shadcn/ui inventory before building anything new — extend via `className` and `cn()`, do not recreate. Use CVA the moment a component needs multiple variants, with `forwardRef`, `className` prop, and `VariantProps` type inference. Output blocks compose the `components/vie/**` library, apply `stagger-children` to lists over 3 items, `hover-lift` on interactive sub-cards, `glass-surface` on control bars, and match callout icon colors to their accent. Use `data-slot` for CSS targeting, `asChild` for element polymorphism, and compound component patterns for complex UI. Notifications use Sonner. Focus rings and roving tabindex are required for keyboard accessibility.
