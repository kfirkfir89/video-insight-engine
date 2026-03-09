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
apps/web/
├── Dockerfile
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    │
    ├── api/
    │   ├── client.ts             # Fetch wrapper
    │   ├── auth.ts
    │   ├── folders.ts
    │   ├── videos.ts
    │   ├── memorize.ts
    │   ├── explain.ts
    │   └── share.ts              # Share link API client
    │
    ├── components/
    │   ├── ui/                   # shadcn components
    │   │
    │   ├── layout/
    │   │   ├── Layout.tsx              # Sidebar + main content (no header)
    │   │   ├── MobileBottomNav.tsx     # Fixed bottom nav (md:hidden)
    │   │   └── MobileFAB.tsx           # Floating action button (md:hidden)
    │   │
    │   ├── video-detail/
    │   │   ├── VideoDetailLayout.tsx     # Orchestrator (responsive)
    │   │   ├── VideoDetailDesktop.tsx    # Desktop layout + sticky right panel
    │   │   ├── VideoDetailMobile.tsx     # Mobile single-column layout
    │   │   ├── RightPanelTabs.tsx        # Tab-based right panel (chapters, minimap, chat)
    │   │   ├── VideoHero.tsx             # Hero card — metadata + TL;DR
    │   │   ├── video-detail-types.ts     # Shared TypeScript types
    │   │   ├── FlowRowRenderer.tsx       # Shared auto-flow row renderer (5 row types)
    │   │   ├── SectionCard.tsx
    │   │   ├── ContentBlockRenderer.tsx  # Dynamic content blocks (editable prop)
    │   │   ├── DetectionOverride.tsx    # Output type override dropdown
    │   │   ├── InlineEditor.tsx         # contentEditable wrapper
    │   │   ├── containers/              # Interactive view containers
    │   │   │   ├── TabbedView.tsx       # Glass pill tabs, ARIA compliant
    │   │   │   ├── SwipeableView.tsx    # Touch gesture nav
    │   │   │   ├── StepThroughView.tsx  # Step-by-step navigator
    │   │   │   ├── ProgressView.tsx     # Completion tracking (localStorage)
    │   │   │   └── TimerView.tsx        # Countdown timer
    │   │   ├── blocks/                   # V2.1 Block Component Library
    │   │   │   ├── __tests__/            # Unit tests (18 files)
    │   │   │   ├── index.ts              # Barrel export
    │   │   │   ├── BulletsBlock.tsx      # Basic
    │   │   │   ├── NumberedBlock.tsx
    │   │   │   ├── ExampleBlock.tsx
    │   │   │   ├── CalloutBlock.tsx
    │   │   │   ├── ChecklistBlock.tsx    # Unified: tool_list + ingredient
    │   │   │   ├── StepBlock.tsx         # Unified: step + numbered (simple mode)
    │   │   │   ├── NutritionBlock.tsx
    │   │   │   ├── CodeBlock.tsx         # Technical (plain monochrome)
    │   │   │   ├── TerminalBlock.tsx
    │   │   │   ├── FileTreeBlock.tsx
    │   │   │   ├── ProConBlock.tsx       # Review
    │   │   │   ├── RatingBlock.tsx
    │   │   │   ├── VerdictBlock.tsx
    │   │   │   ├── LocationBlock.tsx     # Travel
    │   │   │   ├── ItineraryBlock.tsx
    │   │   │   ├── CostBlock.tsx
    │   │   │   ├── FitnessBlock.tsx      # Unified: exercise + workout_timer
    │   │   │   ├── QuizBlock.tsx         # Education
    │   │   │   ├── GuestBlock.tsx        # Interview
    │   │   │   ├── ProblemSolutionBlock.tsx  # Quality
    │   │   │   └── VisualBlock.tsx
    │   │   └── views/                    # Persona-specific views
    │   │       ├── ViewLayout.tsx           # Layout primitives (row, column, section)
    │   │       ├── SectionHeader.tsx
    │   │       ├── CodeView.tsx             # Uses StepThroughView container
    │   │       ├── RecipeView.tsx           # Uses TabbedView container
    │   │       ├── EducationView.tsx        # Uses ProgressView container
    │   │       ├── FitnessView.tsx          # Uses TimerView container
    │   │       └── StandardView.tsx         # Uses auto-flow layout engine
    │   │
    │   ├── rag/                          # RAG Components
    │   │   ├── __tests__/                # Unit tests
    │   │   ├── RAGSourceCard.tsx         # Source display card
    │   │   └── RAGChatPanel.tsx          # Chat interface
    │   │
    │   ├── sidebar/
    │   │   ├── Sidebar.tsx             # Main sidebar container
    │   │   ├── SidebarHeader.tsx       # Logo + close button
    │   │   ├── SidebarTabs.tsx         # Summaries/Memorized tab bar
    │   │   ├── SidebarSection.tsx      # Tab content area (folder tree)
    │   │   ├── SidebarToolbar.tsx      # Search, sort, selection controls
    │   │   ├── SidebarFooter.tsx       # Video count + theme + user
    │   │   ├── AddVideoInput.tsx       # URL input (video/playlist)
    │   │   ├── SearchInput.tsx         # Debounced search input
    │   │   ├── SortDropdown.tsx        # Sort options dropdown
    │   │   ├── SelectionToolbar.tsx    # Bulk actions toolbar
    │   │   ├── VideoItem.tsx           # Video row with drag-drop
    │   │   ├── VideoContextMenu.tsx    # Video actions menu
    │   │   ├── FolderItem.tsx          # Folder row with drag-drop
    │   │   └── FolderContextMenu.tsx   # Folder actions menu
    │   │
    │   ├── folders/
    │   │   ├── FolderTree.tsx
    │   │   └── CreateFolderDialog.tsx
    │   │
    │   ├── videos/
    │   │   ├── VideoGrid.tsx
    │   │   ├── VideoCard.tsx
    │   │   └── AddVideoDialog.tsx
    │   │
    │   ├── playlists/
    │   │   └── PlaylistPreview.tsx
    │   │
    │   ├── board/
    │   │   ├── BoardCard.tsx           # Output card with gradient + emoji
    │   │   └── BoardGrid.tsx           # CSS columns masonry layout
    │   │
    │   └── memorize/
    │       ├── MemorizedGrid.tsx
    │       ├── MemorizedCard.tsx
    │       └── ChatPanel.tsx
    │
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useFolders.ts
    │   ├── useVideos.ts
    │   ├── use-playlists.ts
    │   ├── useMemorized.ts
    │   ├── use-summary-stream.ts     # SSE streaming + detection_result + confetti
    │   ├── use-processing-manager.ts # Auto-resume & sidebar sync
    │   ├── use-share.ts             # Share link creation + clipboard
    │   ├── use-output-state.ts      # Mutable block state + undo/redo
    │   ├── use-websocket.ts          # Real-time updates
    │   └── use-long-press.ts         # Long press gesture hook
    │
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── LandingPage.tsx          # Public homepage with URL input
    │   ├── BoardPage.tsx            # Pinterest-style masonry grid
    │   ├── SharePage.tsx            # Public share view (/s/:slug)
    │   ├── DashboardPage.tsx
    │   ├── VideoPage.tsx
    │   └── MemorizedPage.tsx
    │
    ├── stores/
    │   ├── auth-store.ts        # Auth + anonymous generation tracking
    │   ├── processing-store.ts  # Video processing state
    │   └── ui-store.ts
    │
    └── lib/
        ├── utils.ts
        ├── api.ts
        ├── query-keys.ts
        ├── output-type-config.ts  # OutputType → emoji, gradient, label, accent
        ├── block-labels.ts        # i18n-ready block labels
        ├── block-layout.ts        # Block sizing, spacing matrix, sidebar classification
        └── block-layout.ts        # Block sizing, spacing matrix
```

---

## Routes

| Path             | Page          | Auth       | Description                         |
| ---------------- | ------------- | ---------- | ----------------------------------- |
| `/`              | LandingPage   | Public     | URL input, live examples            |
| `/login`         | LoginPage     | Public     | Sign in                             |
| `/register`      | RegisterPage  | Public     | Sign up                             |
| `/board`         | BoardPage     | Protected  | Pinterest masonry grid (home)       |
| `/video/:id`     | VideoPage     | Protected  | Video detail + sections             |
| `/memorized/:id` | MemorizedPage | Protected  | Item detail + chat                  |
| `/s/:slug`       | SharePage     | Public     | Public read-only shared output      |
| `/dashboard`     | DashboardPage | Protected  | Two-tab interface (legacy)          |

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

# Content Block Rendering

Dynamic content blocks allow the LLM to return article-like summaries instead of rigid "paragraph + bullets" format.

## ContentBlockRenderer Component

```tsx
// src/components/video-detail/ContentBlockRenderer.tsx
import { ContentBlock } from "@vie/types";
import { cn } from "@/lib/utils";
import { Lightbulb, AlertTriangle, Info, Check, X } from "lucide-react";

interface Props {
  block: ContentBlock;
  persona?: string;
  onTimestampClick?: (seconds: number) => void;
}

export function ContentBlockRenderer({ block, persona, onTimestampClick }: Props) {
  switch (block.type) {
    case "paragraph":
      return <p className="text-muted-foreground leading-relaxed">{block.text}</p>;

    case "bullets":
      return (
        <ul className={cn(
          "list-disc list-inside space-y-1",
          block.variant === "ingredients" && "bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-400 pl-4 py-2"
        )}>
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );

    case "numbered":
      return (
        <ol className={cn(
          "list-decimal list-inside space-y-1",
          block.variant === "cooking_steps" && "bg-orange-50 dark:bg-orange-950/20 border-l-4 border-orange-400 pl-4 py-2"
        )}>
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
      );

    case "example":
      return (
        <div className="rounded-lg border bg-muted/50 p-4">
          {block.title && <p className="font-medium mb-2">{block.title}</p>}
          <pre className="font-mono text-sm overflow-x-auto"><code>{block.code}</code></pre>
          {block.explanation && <p className="mt-2 text-sm text-muted-foreground">{block.explanation}</p>}
        </div>
      );

    case "callout":
      const icons = { tip: Lightbulb, warning: AlertTriangle, note: Info };
      const colors = {
        tip: "border-amber-400 bg-amber-50 dark:bg-amber-950/20",
        warning: "border-red-400 bg-red-50 dark:bg-red-950/20",
        note: "border-blue-400 bg-blue-50 dark:bg-blue-950/20",
      };
      const Icon = icons[block.style];
      return (
        <div className={cn("rounded-lg border-l-4 p-4", colors[block.style])}>
          <div className="flex gap-2">
            <Icon className="h-5 w-5 shrink-0" />
            <p>{block.text}</p>
          </div>
        </div>
      );

    case "definition":
      return (
        <div className="rounded-lg bg-muted/30 p-4">
          <span className="font-semibold">{block.term}:</span> {block.meaning}
        </div>
      );

    case "keyvalue":
      return (
        <dl className={cn(
          "grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-4",
          block.variant === "specs" && "bg-slate-50 dark:bg-slate-950/20"
        )}>
          {block.items.map((item, i) => (
            <div key={i} className="contents">
              <dt className="font-medium text-muted-foreground">{item.key}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      );

    case "comparison":
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className={cn(
            "rounded-lg p-4",
            block.variant === "dos_donts" ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/30"
          )}>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              {block.variant === "dos_donts" && <Check className="h-4 w-4 text-green-600" />}
              {block.left.label}
            </h4>
            <ul className="space-y-1">
              {block.left.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div className={cn(
            "rounded-lg p-4",
            block.variant === "dos_donts" ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30"
          )}>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              {block.variant === "dos_donts" && <X className="h-4 w-4 text-red-600" />}
              {block.right.label}
            </h4>
            <ul className="space-y-1">
              {block.right.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
      );

    case "timestamp":
      return (
        <button
          onClick={() => onTimestampClick?.(block.seconds)}
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{block.time}</span>
          <span>{block.label}</span>
        </button>
      );

    default:
      return null;
  }
}
```

## View Selection by Persona

```tsx
// src/components/video-detail/VideoDetailLayout.tsx
const ViewComponent = useMemo(() => {
  switch (video.context?.persona) {
    case 'code':
      return CodeView;
    case 'recipe':
      return RecipeView;
    default:
      return StandardView;
  }
}, [video.context?.persona]);

// Display tags
{video.context?.displayTags?.length > 0 && (
  <div className="flex gap-2 flex-wrap mb-4">
    {video.context.displayTags.map(tag => (
      <span key={tag} className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">
        #{tag}
      </span>
    ))}
  </div>
)}
```

## SectionCard with Content Blocks

```tsx
// src/components/video-detail/SectionCard.tsx
function SectionCard({ section, onExplain, onMemorize, onTimestampClick }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{section.timestamp}</span>
          {section.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prefer content blocks if available */}
        {section.content && section.content.length > 0 ? (
          section.content.map((block, i) => (
            <ContentBlockRenderer
              key={i}
              block={block}
              onTimestampClick={onTimestampClick}
            />
          ))
        ) : (
          /* Fallback to legacy fields */
          <>
            <p className="text-muted-foreground">{section.summary}</p>
            {section.bullets?.length > 0 && (
              <ul className="list-disc list-inside space-y-1">
                {section.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={onExplain}>Explain</Button>
        <Button variant="outline" size="sm" onClick={onMemorize}>Memorize</Button>
      </CardFooter>
    </Card>
  );
}
```

---

## Block Layout Engine

Content-aware layout engine that measures block content at runtime and arranges blocks intelligently.

### Architecture

```
measureBlock() (content-weight.ts)
  → ContentWeight: micro | compact | standard | expanded
    → computeAutoFlowLayout() (auto-flow-layout.ts)
      → FlowRow[] (greedy left-to-right pairing)
        → FlowRowRenderer (shared component)
          → CSS container query grids (index.css)
```

### Content Weight System (`lib/content-weight.ts`)

Blocks are measured at runtime based on their content (string length, item count):

| Weight | Spans | Examples |
|--------|-------|---------|
| `micro` | 1 | Single stat, timestamp, short paragraph (<80 chars) |
| `compact` | 2 | Callout, 1-2 item list, short code (<5 lines) |
| `standard` | 4 | Normal paragraph, 3-5 item list, code block |
| `expanded` | 4 (full) | Long paragraph (500+ chars), 6+ item list |

### Auto-Flow Layout (`lib/auto-flow-layout.ts`)

Greedy pairing algorithm that produces 5 row types:

| Row Type | Grid | Rule |
|----------|------|------|
| `full` | 1fr | Expanded blocks, or standard without neighbors |
| `sidebar-main` | 280px + 1fr | Compact + standard adjacent |
| `equal-2` | 1fr 1fr | Two compact blocks |
| `equal-3` | 1fr 1fr 1fr | Three consecutive compact blocks |
| `equal-4` | 1fr 1fr 1fr 1fr | Four+ consecutive micro blocks |

Works without measurements (type-based fallback) for backward compatibility.

### Container Queries (`index.css`)

Grid classes adapt to content area width (not viewport):

- `.content-container` on chapters wrapper
- `.flow-grid-equal-2`: 2 cols @ 500px+
- `.flow-grid-equal-3`: 3 cols @ 600px+ (2 @ 400px+)
- `.flow-grid-equal-4`: 4 cols @ 700px+ (3 @ 600px+, 2 @ 400px+)

### Spacing Matrix (`lib/block-layout.ts`)

Progressive spacing between block categories (prose, list, visual, dense):

| prev \ curr | prose | list | visual | dense |
|-------------|-------|------|--------|-------|
| prose | mt-1.5 | mt-2 | mt-3 | mt-2 |
| list | mt-2 | mt-2 | mt-3 | mt-2 |
| visual | mt-3 | mt-3 | mt-2.5 | mt-2.5 |
| dense | mt-2 | mt-2 | mt-2.5 | mt-1.5 |

---

# Specialized Block Components (V2.1)

The Content Block Library V2.1 introduces 18 specialized block components organized by persona/use-case. All components follow consistent patterns and are fully tested.

## Component Architecture

```
src/components/video-detail/blocks/
├── __tests__/           # Unit tests for all blocks
├── index.ts             # Barrel export
├── ListBlock.tsx        # Bullet lists (unordered only)
├── ExampleBlock.tsx     # Code examples (single dark design)
├── CalloutBlock.tsx
├── ChecklistBlock.tsx   # Unified: tool_list + ingredient (checkbox + serving scaler)
├── StepBlock.tsx        # Unified: step + numbered (simple mode for numbered)
├── NutritionBlock.tsx
├── CodeBlock.tsx        # Plain monochrome code display
├── TerminalBlock.tsx
├── FileTreeBlock.tsx
├── ProConBlock.tsx      # Review blocks
├── RatingBlock.tsx
├── VerdictBlock.tsx
├── LocationBlock.tsx    # Travel blocks
├── ItineraryBlock.tsx
├── CostBlock.tsx
├── FitnessBlock.tsx     # Unified: exercise + workout_timer
├── QuizBlock.tsx        # Education blocks
└── GuestBlock.tsx       # Interview blocks
```

## Block Types Reference

| Block Type | Component | Persona | Key Features |
|------------|-----------|---------|--------------|
| `ingredient` | ChecklistBlock | Recipe | Serving scaler, checkbox items |
| `tool_list` | ChecklistBlock | Various | Checkbox items, notes |
| `step` | StepBlock | Recipe | Progress tracking, timing, video sync |
| `numbered` | StepBlock (simple) | Various | Non-interactive numbered list |
| `nutrition` | NutritionBlock | Recipe | Table layout, nutrient display |
| `code` | CodeBlock | Code | Plain monochrome, copy, line numbers |
| `terminal` | TerminalBlock | Code | Command display, copy functionality |
| `file_tree` | FileTreeBlock | Code | Expandable folders, keyboard nav |
| `pro_con` | ComparisonRenderer | Review | Split layout (via ContentBlockRenderer adaptation) |
| `rating` | RatingBlock | Review | Stars/progress bar, breakdown |
| `verdict` | VerdictBlock | Review | Verdict types, best-for lists |
| `location` | LocationBlock | Travel | Map links, coordinates |
| `itinerary` | ItineraryBlock | Travel | Day/activity timeline |
| `cost` | CostBlock | Travel | Currency formatting, totals |
| `exercise` | FitnessBlock | Fitness | Sets/reps, difficulty badges, demo links |
| `workout_timer` | FitnessBlock | Fitness | Interactive timer, interval tracking |
| `quiz` | QuizBlock | Education | Interactive Q&A, explanations |
| `guest` | GuestBlock | Interview | Social links, avatar, bio |

## Block Visual Design Language

All 27 block components implement a unified "Enterprise Calm" design language. This section documents the visual patterns, premium CSS utilities, and rules for maintaining consistency.

### Premium Utility Matrix

Which blocks use which premium CSS utilities:

| Utility | Blocks Using It |
|---------|----------------|
| `stagger-children` | ListBlock, ChecklistBlock, StepBlock, FitnessBlock, ItineraryBlock, CostBlock, TimelineBlock, TranscriptBlock |
| `hover-lift` | ChecklistBlock (items), FitnessBlock (items), ItineraryBlock (activities), CostBlock (items), LocationBlock (card), GuestBlock (social links) |
| `hover-scale` | QuizBlock (options), FitnessBlock (timer controls) |
| `glass-surface` | ChecklistBlock (scaler), FitnessBlock (timer controls), NutritionBlock (header), CostBlock (total) |
| `text-gradient-primary` | RatingBlock (large scores), StepBlock (numbers) |
| `text-gradient-warm` | RatingBlock (star scores), NutritionBlock (daily values) |
| `fade-divider` | ChecklistBlock, FitnessBlock, CostBlock, ItineraryBlock, NutritionBlock, TranscriptBlock, RatingBlock, ListBlock |
| `block-card` | Interactive blocks via `BlockWrapper variant="card"` (ChecklistBlock, StepBlock, QuizBlock, FitnessBlock, FileTreeBlock, TranscriptBlock, CostBlock, DefinitionBlock) |
| `block-accent` | CalloutBlock (top fade-edge gradient line via `::before`, no left border) |
| `block-code-container` | CodeBlock, TerminalBlock |
| `block-label-minimal` | Transparent blocks with small muted label (RatingBlock, VerdictBlock, LocationBlock, NutritionBlock, GuestBlock, ItineraryBlock, FitnessBlock) |
| `table-fade-dividers` | TableBlock — gradient fade-edge dividers on inner lines only |

### Dark Mode Glow Usage

| Glow Class | Block | Element |
|------------|-------|---------|
| `badge-glow-success` | FitnessBlock | Beginner difficulty badge |
| `badge-glow-warning` | FitnessBlock | Intermediate difficulty badge |
| `badge-glow-destructive` | FitnessBlock | Advanced difficulty badge |
| `amount-badge-glow` | ChecklistBlock | Amount/unit badge |
| `timer-glow` | FitnessBlock | Timer digit display |
| `day-number-glow` | ItineraryBlock | Day number circle |
| `avatar-glow` | GuestBlock | Avatar ring |

### Design Scales

All blocks follow these standardized scales (defined in `index.css` comments):

| Element | Value | Classes |
|---------|-------|---------|
| Card padding | 20px | `p-5` |
| Card inner gap | 12px | `space-y-3` |
| List item gap | 6px | `space-y-1.5` |
| Card border radius | 14px | `rounded-xl` |
| Header text | 12px uppercase | `text-xs font-semibold uppercase tracking-widest` |
| Body text | 14px relaxed | `text-sm leading-relaxed` |
| Metadata | 12px muted | `text-xs text-muted-foreground` |
| Header icon | 16px | `h-4 w-4 shrink-0` |
| Inline icon | 14px | `h-3.5 w-3.5 shrink-0` |

### Building a New Block (Example)

```tsx
import { BlockWrapper } from './BlockWrapper';
import { BLOCK_LABELS } from '@/lib/block-labels';
import { ListChecks } from 'lucide-react';

export function MyNewBlock({ block }: { block: MyBlockType }) {
  if (!block.items?.length) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      variant="card"
      label="My Block"
      headerIcon={<ListChecks className="h-4 w-4" />}
      headerLabel={BLOCK_LABELS.myBlock}
    >
      <div className="space-y-1.5 stagger-children">
        {block.items.map((item, i) => (
          <div key={i}>
            <div className="hover-lift rounded-lg border border-border/40 p-3">
              <span className="text-sm leading-relaxed">{item.text}</span>
            </div>
            {i < block.items.length - 1 && <div className="fade-divider mt-1.5" />}
          </div>
        ))}
      </div>
    </BlockWrapper>
  );
}
```

---

## Recipe Blocks (Phase 2)

### ChecklistBlock (ingredient + tool_list)

Unified component for ingredient lists and tool lists. Dispatches by `block.type`.

```tsx
<ChecklistBlock
  block={{
    type: 'ingredient',
    blockId: 'block-1',
    items: [
      { name: 'flour', amount: '2', unit: 'cups' },
      { name: 'sugar', amount: '1', unit: 'cup', notes: 'optional' },
    ],
    servings: 4,
  }}
/>
```

**Features:**
- Shared `useCheckedSet` hook for checkbox toggle logic
- Serving size scaler for ingredients (+/- buttons, proportional scaling)
- Checkbox for each item
- Tool list variant shows notes per item

### StepBlock

Step-by-step instructions with progress tracking.

```tsx
<StepBlock
  block={{
    type: 'step',
    blockId: 'block-1',
    steps: [
      { instruction: 'Preheat oven to 350°F', duration: '5 min', timestamp: 120 },
      { instruction: 'Mix dry ingredients', tips: ['Sift flour first'] },
    ],
  }}
  onPlay={(seconds) => seekToTime(seconds)}
/>
```

**Features:**
- Completion checkboxes
- Duration display
- Tips expansion
- Video timestamp links

### NutritionBlock

Displays nutritional information in table format.

```tsx
<NutritionBlock
  block={{
    type: 'nutrition',
    blockId: 'block-1',
    nutrients: [
      { name: 'Calories', amount: '250', unit: 'kcal' },
      { name: 'Protein', amount: '12', unit: 'g', percentDailyValue: 24 },
    ],
    servingSize: '1 cup (240g)',
  }}
/>
```

## Technical Blocks (Phase 3)

### CodeBlock

Plain monochrome code display with copy functionality.

```tsx
<CodeBlock
  block={{
    type: 'code',
    blockId: 'block-1',
    code: 'const greeting = "Hello, World!";',
    language: 'typescript',
    filename: 'example.ts',
    highlightLines: [1],
  }}
/>
```

**Features:**
- Plain monochrome rendering (no syntax highlighting dependency)
- Language badge or filename header
- Copy to clipboard with feedback
- Line numbers (multi-line only)
- Line highlighting

### TerminalBlock

Command-line display with copy support.

```tsx
<TerminalBlock
  block={{
    type: 'terminal',
    blockId: 'block-1',
    commands: [
      { command: 'npm install', output: 'added 150 packages' },
      { command: 'npm run build' },
    ],
    shell: 'bash',
  }}
/>
```

### FileTreeBlock

Interactive file/folder tree with keyboard navigation.

```tsx
<FileTreeBlock
  block={{
    type: 'file_tree',
    blockId: 'block-1',
    tree: [
      {
        type: 'folder',
        name: 'src',
        children: [
          { type: 'file', name: 'index.ts' },
          { type: 'file', name: 'app.tsx' },
        ],
      },
      { type: 'file', name: 'package.json' },
    ],
  }}
/>
```

**Features:**
- Expandable/collapsible folders
- File type icons
- Keyboard navigation (Enter, Space)
- ARIA tree role for accessibility

## Review Blocks (Phase 4)

### ProConBlock

Split pros/cons display.

```tsx
<ProConBlock
  block={{
    type: 'pro_con',
    blockId: 'block-1',
    pros: [
      { text: 'Fast performance', weight: 'strong' },
      { text: 'Great documentation' },
    ],
    cons: [
      { text: 'Steep learning curve' },
    ],
  }}
/>
```

### RatingBlock

Rating display with stars or progress bar.

```tsx
<RatingBlock
  block={{
    type: 'rating',
    blockId: 'block-1',
    score: 4.5,
    maxScore: 5,
    label: 'Overall Rating',
    breakdown: [
      { category: 'Performance', score: 5 },
      { category: 'Design', score: 4 },
    ],
  }}
/>
```

**Features:**
- Star display for 5-point scales
- Progress bar for larger scales (10, 100)
- Half-star support
- Category breakdown
- Score clamping

### VerdictBlock

Final verdict with recommendations.

```tsx
<VerdictBlock
  block={{
    type: 'verdict',
    blockId: 'block-1',
    verdict: 'Highly Recommended',
    verdictType: 'positive',
    summary: 'Excellent choice for most users.',
    bestFor: ['Power users', 'Developers'],
    notFor: ['Beginners'],
  }}
/>
```

## Travel Blocks (Phase 5)

### LocationBlock

Location display with map links.

```tsx
<LocationBlock
  block={{
    type: 'location',
    blockId: 'block-1',
    name: 'Eiffel Tower',
    address: 'Champ de Mars, Paris',
    coordinates: { lat: 48.8584, lng: 2.2945 },
  }}
/>
```

### ItineraryBlock

Day-by-day travel itinerary.

```tsx
<ItineraryBlock
  block={{
    type: 'itinerary',
    blockId: 'block-1',
    days: [
      {
        day: 1,
        title: 'Arrival Day',
        activities: [
          { time: '10:00', activity: 'Airport pickup', location: 'CDG Airport' },
          { time: '14:00', activity: 'Hotel check-in' },
        ],
      },
    ],
  }}
/>
```

### CostBlock

Cost breakdown with currency formatting.

```tsx
<CostBlock
  block={{
    type: 'cost',
    blockId: 'block-1',
    currency: 'USD',
    items: [
      { name: 'Flight', amount: 450 },
      { name: 'Hotel', amount: 800, perUnit: 'night', quantity: 5 },
    ],
    total: 1250,
  }}
/>
```

## Fitness Blocks

### FitnessBlock (exercise + workout_timer)

Unified component for exercises and workout timers. Dispatches by `block.type`.

```tsx
// Exercise mode
<FitnessBlock
  block={{
    type: 'exercise',
    blockId: 'block-1',
    exercises: [
      { name: 'Push-ups', sets: 3, reps: '10', difficulty: 'beginner' },
      { name: 'Plank', duration: '60s', timestamp: 120 },
    ],
  }}
  onPlay={(seconds) => seekToTime(seconds)}
/>

// Timer mode
<FitnessBlock
  block={{
    type: 'workout_timer',
    blockId: 'block-1',
    intervals: [
      { type: 'work', name: 'High knees', duration: 30 },
      { type: 'rest', name: 'Rest', duration: 10 },
    ],
    rounds: 3,
  }}
/>
```

**Exercise features:** Sets/reps, difficulty badges, demo links, rest periods
**Timer features:** Start/Pause/Reset, visual countdown, interval progress, round counter, completion state

## Education Blocks

### QuizBlock

Interactive quiz with answer reveal.

```tsx
<QuizBlock
  block={{
    type: 'quiz',
    blockId: 'block-1',
    questions: [
      {
        question: 'What is 2 + 2?',
        options: ['3', '4', '5'],
        correctIndex: 1,
        explanation: 'Basic arithmetic.',
      },
    ],
  }}
/>
```

**Features:**
- Answer selection with feedback
- Correct/incorrect styling
- Show/hide answer buttons
- Explanation display
- Disabled state after selection

## Interview Blocks (Phase 7)

### GuestBlock

Guest/interviewee profile display.

```tsx
<GuestBlock
  block={{
    type: 'guest',
    blockId: 'block-1',
    name: 'Jane Doe',
    title: 'CEO',
    company: 'Tech Corp',
    bio: 'Industry veteran with 20 years experience.',
    avatarUrl: 'https://example.com/avatar.jpg',
    socialLinks: [
      { platform: 'twitter', url: 'https://twitter.com/janedoe' },
      { platform: 'linkedin', url: 'https://linkedin.com/in/janedoe' },
    ],
  }}
/>
```

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

## Shared Patterns

### Empty State Handling

All blocks return `null` when their primary data is empty:

```tsx
if (!block.exercises?.length) return null;
if (!block.tree?.length) return null;
```

### Accessibility

All blocks follow accessibility best practices:
- `aria-hidden="true"` on decorative icons
- Proper `role` attributes (tree, treeitem, button)
- `aria-expanded` for expandable sections
- Keyboard navigation support
- Focus-visible styling

### BLOCK_LABELS

Centralized i18n-ready labels in `src/lib/block-labels.ts`:

```typescript
import { BLOCK_LABELS } from '@/lib/block-labels';

// Usage
<span>{BLOCK_LABELS.sets}</span>  // "Sets"
<span>{BLOCK_LABELS.copied}</span> // "Copied!"
```

### Testing Pattern

All block tests follow consistent structure:

```typescript
const createMockBlock = (overrides = {}): BlockType => ({
  type: 'block_type',
  blockId: 'block-1',
  // ... default values
  ...overrides,
});

describe('BlockComponent', () => {
  describe('rendering', () => {...});
  describe('interactions', () => {...});
  describe('accessibility', () => {...});
});
```

---

# Markdown Rendering

## MarkdownContent Component

Shared markdown renderer used across all explainer and chat surfaces. Uses `react-markdown` with `@tailwindcss/typography` prose classes.

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
import { useExplainerChat } from "@/hooks/use-streaming-chat";
import { StreamingText } from "@/components/ui/streaming-text";

function ChatComponent({ memorizedItemId }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useExplainerChat({ memorizedItemId });

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
  phase: StreamPhase;  // "connecting" | "metadata" | "transcript" | "sections" | "done" | "error"
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

## Dev Pages

Two dev-only pages provide component documentation and live previews.

### Design System Page (`/dev/design-system`)

Living style guide for all design tokens and components. All 32 block types are showcased with premium polish applied (stagger animations, hover-lift, glass-surface, dark mode glow effects).

| Section | Contents |
|---------|----------|
| Color Palette | Semantic colors (background, foreground, primary, etc.) with swatches |
| Typography | Text scale (xs-4xl) and font weights |
| Spacing Scale | Tailwind spacing tokens (1-12) with visual boxes |
| Status Indicators | Pending, processing, completed, failed states |
| Category Accents | All 10 category accent colors |
| Content Blocks | All 32 block types with live previews, JSON toggle, and premium polish |
| Category Views | All 10 view components (CodeView, RecipeView, etc.) |

**Verification tips:**
- Toggle dark mode to verify glow effects on badges, timers, avatars, and day numbers
- Stagger animations fire on mount — refresh the page to see entrance animations
- Hover over ingredient items, exercise cards, itinerary activities to verify `hover-lift`

### Video Examples Page (`/dev/video-examples`)

Complete video pages with realistic mock data for all 10 categories.

| Category | Mock Video |
|----------|------------|
| cooking | Gordon Ramsay's Perfect Carbonara |
| coding | React 19 Hooks Complete Tutorial |
| fitness | 30-Min Full Body HIIT Workout |
| travel | 7 Days in Japan Complete Guide |
| education | Quantum Computing Explained |
| podcast | Lex Fridman #400: Naval Ravikant |
| reviews | iPhone 15 Pro Max 6-Month Review |
| gaming | Elden Ring Beginner's Walkthrough |
| diy | Build a Standing Desk from Scratch |
| standard | Understanding the Stock Market 2024 |

### Dev Page Files

| File | Purpose |
|------|---------|
| `pages/dev/DesignSystemPage.tsx` | Design system page |
| `pages/dev/VideoExamplesPage.tsx` | Video examples page |
| `components/dev/design-system/*.tsx` | Token showcase components |
| `components/dev/video-examples/*.tsx` | Video example components |
| `lib/dev/mock-blocks.ts` | Factory functions for all 31 block types |
| `lib/dev/mock-videos.ts` | Mock video data for all 10 categories |

### Production Safety

All dev code has production guards:
```tsx
if (!import.meta.env.DEV) {
  throw new Error('This module should not be imported in production');
}
```

Dev pages are verified to be tree-shaken via:
```bash
grep -r "DesignSystemPage" dist/  # Returns nothing
grep -r "mock-videos" dist/        # Returns nothing
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
| Missing `stagger-children` | Add to list containers with >3 items |
| Muted callout icons | Match icon color to callout `accentColor` |
| Missing dark mode glow | Add glow utility class to colored elements (badges, numbers, avatars) |
| No `hover-lift` on sub-cards | Add to interactive cards-within-cards |
