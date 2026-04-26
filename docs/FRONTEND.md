# Frontend Development Guide

Complete guide for vie-web frontend development: React, TypeScript, Tailwind v4, shadcn/ui, state management.

---

## Overview

### Tech Stack

| Technology      | Version | Purpose           |
| --------------- | ------- | ----------------- |
| Vite            | 7.x     | Build tool        |
| React           | 19.x    | UI framework      |
| React Compiler  | latest  | Auto-memoization  |
| TypeScript      | 5.x     | Language          |
| Tailwind CSS    | 4.x     | Styling           |
| shadcn/ui       | latest  | Component library |
| React Query     | 5.x     | Server state      |
| Zustand         | 5.x     | Client state      |
| React Router    | 7.x     | Routing           |
| React Hook Form | 7.x     | Forms             |
| Vercel AI SDK   | latest  | LLM streaming     |

### Environment Variables

```bash
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
```

---

## Project Structure

```
apps/web/src/
├── main.tsx
├── App.tsx
│
├── pages/                          # ALL route pages
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── LandingPage.tsx             # Public homepage with URL input
│   ├── BoardPage.tsx               # Folder explorer + video grid
│   ├── GeneratePage.tsx            # Centered URL input for new summaries
│   ├── VideoDetailPage.tsx         # Video detail + output rendering
│   ├── SharePage.tsx               # Public share view (/s/:slug)
│   └── dev/DesignSystemPage.tsx
│
├── components/                     # SHARED components
│   ├── ui/                         # shadcn/ui primitives
│   ├── vie/                        # VIE Component Library
│   │   ├── index.ts                # Barrel — import from '@/components/vie'
│   │   ├── cards/                  # GlassCard, ExpandableCard, HeroCard, VideoHero
│   │   ├── data/                   # ScoreRing, StatPill, Badge, Timer, Timestamp
│   │   ├── content/                # TextBlock, CodeSnippet, QuoteBlock, TableView
│   │   ├── navigation/            # TabBar, ProgressBar, SectionNav, Stepper
│   │   ├── interactive/           # CheckItem, FlipCard, OptionGrid, ActionButton
│   │   ├── feedback/              # Celebration, FadeIn, InlineScore, Shake
│   │   └── media/                 # VideoClip, ImageGallery, AudioSnippet
│   ├── layout/                     # App shell
│   │   ├── Layout.tsx, AppHeader.tsx, LeftSidebarIconStrip.tsx
│   │   ├── MobileBottomNav.tsx, MobileFAB.tsx
│   ├── collections/                # Collection picker/panel (4 files)
│   ├── rag/                        # RAG chat components (4 files)
│   ├── videos/                     # VideoGrid, VideoCard, YouTubePlayer, etc.
│   ├── playlists/                  # PlaylistPreview
│   └── dev/                        # Design system showcases
│
├── features/                       # Complex, multi-concern features
│   ├── sidebar/                    # Navigation system (30+ files)
│   │   ├── Sidebar.tsx, index.ts   # Root + barrel (lazy import)
│   │   ├── core/                   # SidebarHeader, SidebarToolbar, SidebarTabs,
│   │   │                           # SidebarSection, SearchInput, SortDropdown,
│   │   │                           # TextSizeToggle, DndProvider, SelectionToolbar
│   │   ├── folders/                # FolderItem, FolderTree, FolderContextMenu,
│   │   │                           # FolderTreeSelect, FolderSelector, FolderRenameInput,
│   │   │                           # CreateFolderButton, CreateSubfolderInput, NewFolder*
│   │   ├── videos/                 # VideoItem, VideoContextMenu, UnassignedVideosList, AddVideoInput
│   │   ├── dialogs/                # BulkDeleteDialog, DeleteFolderDialog, DeleteVideoDialog
│   │   ├── hooks/                  # use-sidebar-text-size, use-long-press, use-is-truncated,
│   │   │                           # use-folder-drag-drop, use-sidebar-chat
│   │   └── lib/                    # folder-utils, style-utils, layout-constants
│   │
│   └── video-output/               # Video output rendering (40+ files)
│       ├── components/
│       │   ├── OutputRouter.tsx     # Routes v2 (assembledTabs) or v1 fallback
│       │   ├── CollapsibleVideoPlayer.tsx
│       │   └── output/
│       │       ├── ComposableOutput.tsx, ComposableOutputV1.tsx
│       │       ├── DisplaySection.tsx, TabLayout.tsx, CrossTabLink.tsx
│       │       ├── RecipePlayer.tsx, RecipeStepView.tsx, RecipeIngredientPanel.tsx
│       │       ├── interactive/    # 17+ interactive renderers (Quiz, FlashDeck, etc.)
│       │       ├── skeletons/      # Loading skeletons
│       │       └── lib/            # tab-data-resolver, format-utils, ingredient-step-matcher
│       ├── hooks/                  # use-summary-stream, use-processing-manager
│       ├── stores/                 # processing-store
│       ├── contexts/               # TabStateContext, VideoPlayerContext
│       └── lib/                    # streaming/ (SSE pipeline), synthesis-utils, output-type-config
│
├── contexts/                       # App-level React contexts
│   └── DirectionContext.tsx        # RTL/LTR direction + language provider
├── api/                            # API client modules
├── hooks/                          # SHARED hooks (8 files)
│   ├── use-folders, use-videos, use-playlists   # Data hooks
│   ├── use-share, use-websocket, use-theme      # Feature hooks
│   └── use-media-query, use-drag-scrollbar      # UI utility hooks
├── lib/                            # SHARED utilities (6 files)
│   ├── utils.ts (cn()), query-client.ts, query-keys.ts
│   ├── youtube-utils.ts, string-utils.ts
│   ├── i18n.ts                     # UI label translations (en, he, ar)
│   └── dev/                        # Dev mock data
├── stores/                         # GLOBAL stores (auth-store, ui-store)
├── styles/                         # Global CSS
├── test/                           # Test setup + mocks
└── types/                          # Shared types
```

---

## Routes

| Path             | Page            | Auth       | Description                         |
| ---------------- | --------------- | ---------- | ----------------------------------- |
| `/`              | LandingPage     | Public     | URL input; auto-redirects to /board if authenticated |
| `/login`         | LoginPage       | Public     | Sign in → redirects to /board       |
| `/register`      | RegisterPage    | Public     | Sign up → redirects to /board       |
| `/board`         | BoardPage       | Protected  | Folder explorer + video grid (home) |
| `/generate`      | GeneratePage    | Protected  | Centered URL input for new summaries|
| `/video/:id`     | VideoDetailPage | Protected  | Video detail + output rendering     |
| `/s/:slug`       | SharePage       | Public     | Public read-only shared output      |

---

## Theme System

### Architecture

Theme uses `data-theme` attribute on `<html>` with three modes:

| Mode     | Behavior                                      |
| -------- | --------------------------------------------- |
| `dark`   | Forces dark theme (`data-theme="dark"`)       |
| `light`  | Forces light theme (`data-theme="light"`)     |
| `system` | No attribute set — CSS `prefers-color-scheme` controls |

### Key Files

- **`theme-context.ts`** — `Theme = "dark" | "light" | "system"`, context + provider types
- **`theme-provider.tsx`** — Sets `document.documentElement.dataset.theme`, listens to `matchMedia` for system mode, uses View Transitions API for smooth crossfade
- **`index.html`** — FOUC prevention script reads `localStorage('vie-theme')` and sets `data-theme` before React loads

### Color Palette (OKLCH)

- **Primary**: VIE palette (replaces violet-indigo)
- **Accents**: 8 tokens — `--vie-coral`, `--vie-plum`, `--vie-sky`, `--vie-mint`, `--vie-honey`, `--vie-rose`, `--vie-forest`, `--vie-peach`
- **Per-output gradients**: Each output type has a unique gradient token
- **Light mode**: Cool blue-gray (hue ~250), low chroma
- **Dark mode**: Warm amber-brown (hue ~55), low chroma

### Fonts

- **Body**: Inter (variable, Google Fonts)
- **Code**: JetBrains Mono (subset, Google Fonts)
- Loaded via `<link>` in `index.html` with `font-display: swap`

---

## Multi-Language & RTL Support

Video output components support right-to-left (RTL) languages. Direction is determined per-video based on the detected transcript language.

### Architecture

```
OutputRouter
  └── DirectionProvider (language, isRTL)      ← wraps all output
        ├── useDirection() → { language, isRTL, dir }
        └── useLabels() → translated UI strings
```

### Key Files

- **`contexts/DirectionContext.tsx`** — React context providing `language`, `isRTL`, `dir` ("ltr" | "rtl")
- **`lib/i18n.ts`** — UI label translations (English, Hebrew, Arabic); `useLabels()` hook
- **`OutputRouter.tsx`** — Wraps output tree in `<DirectionProvider language={language} isRTL={isRTL}>`

### RTL Patterns

| Pattern | LTR | RTL |
|---------|-----|-----|
| Text alignment | `text-left` | Use `text-start` (auto-flips) |
| Directional icons | Normal | `rtl:rotate-180` on chevrons/arrows |
| Margins/padding | `ml-2`, `mr-2` | Use `ms-2`, `me-2` (logical properties) |
| Flex direction | Default | Tailwind `rtl:` variant auto-flips |

### UI Labels

Components use `useLabels()` for translatable strings (Next, Previous, Done, etc.) instead of hardcoded English. Currently supports: English, Hebrew, Arabic.

---

# Styling - Tailwind v4

## CSS-First Configuration

Tailwind v4 uses CSS for configuration, not `tailwind.config.ts`.

### Setup

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

### Theme Configuration

```css
/* src/index.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  /* Colors (OKLCH for better gradients) */
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(14.1% 0.005 285.82);
  --color-primary: oklch(20.5% 0.015 285.82);
  --color-primary-foreground: oklch(98.5% 0 0);

  /* Semantic */
  --color-destructive: oklch(57.7% 0.245 27.33);
  --color-success: oklch(59.6% 0.145 163.22);
  --color-warning: oklch(79.5% 0.184 86.05);

  /* Border & Input */
  --color-border: oklch(91.4% 0.004 285.82);
  --color-ring: oklch(20.5% 0.015 285.82);

  /* Radius */
  --radius: 0.625rem;
}

.dark {
  --color-background: oklch(14.1% 0.005 285.82);
  --color-foreground: oklch(98.5% 0 0);
  /* ... other dark overrides */
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

### Breaking Changes from v3

| v3 Name        | v4 Name          | Notes               |
| -------------- | ---------------- | ------------------- |
| `shadow-sm`    | `shadow-xs`      | Scale shifted down  |
| `shadow`       | `shadow-sm`      | Scale shifted down  |
| `rounded-sm`   | `rounded-xs`     | Scale shifted down  |
| `ring`         | `ring-3`         | Now defaults to 1px |
| `outline-none` | `outline-hidden` | Name clarification  |

### The `cn()` Utility

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Usage:

```tsx
<div className={cn(
  "rounded-lg border bg-card p-6",
  isActive && "ring-2 ring-primary",
  className
)} />
```

### Component Variants with CVA

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-10 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

### Responsive Design (Mobile-First)

```tsx
<div className="
  flex flex-col gap-4      /* Mobile: stack */
  md:flex-row md:gap-6     /* Tablet+: row */
  lg:gap-8                 /* Desktop: more space */
">
```

| Prefix | Min Width | Target           |
| ------ | --------- | ---------------- |
| (none) | 0px       | Mobile (default) |
| `sm:`  | 640px     | Large phones     |
| `md:`  | 768px     | Tablets          |
| `lg:`  | 1024px    | Laptops          |
| `xl:`  | 1280px    | Desktops         |

---

# Components - shadcn/ui

## Philosophy

shadcn/ui components are **copied into your project** - you own the code.

### Setup

```bash
pnpm dlx shadcn@latest init
# Style: New York, Base color: Zinc, CSS variables: Yes
```

### Add Components

```bash
pnpm dlx shadcn@latest add button card input label form dialog sonner badge skeleton dropdown-menu tabs scroll-area
```

### Core Components

**Button:**
```tsx
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button variant="ghost" size="bare">Text-like action</Button>
<Button variant="ghost" size="icon-bare"><Copy className="h-3 w-3" /></Button>
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>
```

**Button size guide:**
| Size | Use case | Styles |
|------|----------|--------|
| `default` | Standard buttons | `h-9 px-4 py-2` |
| `sm` | Compact buttons | `h-8 px-3` |
| `lg` | Large CTAs | `h-10 px-6` |
| `icon` | Icon-only (standard) | `size-9` |
| `bare` | Text-like inline actions (copy, seek, expand) | `h-auto p-0 gap-1` |
| `icon-bare` | Icon-only minimal (toggles, play/stop) | `h-auto p-0.5` |

> **ESLint:** Raw `<button>` elements are flagged by `no-restricted-syntax` (warn level). Always use `<Button>` from `@/components/ui/button`. Exceptions: Radix `asChild` composition requires raw elements — use `// eslint-disable-next-line no-restricted-syntax` with justification.

**Card:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

**Dialog:**
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button>Submit</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Toast (Sonner):**
```tsx
import { toast } from "sonner";

toast.success("Video added!");
toast.error("Failed to process");
toast.promise(submitVideo(url), {
  loading: "Processing...",
  success: "Done!",
  error: "Failed",
});
```

### Best Practices

1. Use `asChild` for custom triggers
2. Always handle loading states
3. Compose, don't configure
4. Use semantic color variables

---

# Performance

## React Compiler

The app uses `babel-plugin-react-compiler` for automatic memoization. This eliminates the need for most manual `useMemo`, `useCallback`, and `memo()` calls.

- Configured in `vite.config.ts` via `react({ babel: { plugins: [["babel-plugin-react-compiler"]] } })`
- ESLint plugin `eslint-plugin-react-compiler` with `warn` level catches violations
- Only add manual `memo()` when react-scan confirms the compiler missed something

## Performance Patterns

| Pattern | Where | Why |
|---------|-------|-----|
| `useMemo` for stable array refs | SidebarSection.tsx | `?? []` creates new ref each render, breaks child memo |
| `useCallback` for DnD handlers | DndProvider.tsx | Event handlers recreated on re-render without it |
| `createPortal` for DragOverlay | DndProvider.tsx | Avoids re-render cascade through sidebar tree |
| `content-visibility: auto` | index.css (`[data-slot="article-section"]`) | Skips rendering off-screen chapter sections |
| `fetchPriority="high"` | VideoHero.tsx (thumbnail) | LCP image must not use `loading="lazy"` |
| Finite CSS animations | index.css (`breathe`, `pulse-ring`) | Infinite animations waste GPU cycles |
| View Transitions API | theme-provider.tsx | Single GPU crossfade vs per-element transitions |
| Specific CSS transitions | Sidebar components | `transition-[props]` instead of `transition-all` |

---

# State Management

## Categories

| Type             | Example                    | Solution        | Persistence  |
| ---------------- | -------------------------- | --------------- | ------------ |
| **Remote State** | User data, videos, folders | React Query     | API cache    |
| **Local State**  | Auth tokens, theme         | Zustand         | localStorage |
| **UI State**     | Modal open, loading        | useState        | Ephemeral    |
| **Form State**   | Input values, validation   | React Hook Form | Ephemeral    |
| **URL State**    | Filters, pagination        | URL params      | Shareable    |

## Remote State (React Query)

### Query Keys Factory

```typescript
// src/lib/query-keys.ts
export const queryKeys = {
  videos: {
    all: ["videos"] as const,
    lists: () => [...queryKeys.videos.all, "list"] as const,
    list: (folderId?: string) => [...queryKeys.videos.lists(), { folderId }] as const,
    details: () => [...queryKeys.videos.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.videos.details(), id] as const,
  },
  user: {
    current: ["user", "current"] as const,
  },
  folders: {
    all: ["folders"] as const,
    list: () => [...queryKeys.folders.all, "list"] as const,
  },
} as const;
```

### Custom Query Hooks

```typescript
// src/hooks/use-videos.ts
export function useVideos(folderId?: string) {
  return useQuery({
    queryKey: queryKeys.videos.list(folderId),
    queryFn: () => api.videos.list(folderId),
  });
}

export function useAddVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api.videos.create(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    },
  });
}
```

## Local State (Zustand)

### Auth Store

```typescript
// src/stores/auth-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
      logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    { name: "vie-auth" }
  )
);
```

### Selectors (Prevent Re-renders)

```typescript
// DO: Atomic selectors
const user = useAuthStore((state) => state.user);
const logout = useAuthStore((state) => state.logout);

// DON'T: Destructure entire store
const { user, accessToken, logout } = useAuthStore(); // Re-renders on ANY change
```

## Form State (React Hook Form)

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  url: z.string().url().refine(
    (url) => url.includes("youtube.com") || url.includes("youtu.be"),
    "Must be a YouTube URL"
  ),
});

function AddVideoForm() {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { url: "" } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>YouTube URL</FormLabel>
              <FormControl>
                <Input placeholder="https://youtube.com/watch?v=..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

---

# Composable Output System (v2)

The output system renders video summaries using component-addressed tabs assembled by the backend.

## Architecture

```
Backend Assembly → TabEntry[] → SSE tab_ready events
                                      ↓
OutputRouter → ComposableOutput → COMPONENT_REGISTRY → Interactive Renderers
              (v2 path)                                  (21 components)
                                      or
              ComposableOutputV1 → resolveTabData → renderInteractive
              (v1 fallback)
```

## Component Layer Model

```
Layer 1: shadcn/ui    (components/ui/)        — Accessible primitives (Button, Dialog, etc.)
Layer 2: VIE Library  (components/vie/)       — Domain-free, reusable presentation components
Layer 3: Interactives (output/interactive/)   — Self-contained mini-apps with state
Layer 4: Shell        (video-detail/shell/)   — State coordination (TabCoordinationContext)
```

**Rules:**
- Layer 2 (vie/) takes only primitive props (string, number, ReactNode) — no `@vie/types`
- Layer 2 components are all wrapped in `React.memo()`
- Import vie/ components via barrel: `import { GlassCard, ScoreRing } from '@/components/vie'`
- Layer 3 interactives compose from Layer 2 components

### Key Components

| Component | Purpose |
|-----------|---------|
| `OutputRouter` | Routes to v2 (assembledTabs) or v1 (triage + extraction) path |
| `ComposableOutput` | Maps `tab.component` to `COMPONENT_REGISTRY` renderer |
| `ComposableOutputV1` | Legacy fallback: `resolveTabData()` + `renderInteractive()` |
| `DisplaySection` | Data-driven section renderer for simple data display |
| `TabLayout` | Tab shell with navigation, progress, celebrations |
| `TabCoordinationContext` | Cross-tab state (activeTab, completedTabs) |
| `CrossTabLink` | Navigates between related tabs |
| `CollapsibleVideoPlayer` | CSS-hidden YouTube player with `seekTo` support |
| `RecipePlayer` | Cooking mode: ingredient panel + step-by-step player |

### COMPONENT_REGISTRY (21 Interactive Renderers)

Each tab's `component` field maps to a renderer in `ComposableOutput.tsx`:

| Component Name | Renderer | Description |
|---------------|----------|-------------|
| `overview` | OverviewInteractive | Collapsible sections, stat pills, bookmarking |
| `info_grid` | InfoGridInteractive | Search/filter, click-to-copy, expandable rows, sort |
| `checklist` | ChecklistInteractive | Checkbox items, serving scaler, grouped items |
| `step_player` | StepByStepInteractive | Progress tracking, timers, video sync |
| `comparison` | ComparisonInteractive | Per-row winner highlighting, verdict ScoreRing, pros/cons |
| `quiz` | QuizInteractive | Streak counter, end summary, retry, celebration |
| `flash_deck` | FlashDeckInteractive | Keyboard + touch swipe, shuffleable |
| `scenario` | ScenarioInteractive | Scenario-based learning exercises |
| `code_explorer` | CodeExplorer | Code snippets with navigate/showAll modes |
| `spot_explorer` | SpotExplorer | Location spots with sections |
| `exercise_tracker` | ExerciseInteractive | Sets/reps, warmup/cooldown, difficulty |
| `verdict` | VerdictInteractive | Sub-category ScoreRings, agree/disagree poll, expandable |
| `budget` | BudgetInteractive | Editable amounts, SVG donut chart, savings calculator |
| `moment_track` | MomentTrack | Unified track for navigation points + replayable highlight spans, mood/type filters, live progress on active clip, share-link with `#t=start[,end]` |
| `gallery` | GalleryInteractive | Grid/carousel/hero_stack layouts, seek |
| `lyrics_player` | LyricsPlayerInteractive | Synced lyrics sections with seek |
| `display_section` | DisplaySection | Generic data-driven fallback renderer |

### Data Flow

```
1. SSE triage_complete → tabs skeleton appears
2. SSE tab_ready[]     → each tab rendered progressively
3. SSE complete        → celebration, final state
```

### Tab Coordination

`TabCoordinationContext` manages:
- Active tab state (persisted in sessionStorage per videoId)
- Completed tabs tracking
- Cross-tab navigation via `CrossTabLink`

---

## RAG Components

### RAGSourceCard

Displays source cards for RAG-based explanations.

```tsx
<RAGSourceCard
  source={{
    videoSummaryId: 'video-1',
    title: 'Source Video',
    timestamp: 120,
    relevanceScore: 0.95,
  }}
  onClick={() => navigateToSource()}
/>
```

### RAGChatPanel

Chat interface for RAG-powered conversations.

```tsx
<RAGChatPanel
  sources={[...]}
  initialMessages={[...]}
  onSendMessage={async (message) => {...}}
/>
```

---

# Markdown Rendering

## MarkdownContent Component

Shared markdown renderer used across all chat surfaces. Uses `react-markdown` with `@tailwindcss/typography` prose classes.

**Location:** `src/components/ui/markdown-content.tsx`

### Usage

```tsx
import { MarkdownContent } from "@/components/ui/markdown-content";

// Full mode — drawers, modals, chat (headings, lists, bold, code)
<MarkdownContent content={markdownString} />

// Compact mode — popovers, tooltips (no headings, tighter spacing)
<MarkdownContent content={markdownString} compact />
```

### Consumers

| Component | Mode | Context |
|-----------|------|---------|
| GoDeepDrawer | full | Section expansion drawer |
| MasterSummaryModal | full | Quick Read modal |
| VideoChatPanel | full | Assistant chat messages |
| ConceptHighlighter (TellMeMore) | compact | Concept popover (max-w-sm, max-h-64 scroll) |

### Typography Plugin

Tailwind v4 CSS-first plugin registration in `index.css`:

```css
@plugin "@tailwindcss/typography";
```

This activates `prose prose-sm dark:prose-invert` classes used by MarkdownContent.

---

# AI Integration

## Vercel AI SDK for Streaming

```tsx
import { useVideoChat } from "@/hooks/use-streaming-chat";
import { StreamingText } from "@/components/ui/streaming-text";

function ChatComponent({ videoSummaryId }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useVideoChat({ videoSummaryId });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          {m.role === "assistant" ? (
            <StreamingText content={m.content} isLoading={isLoading} />
          ) : (
            m.content
          )}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## WebSocket Connection

```tsx
import { useWebSocket } from "@/hooks/use-websocket";

function App() {
  const { connectionState } = useWebSocket();
  // connectionState: "connecting" | "connected" | "disconnected"

  return (
    <div>
      {connectionState !== "connected" && (
        <Badge variant="outline">
          {connectionState === "connecting" ? "Reconnecting..." : "Offline"}
        </Badge>
      )}
    </div>
  );
}
```

### WebSocket Events

| Event Type | Payload | Action |
|------------|---------|--------|
| `video.status` | `{ videoSummaryId, status, progress?, error? }` | Invalidates video list queries |
| `video.metadata` | `{ videoSummaryId, title, channel?, thumbnailUrl?, duration? }` | Invalidates video list for sidebar title sync |

## Processing Manager (Auto-Resume)

The `useProcessingManager` hook provides app-level management of video processing streams. It enables:

1. **Auto-resume after browser refresh**: Automatically reconnects to SSE streams for any videos still processing
2. **Sidebar title sync**: WebSocket broadcasts metadata updates for real-time title display
3. **Centralized stream state**: Processing state shared across components via Zustand store

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  App.tsx                                                    │
│  ├── useWebSocket()      - Real-time status/metadata events │
│  └── useProcessingManager() - Auto-manages SSE streams      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  processing-store.ts (Zustand)                              │
│  └── streamStates: Map<videoSummaryId, ProcessingStreamState> │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
        ┌───────────────┐          ┌───────────────────┐
        │ Sidebar       │          │ VideoDetailPage   │
        │ (spinner)     │          │ (full progress)   │
        └───────────────┘          └───────────────────┘
```

### Usage

The hook is initialized in `App.tsx` after `useWebSocket()`:

```tsx
function AppRoutes() {
  useWebSocket();          // Real-time updates
  useProcessingManager();  // Auto-resume & sidebar sync
  // ...
}
```

### Processing Store State

```typescript
interface ProcessingStreamState {
  phase: StreamPhase;
  // StreamPhase = "idle" | "connecting" | "metadata" | "triage" | "extraction"
  //             | "enrichment" | "synthesis" | "done" | "cancelled" | "error"
  metadata: {
    title?: string;
    channel?: string;
    thumbnailUrl?: string;
    duration?: number;
  } | null;
  sectionsCount: number;
  error: string | null;
}
```

### How It Works

1. **Watch video list**: When videos with status `pending` or `processing` are detected
2. **Start SSE streams**: Automatically connects to `/api/videos/:id/stream` for each
3. **Update store**: Stream events update `processing-store` state
4. **Cleanup**: Streams are aborted when videos complete, are deleted, or user logs out

---

# Commands

```bash
# Development
pnpm run dev

# Build
pnpm run build

# Preview build
pnpm run preview

# Type check
pnpm run typecheck

# Lint
pnpm run lint
```

---

# Dev Tools (Development Only)

The frontend includes a dev-only panel for testing LLM providers.

## DevToolPanel

Located at `src/components/dev/DevToolPanel.tsx`, only visible when `import.meta.env.DEV === true`.

### Features

- **Provider Selection**: Choose between anthropic, openai, gemini for default/fast/fallback
- **Bypass Cache**: Toggle to force re-summarization (test both cached and non-cached paths)
- **Re-summarize**: Trigger new summarization with selected provider configuration

### Usage

1. Start dev server: `pnpm run dev`
2. Look for "Dev Tools" at bottom of sidebar
3. Expand panel, enter a video URL
4. Select providers and cache settings
5. Click "Re-summarize"
6. Check summarizer logs for provider selection

### Files

| File | Purpose |
|------|---------|
| `components/dev/ProviderSelector.tsx` | Provider dropdown component |
| `components/dev/DevToolPanel.tsx` | Main dev tools panel |

### Production

The dev panel is tree-shaken from production builds via:
```tsx
const DevToolPanel = import.meta.env.DEV
  ? lazy(() => import("@/components/dev/DevToolPanel")...)
  : null;
```

## Design System Page (`/dev/design-system`)

Living style guide for all design tokens and components.

| Section | Contents |
|---------|----------|
| Color Palette | Semantic colors (background, foreground, primary, etc.) with swatches |
| Typography | Text scale (xs-4xl) and font weights |
| Spacing Scale | Tailwind spacing tokens (1-12) with visual boxes |
| Cards Showcase | GlassCard, ExpandableCard, HeroCard, ImageCard, VideoHero |
| Interactive Block Showcase | All interactive renderers with live previews |
| UI Showcase | Buttons, badges, dialogs, toasts, form elements |
| VIE Library Showcase | All Layer 2 components: data, content, navigation, feedback, media |

### Dev Page Files

| File | Purpose |
|------|---------|
| `pages/dev/DesignSystemPage.tsx` | Design system page |
| `components/dev/design-system/ColorPalette.tsx` | Color token showcase |
| `components/dev/design-system/Typography.tsx` | Typography showcase |
| `components/dev/design-system/SpacingScale.tsx` | Spacing showcase |
| `components/dev/design-system/CardsShowcase.tsx` | Card component showcase |
| `components/dev/design-system/InteractiveBlockShowcase.tsx` | Interactive renderer showcase |
| `components/dev/design-system/UIShowcase.tsx` | UI primitives showcase |
| `components/dev/design-system/VIELibraryShowcase.tsx` | VIE component library showcase |
| `lib/dev/mock-interactive-blocks.ts` | Mock data for interactive components |

### Production Safety

All dev code has production guards:
```tsx
if (!import.meta.env.DEV) {
  throw new Error('This module should not be imported in production');
}
```

---

# Anti-Patterns to Avoid

| Anti-Pattern | Fix |
|--------------|-----|
| Duplicate remote state in local state | Use React Query directly |
| Destructure entire Zustand store | Use atomic selectors |
| Store derived state | Compute during render |
| Fetch in useEffect | Use React Query |
| Hardcode colors | Use semantic variables |
| `transition-all` | Be specific: `transition-colors` |
| Dynamic class construction | Use complete class strings |
| Missing focus states | Always include `focus-visible:ring` |
