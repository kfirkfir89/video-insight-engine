# Implementation Track 2: vie-web (React Frontend)

> **Parallel Track** - Can run simultaneously with other tracks.
> **Prerequisite:** [IMPL-00-SHARED.md](./IMPL-00-SHARED.md) complete.

---

## Overview

| What        | Details                                                  |
| ----------- | -------------------------------------------------------- |
| **Service** | vie-web                                                  |
| **Tech**    | React 19 + Vite 6 + TypeScript + Tailwind v4 + shadcn/ui |
| **Port**    | 5173                                                     |
| **Role**    | User interface                                           |

### Design Resources

| Resource                          | Description                                   |
| --------------------------------- | --------------------------------------------- |
| [STYLING.md](../STYLING.md)       | Tailwind v4 theme, colors, spacing, dark mode |
| [COMPONENTS.md](../COMPONENTS.md) | shadcn/ui component patterns and usage        |
| [STATE.md](../STATE.md)           | Zustand + React Query state management        |

---

## Phase 1: Project Setup

### 1.1 Create Vite Project

```bash
cd apps
pnpm create vite web --template react-ts
cd web
```

### 1.2 Install Dependencies

- [ ] Core dependencies

```bash
# React Query + Router + State
pnpm add @tanstack/react-query react-router-dom zustand

# Tailwind v4 + shadcn utilities
pnpm add tailwindcss @tailwindcss/vite
pnpm add clsx tailwind-merge class-variance-authority
pnpm add tw-animate-css

# Icons + Forms
pnpm add lucide-react react-hook-form @hookform/resolvers zod
pnpm add -D @types/node
```

- [ ] Initialize shadcn/ui

```bash
pnpm dlx shadcn@latest init
```

When prompted:

- Style: **New York**
- Base color: **Zinc**
- CSS variables: **Yes**

- [ ] Add essential components

```bash
pnpm dlx shadcn@latest add button card input label form dialog sonner badge skeleton dropdown-menu tabs scroll-area alert
```

### 1.3 Configure Vite

- [ ] Update `vite.config.ts`

```typescript
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
});
```

### 1.4 Configure TypeScript Paths

- [ ] Update `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] Update `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 1.5 Setup CSS (Tailwind v4)

- [ ] Update `src/index.css` (Tailwind v4 CSS-first approach)

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* ═══════════════════════════════════════════════════
     DESIGN TOKENS - Video Insight Engine Theme
     ═══════════════════════════════════════════════════ */

  /* Base Colors (OKLCH for better color mixing) */
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(14.1% 0.005 285.82);

  /* Card & Popover */
  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(14.1% 0.005 285.82);
  --color-popover: oklch(100% 0 0);
  --color-popover-foreground: oklch(14.1% 0.005 285.82);

  /* Primary - Brand color */
  --color-primary: oklch(20.5% 0.015 285.82);
  --color-primary-foreground: oklch(98.5% 0 0);

  /* Secondary */
  --color-secondary: oklch(96.7% 0.001 285.82);
  --color-secondary-foreground: oklch(21% 0.006 285.82);

  /* Muted */
  --color-muted: oklch(96.7% 0.001 285.82);
  --color-muted-foreground: oklch(55.2% 0.014 285.82);

  /* Accent */
  --color-accent: oklch(96.7% 0.001 285.82);
  --color-accent-foreground: oklch(21% 0.006 285.82);

  /* Semantic Colors */
  --color-destructive: oklch(57.7% 0.245 27.33);
  --color-success: oklch(59.6% 0.145 163.22);
  --color-warning: oklch(79.5% 0.184 86.05);
  --color-info: oklch(62.3% 0.214 259.53);

  /* Border & Input */
  --color-border: oklch(91.4% 0.004 285.82);
  --color-input: oklch(91.4% 0.004 285.82);
  --color-ring: oklch(20.5% 0.015 285.82);

  /* Radius */
  --radius: 0.625rem;
}

/* ═══════════════════════════════════════════════════
   DARK MODE
   ═══════════════════════════════════════════════════ */
.dark {
  --color-background: oklch(14.1% 0.005 285.82);
  --color-foreground: oklch(98.5% 0 0);

  --color-card: oklch(14.1% 0.005 285.82);
  --color-card-foreground: oklch(98.5% 0 0);
  --color-popover: oklch(14.1% 0.005 285.82);
  --color-popover-foreground: oklch(98.5% 0 0);

  --color-primary: oklch(98.5% 0 0);
  --color-primary-foreground: oklch(20.5% 0.015 285.82);

  --color-secondary: oklch(26.9% 0.006 285.82);
  --color-secondary-foreground: oklch(98.5% 0 0);

  --color-muted: oklch(26.9% 0.006 285.82);
  --color-muted-foreground: oklch(71.2% 0.013 285.82);

  --color-accent: oklch(26.9% 0.006 285.82);
  --color-accent-foreground: oklch(98.5% 0 0);

  --color-destructive: oklch(65.4% 0.222 17.57);

  --color-border: oklch(26.9% 0.006 285.82);
  --color-input: oklch(26.9% 0.006 285.82);
  --color-ring: oklch(83.9% 0.021 285.82);
}

/* ═══════════════════════════════════════════════════
   BASE STYLES
   ═══════════════════════════════════════════════════ */
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

---

## Phase 2: Project Structure

### 2.1 Create Directories

```bash
mkdir -p src/{api,components,hooks,pages,stores,types,lib}
mkdir -p src/components/{ui,layout,folders,videos,memorize}
```

### 2.2 Directory Structure

```
src/
├── main.tsx
├── App.tsx
├── index.css
├── api/
│   ├── client.ts           # Fetch wrapper
│   ├── auth.ts
│   ├── folders.ts
│   ├── videos.ts
│   └── memorize.ts
├── components/
│   ├── ui/                 # shadcn/ui components (auto-generated)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── Layout.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── theme-provider.tsx  # Dark mode support
│   ├── theme-toggle.tsx
│   ├── videos/
│   │   ├── VideoGrid.tsx
│   │   ├── VideoCard.tsx
│   │   └── AddVideoDialog.tsx
│   └── empty-state.tsx
├── hooks/
│   ├── use-videos.ts       # Video queries (React Query)
│   ├── use-folders.ts      # Folder queries
│   └── use-video-status.ts # WebSocket subscription
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── DashboardPage.tsx
│   └── VideoPage.tsx
├── stores/
│   ├── auth-store.ts       # Auth state (Zustand + persist)
│   └── ui-store.ts         # UI state (Zustand)
├── types/
│   └── index.ts
└── lib/
    ├── utils.ts            # cn() helper (auto-generated by shadcn)
    ├── query-client.ts     # React Query config
    └── query-keys.ts       # Query key factory
```

---

## Phase 3: Core Infrastructure

### 3.1 Utils (Auto-generated by shadcn)

> **Note:** `src/lib/utils.ts` is auto-generated when you run `shadcn init`.

```typescript
// src/lib/utils.ts (reference - auto-generated)
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 3.2 Theme Provider

- [ ] Create `src/components/theme-provider.tsx`

```tsx
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vie-theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
```

- [ ] Create `src/components/theme-toggle.tsx`

```tsx
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

### 3.3 Types

- [ ] Create `src/types/index.ts`

```typescript
// ═══════════════════════════════════════════════════
// Types (mirrors @vie/types for frontend)
// ═══════════════════════════════════════════════════

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type FolderType = "summarized" | "memorized";

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface Video {
  id: string;
  videoSummaryId: string;
  youtubeId: string;
  title: string;
  channel: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  status: ProcessingStatus;
  folderId: string | null;
  createdAt: string;
}

export interface Section {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  summary: string;
  bullets: string[];
}

export interface Concept {
  id: string;
  name: string;
  definition: string | null;
  timestamp: string | null;
}

export interface VideoSummary {
  tldr: string;
  keyTakeaways: string[];
  sections: Section[];
  concepts: Concept[];
}

export interface Folder {
  id: string;
  name: string;
  type: FolderType;
  parentId: string | null;
  path: string;
  level: number;
  color: string | null;
  icon: string | null;
}

export interface WebSocketEvent {
  type: string;
  payload: Record<string, unknown>;
}
```

---

### 3.3 API Client

- [ ] Create `src/api/client.ts`

```typescript
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = localStorage.getItem("accessToken");
  }
  return accessToken;
}

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) return false;

    const data = await res.json();
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getAccessToken();

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
    credentials: "include",
  });

  // Handle 401 - try refresh
  if (res.status === 401 && token) {
    const refreshed = await refreshToken();
    if (refreshed) {
      // Retry request with new token
      return request(endpoint, options);
    }
    // Refresh failed - clear auth
    setAccessToken(null);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(res.status, error.message, error.error);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}
```

---

### 3.4 Auth API

- [ ] Create `src/api/auth.ts`

```typescript
import { request, setAccessToken } from "./client";
import type { AuthResponse, User } from "@/types";

export const authApi = {
  async register(
    email: string,
    password: string,
    name: string
  ): Promise<AuthResponse> {
    const data = await request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async logout(): Promise<void> {
    await request("/auth/logout", { method: "POST" });
    setAccessToken(null);
  },

  async getMe(): Promise<User> {
    return request<User>("/auth/me");
  },
};
```

---

### 3.5 Videos API

- [ ] Create `src/api/videos.ts`

```typescript
import { request } from "./client";
import type { Video, VideoSummary } from "@/types";

export const videosApi = {
  async list(folderId?: string): Promise<{ videos: Video[] }> {
    const params = folderId ? `?folderId=${folderId}` : "";
    return request(`/videos${params}`);
  },

  async get(
    id: string
  ): Promise<{ video: Video; summary: VideoSummary | null }> {
    return request(`/videos/${id}`);
  },

  async create(
    url: string,
    folderId?: string
  ): Promise<{ video: Video; cached: boolean }> {
    return request("/videos", {
      method: "POST",
      body: JSON.stringify({ url, folderId }),
    });
  },

  async delete(id: string): Promise<void> {
    await request(`/videos/${id}`, { method: "DELETE" });
  },
};
```

---

### 3.6 Query Client Setup

- [ ] Create `src/lib/query-client.ts`

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

---

### 3.7 Query Keys Factory

- [ ] Create `src/lib/query-keys.ts`

```typescript
// Query key factory for type-safe cache management
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

  // Folders
  folders: {
    all: ["folders"] as const,
    list: () => [...queryKeys.folders.all, "list"] as const,
  },

  // User
  user: {
    current: ["user", "current"] as const,
  },
} as const;
```

---

### 3.8 Custom Hooks (React Query)

- [ ] Create `src/hooks/use-videos.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { videosApi } from "@/api/videos";
import { queryKeys } from "@/lib/query-keys";

// Fetch videos list
export function useVideos(folderId?: string) {
  return useQuery({
    queryKey: queryKeys.videos.list(folderId),
    queryFn: () => videosApi.list(folderId),
  });
}

// Fetch single video
export function useVideo(id: string) {
  return useQuery({
    queryKey: queryKeys.videos.detail(id),
    queryFn: () => videosApi.get(id),
    enabled: !!id,
  });
}

// Add video mutation
export function useAddVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => videosApi.create(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    },
  });
}

// Delete video mutation
export function useDeleteVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => videosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    },
  });
}
```

---

### 3.9 Auth Store (Zustand + Persist)

- [ ] Create `src/stores/auth-store.ts`

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/api/auth";
import { setAccessToken } from "@/api/client";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email, password) => {
        const { user, accessToken } = await authApi.login(email, password);
        setAccessToken(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      register: async (email, password, name) => {
        const { user, accessToken } = await authApi.register(
          email,
          password,
          name
        );
        setAccessToken(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      logout: () => {
        authApi.logout().catch(() => {}); // Fire and forget
        setAccessToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          setAccessToken(accessToken);
          const user = await authApi.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          setAccessToken(null);
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: "vie-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    }
  )
);

// Selectors (prevent unnecessary re-renders)
export const useUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
```

---

### 3.10 UI Store (Zustand)

- [ ] Create `src/stores/ui-store.ts`

```typescript
import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  addVideoDialogOpen: boolean;
  selectedFolderId: string | null;

  // Actions
  toggleSidebar: () => void;
  openAddVideoDialog: () => void;
  closeAddVideoDialog: () => void;
  setSelectedFolder: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  addVideoDialogOpen: false,
  selectedFolderId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openAddVideoDialog: () => set({ addVideoDialogOpen: true }),
  closeAddVideoDialog: () => set({ addVideoDialogOpen: false }),
  setSelectedFolder: (id) => set({ selectedFolderId: id }),
}));

// Selectors
export const useSidebarOpen = () => useUIStore((s) => s.sidebarOpen);
export const useSelectedFolder = () => useUIStore((s) => s.selectedFolderId);
```

---

## Phase 4: UI Components

> **Note:** Since we installed shadcn/ui in Phase 1, most UI primitives are already available in `src/components/ui/`. This phase focuses on composing them into project-specific components.

### 4.1 Verify shadcn Components

After running `pnpm dlx shadcn@latest add ...` in Phase 1, you should have:

```
src/components/ui/
├── alert.tsx
├── badge.tsx
├── button.tsx
├── card.tsx
├── dialog.tsx
├── dropdown-menu.tsx
├── form.tsx
├── input.tsx
├── label.tsx
├── scroll-area.tsx
├── skeleton.tsx
├── sonner.tsx (toast)
└── tabs.tsx
```

These are **ready to use**. Import them like:

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
```

---

### 4.2 Layout Component

- [ ] Create `src/components/layout/Layout.tsx`

```tsx
import { ReactNode } from "react";
import { Header } from "./Header";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
```

---

### 4.3 Header Component

- [ ] Create `src/components/layout/Header.tsx`

```tsx
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, logout, isAuthenticated } = useAuthStore();

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🎬</span>
          <span className="text-xl font-bold">Video Insight Engine</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <User className="h-4 w-4" />
                  {user?.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

---

## Phase 5: Pages

### 5.1 Login Page

- [ ] Create `src/pages/LoginPage.tsx`

```tsx
import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Welcome Back</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 5.2 Register Page

- [ ] Create `src/pages/RegisterPage.tsx`

```tsx
import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(email, password, name);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Create Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <p className="text-xs text-muted-foreground">
                8+ characters, uppercase, lowercase, number
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Creating..." : "Create Account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 5.3 Dashboard Page

- [ ] Create `src/pages/DashboardPage.tsx`

```tsx
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { VideoGrid } from "@/components/videos/VideoGrid";
import { AddVideoDialog } from "@/components/videos/AddVideoDialog";
import { Button } from "@/components/ui/button";
import { useVideos, useAddVideo } from "@/hooks/use-videos";
import { useUIStore } from "@/stores/ui-store";
import { Plus, FolderOpen, Brain } from "lucide-react";

type Tab = "summarized" | "memorized";

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("summarized");

  // UI state
  const addVideoDialogOpen = useUIStore((s) => s.addVideoDialogOpen);
  const openAddVideoDialog = useUIStore((s) => s.openAddVideoDialog);
  const closeAddVideoDialog = useUIStore((s) => s.closeAddVideoDialog);

  // Remote state
  const { data: videosData, isLoading } = useVideos();
  const addVideo = useAddVideo();

  const handleAddVideo = async (url: string) => {
    await addVideo.mutateAsync(url);
    closeAddVideoDialog();
  };

  return (
    <Layout>
      {/* Tabs */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "summarized" ? "default" : "outline"}
            onClick={() => setActiveTab("summarized")}
          >
            <FolderOpen size={16} className="mr-2" />
            Summarized
          </Button>
          <Button
            variant={activeTab === "memorized" ? "default" : "outline"}
            onClick={() => setActiveTab("memorized")}
          >
            <Brain size={16} className="mr-2" />
            Memorized
          </Button>
        </div>

        {activeTab === "summarized" && (
          <Button onClick={openAddVideoDialog}>
            <Plus size={16} className="mr-2" />
            Add Video
          </Button>
        )}
      </div>

      {/* Content */}
      {activeTab === "summarized" ? (
        <VideoGrid videos={videosData?.videos || []} isLoading={isLoading} />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Brain size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium">No memorized items yet</h3>
          <p className="text-muted-foreground">
            Memorize sections and concepts from your videos to build your
            knowledge base
          </p>
        </div>
      )}

      {/* Add Video Dialog */}
      <AddVideoDialog
        open={addVideoDialogOpen}
        onClose={closeAddVideoDialog}
        onSubmit={handleAddVideo}
        isLoading={addVideo.isPending}
        error={addVideo.error?.message}
      />
    </Layout>
  );
}
```

---

### 5.4 Video Grid Component

- [ ] Create `src/components/videos/VideoGrid.tsx`

```tsx
import { Link } from "react-router-dom";
import type { Video } from "@/types";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface VideoGridProps {
  videos: Video[];
  isLoading: boolean;
}

export function VideoGrid({ videos, isLoading }: VideoGridProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <h3 className="text-lg font-medium">No videos yet</h3>
        <p className="text-muted-foreground">
          Add your first YouTube video to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}

function VideoCard({ video }: { video: Video }) {
  const statusIcon = {
    pending: <Clock className="text-yellow-500" size={16} />,
    processing: <Loader2 className="animate-spin text-blue-500" size={16} />,
    completed: <CheckCircle className="text-green-500" size={16} />,
    failed: <AlertCircle className="text-red-500" size={16} />,
  };

  return (
    <Link to={`/video/${video.id}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {/* Thumbnail */}
        <div className="aspect-video bg-muted">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title || "Video thumbnail"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl">
              🎬
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            {statusIcon[video.status]}
            <span className="text-xs capitalize text-muted-foreground">
              {video.status}
            </span>
          </div>
          <h3 className="line-clamp-2 font-medium">
            {video.title || "Loading..."}
          </h3>
          {video.channel && (
            <p className="mt-1 text-sm text-muted-foreground">
              {video.channel}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
```

---

### 5.5 Add Video Dialog

- [ ] Create `src/components/videos/AddVideoDialog.tsx`

```tsx
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface AddVideoDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  isLoading: boolean;
  error?: string;
}

export function AddVideoDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
  error,
}: AddVideoDialogProps) {
  const [url, setUrl] = useState("");

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X size={20} />
        </button>

        <h2 className="mb-4 text-xl font-semibold">Add YouTube Video</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Input
            label="YouTube URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            required
          />

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Video"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## Phase 6: App Setup

### 6.1 Main Entry

- [ ] Update `src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

### 6.2 App Router

- [ ] Update `src/App.tsx`

```tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/stores/auth-store";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vie-theme">
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
```

---

## Phase 7: Dockerfile

- [ ] Create `apps/web/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
```

- [ ] Create `apps/web/nginx.conf`

```nginx
server {
    listen 5173;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://vie-api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://vie-api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## Verification Checklist

```bash
# 1. Start dev server
cd apps/web && pnpm dev

# 2. Open in browser
open http://localhost:5173

# 3. Verify pages load
# - /login should show login form
# - /register should show register form
# - / should redirect to /login (not authenticated)

# 4. With API running (IMPL-01-API complete):
# - Register new account
# - Login
# - See dashboard
# - Add a video (submits to API)
# - See video in grid
```

---

## Integration Points

| Service | Integration | Status       |
| ------- | ----------- | ------------ |
| vie-api | REST API    | 🔄 Needs API |
| vie-api | WebSocket   | 🔄 Needs API |

---

## Next Steps

After this track:

1. Uncomment `vie-web` in `docker-compose.yml`
2. Run `docker-compose up -d --build vie-web`
3. Full integration with vie-api for video submission
4. Add WebSocket hook for real-time status updates
5. Build VideoPage for viewing summaries
