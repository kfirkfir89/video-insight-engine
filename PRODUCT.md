# VIE Design Context

## Users

**Power learners, researchers, and content creators.** Tech-savvy, ages 25-45, who value efficiency and depth. Primarily desktop at a desk (studying, note-taking), mobile for quick reference after processing. They watch long-form YouTube content (lectures, tutorials, deep dives) and want structured, interactive takeaways — not a wall of text.

**Job to be done:** "I just watched (or am about to watch) a 90-minute video and I need the knowledge extracted, organized, and interactive." They want domain-specific output: recipes with steps, code tutorials with snippets, study guides with quizzes/flashcards. Turning passive video into active knowledge tools.

**Emotional arc:** Confidence that nothing was missed + delight at how fast it works ("wow, it actually understood the video") + calm focus when studying from the output. It should feel like your smartest friend took perfect notes.

## Brand Personality

**Sharp, generous, confident.**

- **Sharp** = precise extraction, no fluff, information-dense
- **Generous** = rich interactive output (quizzes, timelines, flashcards, comparisons — not just a summary)
- **Confident** = it knows what it's doing, no hedging, decisive presentation

## Aesthetic Direction

### Theme
**Dark mode is primary.** Glass-morphism, glow effects, and the OKLCH palette shine there. Light mode is a courtesy toggle that should still look good, but dark is where the premium feel lives.

### Color Identity
Violet-indigo primary (OKLCH hue 280-292) — this is the identity. The VIE accent palette (coral, plum, mint, sky, honey, rose, forest, peach) provides warmth and variety per domain. Max 4 accent colors on any single screen.

### References
- **Linear.app** — information density done right, clean without being sterile
- **Raycast** — glass effects, premium dark mode, snappy feel
- **Arc browser** — playful confidence, bold color choices, personality without being silly

### Anti-references
- No Bootstrap/Material dashboards
- No enterprise gray
- No "AI-slop" purple gradients (generic ChatGPT-wrapper aesthetic)
- No Notion-clone minimalism — VIE should feel richer and more alive
- No academic/stuffy

### Visual Ambitions
- More glass-morphism depth on cards
- Subtle glow on interactive elements in dark mode
- Smoother tab transitions in video output view
- Staggered entrance animations on content blocks as they stream in

## Design Principles

1. **Density over decoration** — Pack information tight like Linear, not sparse like a marketing page. Every pixel should earn its keep.
2. **Interactive by default** — Output is never a static wall. Quizzes, flashcards, timelines, toggles, copy buttons — the knowledge should be tactile.
3. **Confident presentation** — No "here's what we think might be..." hedging. Present extracted knowledge decisively with clear hierarchy.
4. **Dark-first premium** — Glass, glow, and depth in dark mode. Surfaces should feel layered and alive, not flat cards on a dark background.
5. **Domain-aware variety** — A recipe output should feel different from a code tutorial. Use the accent palette and component toolkit to give each domain its own character while staying cohesive.

## Accessibility

- WCAG 2.1 AA minimum
- RTL support implemented (i18n with DirectionContext)
- `prefers-reduced-motion` respected — all animations wrapped
- Focus rings implemented globally
- No specific known user needs beyond general best practices

## Tech Stack (Frontend)

- React 19, TypeScript 5, Vite 7
- Tailwind CSS v4 (CSS-first config via `@theme inline {}`)
- shadcn/ui, Radix primitives, CVA, lucide-react
- OKLCH color space throughout
- Zustand for state, TanStack Query for server state
- AI SDK for streaming
