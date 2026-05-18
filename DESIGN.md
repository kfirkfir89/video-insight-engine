---
name: Video Insight Engine
description: YouTube video to interactive knowledge tool — depth sized to the source, bullshit cut, nothing lost.
colors:
  electric-indigo: "oklch(58% 0.24 292)"
  electric-indigo-dark: "oklch(68% 0.26 292)"
  berry-plum: "oklch(55% 0.17 340)"
  berry-plum-dark: "oklch(66% 0.18 340)"
  tinted-snow: "oklch(98.5% 0.006 285)"
  pearl: "oklch(99% 0.004 285)"
  whisper: "oklch(95% 0.008 285)"
  mist-border: "oklch(89% 0.012 285)"
  indigo-ink: "oklch(16% 0.03 280)"
  canvas-indigo: "oklch(96% 0.008 285)"
  midnight-indigo: "oklch(12% 0.03 280)"
  twilight: "oklch(16% 0.025 280)"
  smoke: "oklch(20% 0.02 280)"
  slate-mist: "oklch(25% 0.02 280)"
  frost: "oklch(94% 0.008 285)"
  abyss-canvas: "oklch(8.5% 0.02 280)"
  vie-coral: "oklch(72% 0.18 25)"
  vie-plum: "oklch(52% 0.2 310)"
  vie-mint: "oklch(78% 0.14 165)"
  vie-sky: "oklch(72% 0.14 230)"
  vie-honey: "oklch(82% 0.15 80)"
  vie-rose: "oklch(68% 0.16 350)"
  vie-forest: "oklch(55% 0.12 145)"
  vie-peach: "oklch(82% 0.1 55)"
  destructive: "oklch(55% 0.22 18)"
  success: "oklch(55% 0.16 155)"
  warning: "oklch(78% 0.15 80)"
  info: "oklch(62% 0.16 255)"
  code-bg: "oklch(12% 0 0)"
  code-text: "oklch(90% 0 0)"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5.5vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Cascadia Code, Fira Code, monospace"
    fontSize: "0.85em"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  full: "9999px"
spacing:
  3xs: "0.125rem"
  2xs: "0.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
  3xl: "4rem"
  4xl: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.berry-plum}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "oklch(55% 0.17 340 / 0.9)"
    textColor: "#ffffff"
  button-brand:
    backgroundColor: "{colors.electric-indigo}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.25rem"
  button-brand-hover:
    backgroundColor: "oklch(58% 0.24 292 / 0.9)"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.whisper}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.25rem"
  button-outline:
    backgroundColor: "{colors.tinted-snow}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.25rem"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.25rem"
  card-default:
    backgroundColor: "{colors.pearl}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  card-elevated:
    backgroundColor: "{colors.pearl}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  card-interactive:
    backgroundColor: "{colors.pearl}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  card-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  badge-default:
    backgroundColor: "{colors.electric-indigo}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-secondary:
    backgroundColor: "{colors.whisper}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
---

# Design System: Video Insight Engine

## 1. Overview

**Creative North Star: "The Living Distillate"**

VIE turns a video — twelve minutes, ninety minutes, three hours — into a knowledge tool sized to the source. A short tutorial becomes a tight set of steps. A three-hour lecture becomes a full study system: chapter breakdowns, flashcards, an exam, scenarios. The brand mark is a faceted nabla — a downward triangle distilling raw input into a single coral vertex of insight. The interface honors that promise: it removes filler, it presents the result with confidence, and it makes the result *alive* — quizzes you can answer, flashcards you can flip, timelines you can scrub, comparisons you can rank. The distillate is the output; "living" is how it acts. Nothing in the UI hedges, nothing is for show, and nothing stalls — the user came to extract value from a video, and the interface gets out of the way.

The aesthetic is **dark-primary, violet-anchored, glass-aware**. Cards are opaque workhorses; glass-blur is reserved for floating chrome (popovers, modals, hero framings) so the layering signal stays meaningful. Color is mostly tinted neutral with a single high-chroma identity violet (`Electric Indigo`, hue 292) for brand moments and a warmer plum (`Berry Plum`, hue 340) for actions. The accent palette — eight named hues, one per content domain — keeps each video's output feeling specific without ever turning the page rainbow. OKLCH is the canonical color space; hex appears nowhere in source.

This system explicitly rejects: Bootstrap/Material enterprise dashboards, generic SaaS gray, "ChatGPT-wrapper" purple gradients with neon highlights, Notion-clone minimalism that feels under-confident, and academic/stuffy library-product aesthetics. The references are **Linear** (density without sterility), **Raycast** (premium dark mode and snappy feel), and **Arc browser** (playful confidence in bold color choices).

**Key Characteristics:**

- **Depth-aware output.** The interface scales to the source — a tutorial gets a tight tool, a lecture gets a full study system (chapters, flashcards, exam, scenarios). The chrome stays the same; the content swells or contracts to match.
- **Dark-first premium.** Glass, glow, and OKLCH-tinted shadows belong to the dark theme; the light theme is a courtesy that still looks good but isn't where the identity lives.
- **Two violets, two jobs.** `Electric Indigo` (hue 292) carries identity; `Berry Plum` (hue 340) carries action. They're warmer/cooler neighbors in the same family — never used interchangeably.
- **Domain accents earn their color.** A recipe is coral, code is mint, a study guide is plum-violet. The palette is a wayfinding tool, not decoration.
- **Glass is rare.** It marks ephemerality — popovers, overlays, modals. Default cards are opaque so the rarity reads.
- **Direct copy, no hedge.** "Generate", "Memorize", "Open". Not "Maybe try generating", not "Let's get started!", not "Tap below to begin your journey."
- **Density per Linear.** `h-9` controls, `text-base = 0.9375rem`, tight 1.6 line-height. Information-dense; never sparse-by-default.

## 2. Colors

The palette is restrained at rest and committed where it counts: tinted neutrals carry 80%+ of any surface; the identity violet appears on ≤10%; one domain accent (per video) rides alongside.

### Primary

- **Electric Indigo** (`oklch(58% 0.24 292)` light / `oklch(68% 0.26 292)` dark): The identity color. Brand mark, focus rings, primary navigation active state, brand-variant buttons (sidebar "New summary", VieMark CTAs, hero brand actions). Hue 292 is the unmissable violet — high chroma is the point, not a glitch. In dark mode it brightens by ten percentage points to stay luminous on the deep canvas.
- **Berry Plum** (`oklch(55% 0.17 340)` light / `oklch(66% 0.18 340)` dark): The CTA color. The default Button variant. Hue 340 sits warmer than Electric Indigo but stays inside the violet family — separates *what we are* (identity) from *what we do* (action) without breaking the brand. Combined with Electric Indigo as the `cta-magnetic` gradient on the single hero submit per surface.

### Domain Accents (the VIE palette)

Eight named hues. Each video's output binds to one as its `--vie-accent`. Components reference `var(--vie-accent)` and inherit per surface — no hardcoded domain colors in components.

**Primary tier (use freely across product UI):**

- **VIE Coral** (`oklch(72% 0.18 25)`): Warm category — recipes, fitness, hands-on projects.
- **VIE Plum** (`oklch(52% 0.2 310)`): Cool category — study guides, language learning, abstract concepts.
- **VIE Mint** (`oklch(78% 0.14 165)`): Code, tech tutorials, technical reference.

**Rare tier (semantic only — one of these per screen at most):**

- **VIE Sky** (`oklch(72% 0.14 230)`): Travel itineraries, info domain.
- **VIE Honey** (`oklch(82% 0.15 80)`): Verdict/review, warning surfaces.
- **VIE Rose** (`oklch(68% 0.16 350)`): Music analysis, highlights.
- **VIE Forest** (`oklch(55% 0.12 145)`): Project/maker content, success states.
- **VIE Peach** (`oklch(82% 0.1 55)`): Soft secondary accent in narrative content.

### Neutral

Light theme — tinted toward indigo (hue 285), low chroma:

- **Tinted Snow** (`oklch(98.5% 0.006 285)`): Page background. Not pure white; the chroma keeps it on-brand.
- **Pearl** (`oklch(99% 0.004 285)`): Card surface. One step brighter than the page so cards lift, even at rest.
- **Canvas Indigo** (`oklch(96% 0.008 285)`): The recessed canvas behind floating panels — the desk on which the chrome sits.
- **Whisper** (`oklch(95% 0.008 285)`): Muted surface — secondary buttons, ghost-button hover backgrounds.
- **Mist** (`oklch(89% 0.012 285)`): Default border. Visible only when you look for it.
- **Indigo Ink** (`oklch(16% 0.03 280)`): Body text. Tinted dark, not pure black.

Dark theme — deep indigo (hue 280), tuned for luminous chrome on deep canvas:

- **Midnight Indigo** (`oklch(12% 0.03 280)`): Page background. Deep enough that glow reads; tinted enough that the brand carries.
- **Abyss Canvas** (`oklch(8.5% 0.02 280)`): The recessed canvas one step deeper than the page.
- **Twilight** (`oklch(16% 0.025 280)`): Card surface — lifted from the page, never flat-on-flat.
- **Smoke** (`oklch(20% 0.02 280)`): Muted surface, input background, secondary panels.
- **Slate Mist** (`oklch(25% 0.02 280)`): Borders.
- **Frost** (`oklch(94% 0.008 285)`): Body text. Tinted bright, not pure white.

### Semantic

- **Destructive** (`oklch(55% 0.22 18)`): Coral-red, hue 18. Delete confirmations, unrecoverable actions. Never decorative.
- **Success** (`oklch(55% 0.16 155)`): Forest green. Completion states, success toasts, validation pass.
- **Warning** (`oklch(78% 0.15 80)`): Honey. Caution states, soft warning surfaces.
- **Info** (`oklch(62% 0.16 255)`): Sky blue. Tips, neutral notifications.

Each of these has a `-foreground` (text on the color) and a `-soft` (background tint for callouts) companion in the token system.

### Named Rules

**The Two-Violet Rule.** Electric Indigo is identity. Berry Plum is action. They sit in the same hue family (292 vs 340) so they harmonize, but they have different jobs. A primary-action button is never violet. A brand mark is never plum. If you need a third "feature" color, pick a VIE accent — don't invent a third indigo.

**The One Domain, One Accent Rule.** Each video output binds to one `--vie-accent` value. A recipe page may use VIE Coral throughout but cannot ALSO use VIE Mint. The accent palette is wayfinding, not decoration; mixing accents on a single output destroys the signal.

**The Four-Accent Ceiling.** At most four distinct accent colors visible on any single screen, counting brand, CTA, domain, and semantic together. Cross this and the page reads as a paint chip catalog.

**The Tinted-Neutral Rule.** No pure `#000`, no pure `#fff`. Every neutral carries chroma 0.005–0.03 toward hue 280–285. Pure neutrals look generic; the slight tint is what makes the dark theme feel premium and the light theme feel branded.

## 3. Typography

**Display Font:** Bricolage Grotesque (with Hanken Grotesk fallback). Used for H1, H2, page titles, marketing headlines. Organic curves with grotesque structure — confident without being a typewriter pastiche.

**Body Font:** Hanken Grotesk (with `system-ui, -apple-system, "Segoe UI"` fallbacks). Used for H3, H4, body, all UI labels and controls. Pairs with Bricolage's curves while staying outside the AI-trained-default reflex set (Inter / DM / Plus Jakarta — explicitly avoided so the product doesn't read as "the same as every other AI-tool landing page").

**Mono Font:** JetBrains Mono (with `ui-monospace, "Cascadia Code", "Fira Code"` fallbacks). Used for code blocks, kbd keys, tabular numbers, timestamps. Calt is disabled in code surfaces.

**Character:** Bricolage carries the wow — generous curves on the display sizes give VIE a personality that Inter would flatten. Hanken keeps the UI dense and unfussy. Together they read like a publication that ships software, not a SaaS landing in a Google-Sans suit.

### Hierarchy

- **Display** (Bricolage, weight 800, `clamp(2.5rem, 5.5vw, 3.75rem)`, `leading-heading` 1.15, `tracking-display` -0.025em): Marketing hero, landing page singular headline. One per surface. Use `.type-hero-xl` for the landing's signature drama (clamp goes to 5.5rem).
- **Headline** (Bricolage, weight 700, `1.875rem`, line 1.15, tracking -0.025em): Page titles inside the app. The H1 of a video detail page, "Memorized", "Settings".
- **Title** (Hanken, weight 600, `1.25rem` / `1.5rem`, line 1.15 / 1.35, tracking -0.01em): Section headings, card titles, tab labels.
- **Body** (Hanken, weight 400, `0.9375rem`, line 1.6, tracking 0): UI body, content text, descriptions. The default. Prose surfaces use `text-md = 1rem` and cap at `65ch` line length.
- **Label** (Hanken, weight 600, `0.6875rem`, line 1, tracking 0.08em, **uppercase**): Eyebrows, micro-headers, badge text, keyboard hints. Use `.type-eyebrow` utility.
- **Mono** (JetBrains, weight 400, 0.85em relative): Code, kbd, timestamps, tabular figures.

### Named Rules

**The 1.25-Step Rule.** The scale ratio is 1.25 (major third) across `0.6875 / 0.8125 / 0.875 / 0.9375 / 1 / 1.125 / 1.25 / 1.5 / 1.875 / 2.25rem`. Don't insert a custom size between two steps "to fit"; pick the nearest step and adjust weight or spacing if you need contrast.

**The No-Inter Rule.** Don't substitute Inter, DM Sans, or Plus Jakarta Sans for Hanken. Those families are the trained-default reflex for AI-tool products; using them in VIE would collapse the typographic identity to the same look every other LLM wrapper ships with.

**The Fixed-Rem Rule.** Body and UI text are fixed rem, not fluid. Only `--text-5xl/6xl/7xl` use `clamp()` because they're marketing-display sizes. A button label that shrinks on a narrow viewport is worse, not better.

**The Tabular-Figure Rule.** Numbers in tables, scores, durations, and counters use `font-variant-numeric: tabular-nums` (the `.tabular-nums` class or `[data-tabular]` attribute). Proportional digits in a table is a tell that nobody tuned it.

## 4. Elevation

**Layered glass-and-shadow.** Three depth tiers: the recessed canvas (page background), the opaque card (the workhorse), and the glass surface (ephemeral chrome). Shadows are OKLCH-tinted in light mode (subtle, hue 285) and pure-black-on-deep in dark mode (deeper, more contrast). Glass blur is `20px` desktop, halved to `10px` on mobile (≤768px) to keep composite cost reasonable on low-end GPUs.

### Shadow Vocabulary

Light theme — every shadow tinted toward `oklch(20% 0.02 285)`:

- **shadow-xs** (`0 1px 2px oklch(20% 0.02 285 / 0.06)`): Hairline lift. Inputs at rest, ghost buttons on hover, badges.
- **shadow-sm** (`0 2px 4px / 0 1px 2px`): Default button shadow, default card shadow.
- **shadow-md** (`0 4px 8px -2px / 0 2px 4px -1px`): Hover lift on cards and CTAs.
- **shadow-lg** (`0 12px 24px -6px / 0 4px 8px -2px`): Popovers, dropdowns, dialog content.
- **shadow-xl** (`0 24px 48px -12px`): Hero floating panels, video hero.
- **shadow-popover** (`0 8px 24px -6px / 0 2px 6px -1px`): Reserved name for floating overlay UI (popover, dropdown-menu).

Dark theme — same vocabulary, pure black for contrast, deeper alpha (0.3–0.55).

### Glass Tokens

- **`--glass-bg`** (`oklch(from var(--card) l c h / 0.7)` light, `0.6` dark): Translucent surface for accent cards, hero overlays.
- **`--glass-blur`** (`20px` desktop, `10px` mobile): Backdrop-filter intensity.
- **`--glass-border`** (`oklch(... / 0.3)`): Quiet edge on glass surfaces.
- **`--glass-shadow-elevated`**: Combines an inset 1px white-on-top highlight with a 12px ambient drop shadow — the "lifted from below, lit from above" composite.

### Named Rules

**The Glass-Is-Rare Rule.** Glass-blur is for floating chrome only — popovers, dropdown menus, dialog overlay tinting, hero framings. Default cards are **opaque** (`bg-card`). When every surface is translucent, depth collapses; rarity is what makes glass read as elevation.

**The Inset-Highlight Rule.** Elevated surfaces in dark mode use an inset `1px` `oklch(100% 0 0 / 0.06)` top highlight — a 1px sliver of light catching the top edge — paired with a stronger drop shadow. Light hits the top of the card; shadow falls underneath. Two halves of the same lighting story.

**The OKLCH-Tinted-Shadow Rule.** In light mode, shadows use `oklch(20% 0.02 285 / α)` not `rgba(0,0,0,α)`. The slight indigo chroma keeps shadows on-brand and softer than pure black would land. Dark mode reverts to pure-black-on-deep because tinted shadows on a dark canvas read as muddy.

## 5. Components

Every interactive surface implements default / hover / focus-visible / active / disabled. Focus rings are global (`:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`) with per-component overrides (`[data-slot="button"]` uses a 3px ring/border treatment). Components declare `data-slot` and, where variant-driven, `data-variant` and `data-size` attributes for CSS targeting.

### Buttons

The system has two parallel button identities: the **default** Berry Plum CTA (the workhorse) and the **brand** Electric Indigo variant (identity moments only).

- **Shape:** Rounded medium (`rounded-md` = `0.5rem`), `h-9` (2.25rem) default, `h-8` sm, `h-10` lg. `icon` sizes are square (`size-9`, `size-8`, `size-10`). `bare` is an unstyled inline variant for text-in-prose buttons.
- **Default (Berry Plum CTA, `bg-cta`):** The primary action — Generate, Save, Continue. White text, `shadow-sm` at rest, hover lifts to `bg-cta/90`. This is the action button.
- **Brand (Electric Indigo, `bg-primary`):** Reserved for identity moments — VieMark CTAs, the sidebar "New summary", landing-page brand actions. Same shape, different chroma. Use sparingly.
- **Outline:** Border-only, transparent background in light / `bg-input/30` in dark. Used for secondary or "Cancel" actions next to a primary.
- **Secondary:** `bg-secondary` (Whisper) muted neutral. Used in dialog footers, tertiary actions.
- **Ghost:** No background until hover (then `bg-accent`). Used for icon-only header buttons, table-row actions.
- **Destructive:** Coral-red `bg-destructive`. Always pairs with a confirmation step before firing.
- **Link:** Underlined primary-color text, no background. Used inside prose only.
- **Focus-visible:** 3px ring at `--ring/50` opacity inset to the border. Replaces the global outline for buttons.
- **Disabled:** Opacity 0.6 + `cursor: not-allowed` + `pointer-events: none`. Opacity alone isn't enough; the cursor makes the state legible.

### The Magnetic CTA (signature)

The `.cta-magnetic` utility is the system's signature button — a linear `135deg` gradient from Berry Plum (`--cta`, hue 340) into Electric Indigo (`--primary`, hue 292). It's the **only** sanctioned use of a gradient in the entire system, and it's reserved for the **single** hero submit per surface: the landing "Summarize", the sidebar "New summary", the VideoHero primary action. Hover lifts the button `1px` and deepens the inset white highlight to `0.16` alpha. Any other button using a gradient is wrong.

### Chips / Badges

- **Shape:** Pill (`rounded-full`), `px-2 py-0.5`, `text-xs`, weight 500, `gap-1` for icon-text spacing.
- **Default:** Electric Indigo background, white text. Used for counters, "New", active state.
- **Secondary:** Whisper background, Indigo Ink text. Used for tags, categories, metadata.
- **Outline:** Border-only, transparent. Used for tertiary metadata.
- **Destructive:** Coral-red, white text. Used for error counts, danger flags.
- **State:** Hover variant only on `<a>` children (`[a&]:hover:`); plain badges don't react to hover (they aren't actionable).

### Cards / Containers

The system has two card primitives: the **base Card** (shadcn) and the **GlassCard** (a six-variant CVA for the VIE layer).

**Base Card (`<Card>`):**

- **Corner Style:** `rounded-xl` (0.75rem).
- **Background:** `bg-card` (Pearl light / Twilight dark).
- **Shadow Strategy:** `shadow-sm` at rest, `shadow-md` on hover, `transition-shadow 200ms`. Position never animates.
- **Border:** 1px `border-border` (Mist light / Slate Mist dark).
- **Internal Padding:** `py-6 px-6` via CardHeader/CardContent/CardFooter slots.

**GlassCard (six variants for VIE-layer surfaces):**

- **default:** Opaque `bg-card` with `--glass-shadow`. The workhorse.
- **elevated:** Opaque + `--glass-shadow-elevated` (inset top highlight + deeper drop). For raised attention.
- **outlined:** `bg-transparent` border-only. Lightweight grouping.
- **interactive:** Opaque + hover `-translate-y-0.5` + `shadow-lg`. Clickable surfaces.
- **accent:** **Only** glass variant — `bg-[var(--glass-bg)]` + `backdrop-blur-[20px]` + accent-tinted border. Reserved for ephemeral framings (hero overlays, modal accents).
- **subtle:** `bg-muted/20`, transparent border. Background grouping inside a parent card.

All six use `rounded-2xl` (1rem) — the unified radius for the VIE-card system. The base shadcn Card uses `rounded-xl` (0.75rem); GlassCard uses `rounded-2xl` (1rem) — one tier softer.

### Inputs / Fields

- **Style:** 1px `border-input` (Mist), transparent background light / `bg-input/30` dark, `rounded-md` (0.5rem), `h-9`, `px-3 py-1`.
- **Typography:** `text-base = 0.9375rem` on mobile, `text-sm` on `md+` (preserves iOS zoom prevention).
- **Shadow at rest:** `shadow-xs` — a hairline lift to signal "this is a field, not just a div with a border."
- **Focus-visible:** `border-ring` + `ring-ring/50 ring-[3px]` (3px halo). Same focus treatment as buttons.
- **Aria-invalid:** Border shifts to `border-destructive`, ring colors to `ring-destructive/20`. Don't rely on color alone — pair with field-level help text.
- **Disabled:** Opacity 0.5 + `cursor-not-allowed` + `pointer-events-none`.
- **Placeholder:** `placeholder:text-muted-foreground`. Never use placeholder as a label substitute.

### Navigation

The app chrome is built from **VieMenu primitives** (custom menu vocabulary, not a Radix wrapper) and a **header + sidebar** layout pattern.

- **AppHeader:** `h-(--app-header-height)` = 3.25rem. `bg-background/80` + `backdrop-blur-[12px]` — a quiet glass surface. Has a 1px gradient bottom rule (`--rule-domain` — primary→transparent fade) so the header reads as on-brand without a hard line.
- **Sidebar:** Toggleable via Cmd/Ctrl+B (and click). When closed, the VieLogotype shifts into the header. When open, the sidebar shows folder tree + recent videos. Always uses `border-border/40` for soft edges, never `border-border` at full opacity.
- **MobileBottomNav:** Fixed bottom on `<md`. Active route uses a 2px top rule with `--rule-active` (full-strength primary fade). Inactive routes have no decoration — the active rule is the only signal.
- **Default state:** Ghost button, muted-foreground icon + label.
- **Hover state:** `bg-accent` tint, foreground color shifts to default.
- **Active state:** `bg-primary/8` background, foreground violet, the `--rule-active` top accent.
- **Focus-visible:** 3px ring matches button/input treatment.

### Brand Mark (signature component)

The **VieMark** is a three-faceted nabla (downward triangle) — a faceted gem distilling raw video into a coral vertex of insight. Three planes split the silhouette from a central inflection point: top face catches light (lightest violet step), left flank mid-tone, right flank drops into shadow. The coral vertex sits at the inflection — the singular non-violet element, the "moment of understanding." Sizes: `sm` (h-6), `md` (h-7), `lg` (h-9), `xl` (h-14, hero only). The `animated` variant staggers face entrances and pops the vertex in last; the sequence echoes the product (wide input distilling to a single insight). Always respects `prefers-reduced-motion`.

### Dialogs / Popovers / Tooltips

- **Dialog overlay:** Fixed full-viewport `bg-[var(--overlay-bg)]` = `oklch(10% 0.01 280 / 0.85)` — a near-opaque indigo tint that lets a hint of the page show through.
- **Dialog content:** Centered, `max-w-lg`, `rounded-lg` (0.5rem), `border` + `shadow-lg`, `p-6`. Open animation: `fade-in-0 zoom-in-95`, 200ms.
- **Popover:** `shadow-popover` (the named token), `rounded-md`, `border-border`. Often paired with `.accent-rule` for a 2px chromatic top-edge — declares "this surface belongs to VIE."
- **Tooltip:** Compact (`text-xs`), `bg-popover`, `shadow-md`, 200ms fade. Used for icon-button labels and metadata reveals.

### Rule Gradients (signature decoration)

Three named horizontal gradients carry semantic meaning, never style:

- **`--rule-identity`**: Primary → Coral blend at low alpha. Used on popover/modal top edges. Declares "this surface belongs to VIE." Most elaborate; rarest. The `.accent-rule::before` utility renders this 2px line.
- **`--rule-active`**: Single-primary fade at full strength. Used on the active MobileBottomNav route. Declares "this is the current route."
- **`--rule-domain`**: Single-primary fade at 0.4 opacity. Used as a quiet 1px underline under app chrome (AppHeader, domain section dividers). Declares "this is our territory," quietly.

**Components must reference the token whose *signal* matches their purpose, not the one whose color happens to look right.**

## 6. Do's and Don'ts

### Do:

- **Do** use Electric Indigo for identity moments only — VieMark, brand-variant buttons, focus rings, primary navigation active state. ≤10% of any screen.
- **Do** use Berry Plum as the default CTA color. The workhorse `<Button>` (default variant) is plum, not violet.
- **Do** reach for the `.cta-magnetic` plum-to-violet gradient **only** for the single hero submit per surface (one per landing, one per generate page).
- **Do** bind each video output to one `--vie-accent` and let components read it via `var(--vie-accent)`. Domain accent is wayfinding, not decoration.
- **Do** keep glass-blur for ephemeral chrome (popovers, modal overlays, hero framings). Default cards are opaque.
- **Do** use OKLCH-tinted shadows in light mode (`oklch(20% 0.02 285 / α)`) and pure-black shadows in dark mode (deeper alpha).
- **Do** pair the inset 1px top highlight with the drop shadow on elevated dark-mode surfaces — light hits top, shadow falls below.
- **Do** ship every interactive component with default, hover, focus-visible, active, disabled, and (where relevant) loading and error states. Half-states ship bugs.
- **Do** use skeleton loaders that mirror the final layout, not center-screen spinners. The user is in flow; signal "we're building" not "wait."
- **Do** keep button labels imperative and short — "Generate", "Memorize", "Open Video". Two words max for primary actions.
- **Do** apply `tabular-nums` on every number in a table, score, duration, or counter.
- **Do** cap prose at 65–75ch via `--width-prose`. Dense data and compact UI can run wider.
- **Do** wrap any decorative animation in `prefers-reduced-motion: reduce` — the universal override is in `index.css`, but per-component opt-outs are still required for component-level animations.
- **Do** use `ease-out-quint` (`cubic-bezier(0.22, 1, 0.36, 1)`) or `ease-out-expo` for motion. No bounce, no elastic — those read as AI-generated.
- **Do** use semantic typography utilities (`.type-hero`, `.type-page-title`, `.type-eyebrow`, `.type-caption`) instead of stacking individual `text-*` + `font-*` + `tracking-*` utilities. They encode size + weight + family + leading + tracking as one unit.

### Don't:

- **Don't** use generic AI-slop purple gradients (the ChatGPT-wrapper aesthetic — full-bleed violet→pink with neon highlights). PRODUCT.md names this directly as an anti-reference. The single sanctioned gradient is `.cta-magnetic`, and it's restrained.
- **Don't** ship Bootstrap/Material-style enterprise dashboards. Card-icon-heading-text grids repeated endlessly are forbidden by name.
- **Don't** use enterprise gray (`oklch(*% 0 *)` pure-neutral). Every neutral tints toward hue 280–285 at chroma 0.005–0.03. Pure neutrals look generic.
- **Don't** ship Notion-clone minimalism. VIE is richer and more alive — interactivity, glow, OKLCH precision. Under-confident negative space is wrong.
- **Don't** reach for academic/library-product styling. Serif Times-y treatments are forbidden by the anti-reference list.
- **Don't** substitute Inter, DM Sans, or Plus Jakarta Sans for Hanken Grotesk. Those are the AI-tool reflex fonts; using them collapses VIE's typographic identity.
- **Don't** use side-stripe borders (`border-left` greater than 1px as a colored accent on cards, callouts, list items). Rewrite with full borders, background tints, leading numbers, or nothing.
- **Don't** use gradient text (`background-clip: text` + gradient). Use a single solid color; emphasize with weight or size.
- **Don't** mix accent colors within a single video output. One domain, one accent; the rest of the colors are neutrals.
- **Don't** exceed four distinct accent colors on any single screen (counting brand, CTA, domain, and semantic together).
- **Don't** use `#000` or `#fff`. Anywhere.
- **Don't** mix Berry Plum and Electric Indigo arbitrarily. Plum = action, Indigo = identity. The brand button is always violet. The default action button is always plum. The exception is the `.cta-magnetic` gradient — and only for the single hero submit per surface.
- **Don't** apply glass-blur to default surfaces. The translucency cost is real (especially on mobile); glass earns its place only when the surface is floating chrome.
- **Don't** animate `width`, `height`, `top`, `left`, or any layout property. Animate `transform` and `opacity`. Theme-switch crossfade is the only exception (View Transitions API, 200ms).
- **Don't** use bouncy or elastic easing curves. They read as AI-generated motion. Stick to `ease-out-quint` / `ease-out-expo` / `ease-out-quart`.
- **Don't** hedge in UI copy. No "maybe try", no "let's get started", no "tap below to begin your journey." Imperative, declarative, done.
- **Don't** pad the output with restated headings or filler intros. The user came for distilled value sized to the source; every word past necessary is bullshit. A three-hour lecture earns a long study system; a ten-minute tutorial doesn't earn an essay.
- **Don't** use loading spinners in the middle of content. Skeletons that resemble the final layout are the rule.
- **Don't** reinvent standard affordances (custom scrollbars, weird form controls, non-standard modal patterns). Familiarity is a feature in product UI. The product disappears into the task.
- **Don't** add color or full saturation to inactive states. Inactive = muted-foreground. Active = brand color. Don't dilute the active signal.
