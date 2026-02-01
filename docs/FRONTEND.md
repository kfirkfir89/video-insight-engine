# Frontend Development Guide

Complete guide for vie-web frontend development: React, TypeScript, Tailwind v4, shadcn/ui, state management.

---

## Overview

### Tech Stack

| Technology      | Version | Purpose           |
| --------------- | ------- | ----------------- |
| Vite            | 7.x     | Build tool        |
| React           | 19.x    | UI framework      |
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
    │   └── explain.ts
    │
    ├── components/
    │   ├── ui/                   # shadcn components
    │   │
    │   ├── layout/
    │   │   ├── Layout.tsx
    │   │   ├── Header.tsx
    │   │   └── Sidebar.tsx
    │   │
    │   ├── video-detail/
    │   │   ├── VideoDetailLayout.tsx     # Orchestrator (responsive)
    │   │   ├── VideoDetailDesktop.tsx    # Desktop two-column layout
    │   │   ├── VideoDetailMobile.tsx     # Mobile single-column layout
    │   │   ├── VideoHeaderSection.tsx    # Video metadata header
    │   │   ├── video-detail-types.ts     # Shared TypeScript types
    │   │   ├── SectionCard.tsx
    │   │   ├── ContentBlockRenderer.tsx  # Dynamic content blocks
    │   │   ├── blocks/                   # Extracted block components
    │   │   │   ├── BulletsBlock.tsx
    │   │   │   ├── NumberedBlock.tsx
    │   │   │   ├── ExampleBlock.tsx
    │   │   │   └── CalloutBlock.tsx
    │   │   └── views/                    # Persona-specific views
    │   │       ├── CodeView.tsx
    │   │       ├── RecipeView.tsx
    │   │       └── StandardView.tsx
    │   │
    │   ├── sidebar/
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
    │   ├── use-summary-stream.ts     # SSE streaming for video detail
    │   ├── use-processing-manager.ts # Auto-resume & sidebar sync
    │   ├── use-websocket.ts          # Real-time updates
    │   └── use-long-press.ts         # Long press gesture hook
    │
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── VideoPage.tsx
    │   └── MemorizedPage.tsx
    │
    ├── stores/
    │   ├── auth-store.ts
    │   ├── processing-store.ts  # Video processing state
    │   └── ui-store.ts
    │
    └── lib/
        ├── utils.ts
        ├── api.ts
        └── query-keys.ts
```

---

## Routes

| Path             | Page          | Description             |
| ---------------- | ------------- | ----------------------- |
| `/login`         | LoginPage     | Sign in                 |
| `/register`      | RegisterPage  | Sign up                 |
| `/`              | DashboardPage | Two-tab interface       |
| `/video/:id`     | VideoPage     | Video detail + sections |
| `/memorized/:id` | MemorizedPage | Item detail + chat      |

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
  plugins: [react(), tailwindcss()],
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

@custom-variant dark (&:is(.dark *));

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
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>
```

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
