# State Management Guide

> **Remote state vs Local state** - The most important distinction in React SPAs.

---

## State Categories

| Type             | Example                           | Solution        | Persistence  |
| ---------------- | --------------------------------- | --------------- | ------------ |
| **Remote State** | User data, videos, folders        | React Query     | API cache    |
| **Local State**  | Auth tokens, theme, UI prefs      | Zustand         | localStorage |
| **UI State**     | Modal open, loading               | useState        | Ephemeral    |
| **Form State**   | Input values, validation          | React Hook Form | Ephemeral    |
| **URL State**    | Filters, pagination, current view | URL params      | Shareable    |

### Key Principle

> **Don't duplicate remote state in local state.**
> React Query is your cache. Use it directly.

---

## Remote State (React Query)

React Query is an **async data cache manager**. It handles fetching, caching, synchronization, and background updates for data from your API.

### Setup

```bash
pnpm add @tanstack/react-query
```

```tsx
// src/main.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
```

### Query Keys Factory

### DO ✅

```typescript
// src/lib/query-keys.ts
export const queryKeys = {
  // Videos
  videos: {
    all: ["videos"] as const,
    lists: () => [...queryKeys.videos.all, "list"] as const,
    list: (folderId?: string) =>
      [...queryKeys.videos.lists(), { folderId }] as const,
    details: () => [...queryKeys.videos.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.videos.details(), id] as const,
  },

  // User
  user: {
    current: ["user", "current"] as const,
  },

  // Folders
  folders: {
    all: ["folders"] as const,
    list: () => [...queryKeys.folders.all, "list"] as const,
  },
} as const;
```

### Custom Query Hooks

### DO ✅

```typescript
// src/hooks/use-videos.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

// Fetch videos
export function useVideos(folderId?: string) {
  return useQuery({
    queryKey: queryKeys.videos.list(folderId),
    queryFn: () => api.videos.list(folderId),
  });
}

// Fetch single video
export function useVideo(id: string) {
  return useQuery({
    queryKey: queryKeys.videos.detail(id),
    queryFn: () => api.videos.get(id),
    enabled: !!id, // Don't fetch if no id
  });
}

// Add video mutation
export function useAddVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => api.videos.create(url),
    onSuccess: () => {
      // Invalidate and refetch videos list
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    },
  });
}

// Delete video mutation
export function useDeleteVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.videos.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    },
  });
}
```

### Usage in Components

```tsx
function VideoGrid() {
  const { data: videos, isLoading, error } = useVideos();
  const addVideo = useAddVideo();

  if (isLoading) return <VideoGridSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!videos?.length) return <EmptyState />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
```

### Optimistic Updates

### DO ✅

```typescript
export function useToggleMemorize() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ videoId, itemId }: { videoId: string; itemId: string }) =>
      api.memorize.toggle(videoId, itemId),

    // Optimistic update
    onMutate: async ({ videoId, itemId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.videos.detail(videoId),
      });

      // Snapshot previous value
      const previousVideo = queryClient.getQueryData(
        queryKeys.videos.detail(videoId)
      );

      // Optimistically update
      queryClient.setQueryData(
        queryKeys.videos.detail(videoId),
        (old: Video) => ({
          ...old,
          memorizedItems: old.memorizedItems.includes(itemId)
            ? old.memorizedItems.filter((id) => id !== itemId)
            : [...old.memorizedItems, itemId],
        })
      );

      return { previousVideo };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousVideo) {
        queryClient.setQueryData(
          queryKeys.videos.detail(variables.videoId),
          context.previousVideo
        );
      }
    },

    // Always refetch after
    onSettled: (data, error, { videoId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.videos.detail(videoId),
      });
    },
  });
}
```

---

## Local State (Zustand)

Zustand is for **client-only state** that doesn't come from an API: auth tokens, UI preferences, theme, etc.

### Setup

```bash
pnpm add zustand
```

### Auth Store

### DO ✅

```typescript
// src/stores/auth-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) =>
        set({
          user,
          accessToken,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: "vie-auth", // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        accessToken: state.accessToken,
        user: state.user,
      }),
    }
  )
);
```

### UI Store

### DO ✅

```typescript
// src/stores/ui-store.ts
import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  addVideoDialogOpen: boolean;
  selectedFolderId: string | null;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openAddVideoDialog: () => void;
  closeAddVideoDialog: () => void;
  setSelectedFolder: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  addVideoDialogOpen: false,
  selectedFolderId: null,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openAddVideoDialog: () => set({ addVideoDialogOpen: true }),
  closeAddVideoDialog: () => set({ addVideoDialogOpen: false }),
  setSelectedFolder: (id) => set({ selectedFolderId: id }),
}));
```

### Selectors (Prevent Re-renders)

### DO ✅

```typescript
// Use atomic selectors - only re-renders when that specific value changes
const user = useAuthStore((state) => state.user);
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
const logout = useAuthStore((state) => state.logout);

// For multiple values, use useShallow
import { useShallow } from "zustand/react/shallow";

const { user, isAuthenticated } = useAuthStore(
  useShallow((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  }))
);
```

### DON'T ❌

```typescript
// Destructuring entire store - re-renders on ANY change
const { user, accessToken, isAuthenticated, setAuth, logout } = useAuthStore();
```

### Usage Example

```tsx
function Header() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <Button variant="ghost" size="icon" onClick={toggleSidebar}>
        <Menu className="h-5 w-5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">{user?.name}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

---

## Form State (React Hook Form)

### Setup

```bash
pnpm add react-hook-form @hookform/resolvers zod
```

### DO ✅

```tsx
// src/components/AddVideoForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAddVideo } from "@/hooks/use-videos";

const schema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine(
      (url) => url.includes("youtube.com") || url.includes("youtu.be"),
      "Must be a YouTube URL"
    ),
});

type FormValues = z.infer<typeof schema>;

export function AddVideoForm({ onSuccess }: { onSuccess?: () => void }) {
  const addVideo = useAddVideo();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { url: "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      await addVideo.mutateAsync(values.url);
      form.reset();
      onSuccess?.();
    } catch (error) {
      form.setError("url", {
        message: "Failed to add video. Please try again.",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>YouTube URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={addVideo.isPending} className="w-full">
          {addVideo.isPending ? "Adding..." : "Add Video"}
        </Button>
      </form>
    </Form>
  );
}
```

---

## URL State

For shareable, bookmarkable state like filters and pagination.

### DO ✅

```tsx
import { useSearchParams } from "react-router-dom";

function VideoList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const folderId = searchParams.get("folder") || undefined;
  const status = searchParams.get("status") || undefined;

  const { data: videos } = useVideos({ folderId, status });

  const setFilter = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      if (value) {
        prev.set(key, value);
      } else {
        prev.delete(key);
      }
      return prev;
    });
  };

  return (
    <div>
      <Select
        value={status || "all"}
        onValueChange={(v) => setFilter("status", v === "all" ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
        </SelectContent>
      </Select>

      <VideoGrid videos={videos} />
    </div>
  );
}
```

---

## Combining React Query + Zustand

Zustand holds local state that can drive React Query queries:

### DO ✅

```typescript
// Zustand holds filter state
const useFilterStore = create((set) => ({
  filters: { status: null, folderId: null },
  setFilter: (key: string, value: string | null) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
}));

// React Query uses Zustand state in query key
export function useFilteredVideos() {
  const filters = useFilterStore((s) => s.filters);

  return useQuery({
    queryKey: queryKeys.videos.list(filters), // Re-fetches when filters change
    queryFn: () => api.videos.list(filters),
  });
}
```

---

## WebSocket Integration

Update React Query cache from WebSocket events:

### DO ✅

```typescript
// src/hooks/use-video-status.ts
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/query-keys";

export function useVideoStatusSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket(`${import.meta.env.VITE_WS_URL}/status`);

    ws.onmessage = (event) => {
      const { videoId, status } = JSON.parse(event.data);

      // Update video in cache
      queryClient.setQueryData(
        queryKeys.videos.detail(videoId),
        (old: Video | undefined) => (old ? { ...old, status } : old)
      );

      // Also update in list
      queryClient.setQueryData(
        queryKeys.videos.list(),
        (old: Video[] | undefined) =>
          old?.map((v) => (v.id === videoId ? { ...v, status } : v))
      );
    };

    return () => ws.close();
  }, [queryClient]);
}
```

---

## Anti-Patterns

### DON'T ❌ - Duplicate remote state in local state

```typescript
// WRONG - now you have stale data to manage
const { data: videos } = useVideos();
const [localVideos, setLocalVideos] = useState([]);

useEffect(() => {
  if (videos) setLocalVideos(videos);
}, [videos]);
```

### DON'T ❌ - Put everything in global state

```typescript
// WRONG - mixing concerns
const useStore = create((set) => ({
  modalOpen: false, // Should be local useState
  searchTerm: "", // Should be URL param
  videos: [], // Should be React Query
  user: null, // OK in Zustand
}));
```

### DON'T ❌ - Store derived state

```typescript
// WRONG - just compute it!
const [videos, setVideos] = useState([]);
const [filteredVideos, setFilteredVideos] = useState([]);
const [videoCount, setVideoCount] = useState(0);

useEffect(() => {
  setFilteredVideos(videos.filter(...));
  setVideoCount(videos.length);
}, [videos, filter]);

// RIGHT - derive during render
const filteredVideos = videos.filter((v) => v.status === filter);
const videoCount = videos.length;
```

### DON'T ❌ - Fetch in useEffect

```typescript
// WRONG - no caching, no loading states, no error handling
useEffect(() => {
  fetchVideos().then(setVideos);
}, []);

// RIGHT - use React Query
const { data: videos, isLoading, error } = useVideos();
```

---

## State Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         Component                             │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   useState  │    │  useQuery   │    │ useUIStore  │      │
│  │  (UI state) │    │  (remote)   │    │  (global)   │      │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Render                            │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
    Ephemeral          API Cache          Persisted
    (gone on unmount)  (staleTime)        (localStorage)
```

---

## Quick Reference

| What               | Where               | Why                                 |
| ------------------ | ------------------- | ----------------------------------- |
| Modal open/close   | `useState`          | Local, ephemeral                    |
| Form values        | React Hook Form     | Validation, submission              |
| Auth token         | Zustand (persisted) | Needed everywhere, survives refresh |
| User data from API | React Query         | Cached, auto-refetch                |
| Videos list        | React Query         | Cached, invalidation                |
| Sidebar open       | Zustand             | Global UI state                     |
| Current filter     | URL params          | Shareable, bookmarkable             |
| Theme              | Zustand (persisted) | Global, survives refresh            |

---

## File Structure

```
src/
├── stores/
│   ├── auth-store.ts      # Auth state (Zustand)
│   └── ui-store.ts        # UI state (Zustand)
├── hooks/
│   ├── use-videos.ts      # Video queries (React Query)
│   ├── use-folders.ts     # Folder queries (React Query)
│   └── use-video-status.ts # WebSocket subscription
├── lib/
│   ├── api.ts             # API client
│   ├── query-client.ts    # React Query config
│   └── query-keys.ts      # Query key factory
```
