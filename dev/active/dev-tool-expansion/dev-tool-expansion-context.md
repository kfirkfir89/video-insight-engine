# Dev Tool Expansion - Technical Context

**Status: ✅ COMPLETED** (2026-02-05)

## Key Files

### Existing Dev Infrastructure
| File | Purpose |
|------|---------|
| `apps/web/src/components/dev/DevToolPanel.tsx` | Collapsible dev panel with LLM provider selection |
| `apps/web/src/components/dev/ProviderSelector.tsx` | Provider dropdown component |
| `apps/web/src/App.tsx` | Route definitions with lazy loading pattern |

### Block Types & Rendering
| File | Purpose |
|------|---------|
| `packages/types/src/index.ts` | All 31 ContentBlock type definitions |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Main block renderer switch |
| `apps/web/src/components/video-detail/blocks/index.ts` | Block component exports |

### Category Views
| File | Purpose |
|------|---------|
| `apps/web/src/components/video-detail/views/StandardView.tsx` | Default view |
| `apps/web/src/components/video-detail/views/CodeView.tsx` | Coding category |
| `apps/web/src/components/video-detail/views/RecipeView.tsx` | Cooking category |
| `apps/web/src/components/video-detail/views/TravelView.tsx` | Travel category |
| `apps/web/src/components/video-detail/views/ReviewView.tsx` | Reviews category |
| `apps/web/src/components/video-detail/views/FitnessView.tsx` | Fitness category |
| `apps/web/src/components/video-detail/views/EducationView.tsx` | Education category |
| `apps/web/src/components/video-detail/views/PodcastView.tsx` | Podcast category |
| `apps/web/src/components/video-detail/views/DIYView.tsx` | DIY category |
| `apps/web/src/components/video-detail/views/GamingView.tsx` | Gaming category |

### Styling
| File | Purpose |
|------|---------|
| `apps/web/src/index.css` | Category CSS variables (`.category-*` classes) |

---

## Critical Patterns

### Production Exclusion Guard

Every dev component MUST start with this guard:

```typescript
// Top of file - REQUIRED
if (!import.meta.env.DEV) {
  throw new Error("This module should not be imported in production");
}
```

### Lazy Loading Dev Routes

Use this pattern in `App.tsx` for tree-shaking:

```typescript
// Conditional lazy load - only in dev
const DesignSystemPage = import.meta.env.DEV
  ? lazy(() => import("@/pages/dev/DesignSystemPage").then(m => ({ default: m.DesignSystemPage })))
  : null;

// Conditional route
{import.meta.env.DEV && DesignSystemPage && (
  <Route path="/dev/design-system" element={<Suspense><DesignSystemPage /></Suspense>} />
)}
```

### Block Factory Pattern

Create type-safe mock blocks:

```typescript
// lib/dev/mock-blocks.ts
import { v4 as uuid } from 'uuid';
import type { ParagraphBlock, BulletsBlock } from '@vie/types';

export function createParagraphBlock(text: string): ParagraphBlock {
  return {
    blockId: uuid(),
    type: 'paragraph',
    text,
  };
}

export function createBulletsBlock(items: string[], variant?: string): BulletsBlock {
  return {
    blockId: uuid(),
    type: 'bullets',
    items,
    variant,
  };
}
```

---

## All 31 Block Types (by Category)

### Universal Blocks (12)
| Type | Description | Fields |
|------|-------------|--------|
| `paragraph` | Plain text | `text` |
| `bullets` | Unordered list | `items`, `variant?` |
| `numbered` | Ordered list | `items`, `variant?` |
| `do_dont` | Do/Don't comparison | `do[]`, `dont[]` |
| `example` | Code example | `title?`, `code`, `explanation?`, `variant?` |
| `callout` | Tip/warning/note | `style`, `text`, `variant?` |
| `definition` | Term definition | `term`, `meaning` |
| `keyvalue` | Key-value pairs | `items[]`, `variant?` |
| `comparison` | Side-by-side | `left`, `right`, `variant?` |
| `timestamp` | Video timestamp | `time`, `seconds`, `label` |
| `quote` | Quotation | `text`, `attribution?`, `timestamp?`, `variant?` |
| `statistic` | Stats display | `items[]`, `variant?` |

### New Universal Blocks (3)
| Type | Description | Fields |
|------|-------------|--------|
| `transcript` | Video transcript | `lines[]` |
| `timeline` | Event timeline | `events[]` |
| `tool_list` | Tools/materials | `tools[]` |

### Cooking Blocks (3)
| Type | Description | Fields |
|------|-------------|--------|
| `ingredient` | Ingredients list | `items[]`, `servings?` |
| `step` | Cooking steps | `steps[]` |
| `nutrition` | Nutrition facts | `items[]`, `servingSize?` |

### Coding Blocks (3)
| Type | Description | Fields |
|------|-------------|--------|
| `code` | Code snippet | `code`, `language?`, `filename?`, `highlightLines?` |
| `terminal` | Terminal command | `command`, `output?` |
| `file_tree` | File structure | `tree[]` |

### Travel Blocks (3)
| Type | Description | Fields |
|------|-------------|--------|
| `location` | Place info | `name`, `address?`, `description?`, `coordinates?` |
| `itinerary` | Day-by-day | `days[]` |
| `cost` | Budget breakdown | `items[]`, `total?`, `currency?` |

### Review Blocks (3)
| Type | Description | Fields |
|------|-------------|--------|
| `pro_con` | Pros/cons list | `pros[]`, `cons[]` |
| `rating` | Score rating | `score`, `maxScore`, `label?`, `breakdown?` |
| `verdict` | Final verdict | `verdict`, `summary`, `bestFor?`, `notFor?` |

### Fitness Blocks (2)
| Type | Description | Fields |
|------|-------------|--------|
| `exercise` | Exercise list | `exercises[]` |
| `workout_timer` | Interval timer | `intervals[]`, `rounds?` |

### Education Blocks (2)
| Type | Description | Fields |
|------|-------------|--------|
| `quiz` | Quiz questions | `questions[]` |
| `formula` | Math formula | `latex`, `description?`, `inline?` |

### Podcast Blocks (1)
| Type | Description | Fields |
|------|-------------|--------|
| `guest` | Guest info | `guests[]` |

---

## Category CSS Variables

Each category has three CSS variables:

```css
.category-cooking {
  --category-accent: #FF6B35;      /* Primary accent color */
  --category-accent-soft: rgba(255, 107, 53, 0.12);  /* Soft background */
  --category-surface: #FFF7ED;     /* Surface color (light mode) */
}
```

### All Category Colors

| Category | Accent | Description |
|----------|--------|-------------|
| cooking | `#FF6B35` | Warm orange |
| coding | `#22D3EE` | Cyan/teal |
| travel | `#10B981` | Emerald green |
| reviews | `#F59E0B` | Amber |
| fitness | `#EF4444` | Red |
| education | `#8B5CF6` | Purple |
| podcast | `#EC4899` | Pink |
| gaming | `#6366F1` | Indigo |
| diy | `#D97706` | Dark amber |
| standard | `#6B7280` | Gray |

---

## Mock Video Structure

Each mock video needs:

```typescript
interface MockVideo {
  // VideoResponse fields
  id: string;
  videoSummaryId: string;
  youtubeId: string;
  title: string;
  channel: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  status: 'completed';
  folderId: null;
  createdAt: string;
  context: VideoContext;

  // VideoSummary fields
  summary: {
    tldr: string;
    keyTakeaways: string[];
    chapters: SummaryChapter[];
    concepts: Concept[];
    masterSummary?: string;
  };

  // DescriptionAnalysis fields
  descriptionAnalysis: {
    links: DescriptionLink[];
    resources: Resource[];
    relatedVideos: RelatedVideo[];
    socialLinks: SocialLink[];
  };
}
```

---

## Decisions

### D1: Full Isolation
All dev code in dedicated `/dev/` folders with production guards. No imports from dev folders in production code.

### D2: Lazy Loading
Dev pages are lazy-loaded with `import.meta.env.DEV` conditional to ensure tree-shaking.

### D3: Mock Data Factories
Use factory functions (not static JSON) for mock data to ensure fresh UUIDs and type safety.

### D4: Category-Specific Mocks
Each category mock video uses blocks that are typical for that category, demonstrating real-world usage.

### D5: No External Dependencies
Mock data is self-contained with no API calls. Uses hard-coded placeholder thumbnails.

---

## Testing Verification

### Production Build Check
```bash
cd apps/web && npm run build
grep -r "DesignSystemPage" dist/    # Should return nothing
grep -r "VideoExamplesPage" dist/   # Should return nothing
grep -r "mock-data" dist/           # Should return nothing
grep -r "mock-videos" dist/         # Should return nothing
grep -r "/dev/" dist/               # Should return nothing
```

### Development Check
```bash
cd apps/web && npm run dev
# Visit http://localhost:5173/dev/design-system
# Visit http://localhost:5173/dev/video-examples
```

---

**Last Updated**: 2026-02-05
