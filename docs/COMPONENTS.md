# Component Library - shadcn/ui

> **Copy-paste components you actually own.** Fully customizable, accessible by default.

> **For theming & CSS setup**, see [STYLING.md](./STYLING.md)

---

## Philosophy

shadcn/ui is NOT a component library you install - it's a collection of components you **copy into your project**. This means:

- ✅ You own the code
- ✅ Full customization freedom
- ✅ No dependency lock-in
- ✅ Radix UI primitives = rock-solid accessibility

---

## Quick Setup

### Install CLI & Initialize

```bash
# Initialize shadcn in your project
pnpm dlx shadcn@latest init

# Answer the prompts:
# ✔ Style: New York (recommended)
# ✔ Base color: Zinc
# ✔ CSS variables: Yes
```

### Add Components

```bash
# Add single component
pnpm dlx shadcn@latest add button

# Add multiple
pnpm dlx shadcn@latest add card input label form

# Add all (not recommended - adds everything)
pnpm dlx shadcn@latest add --all
```

---

## Core Components

### Button

```bash
pnpm dlx shadcn@latest add button
```

```tsx
import { Button } from "@/components/ui/button";

// Variants
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="destructive">Delete</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// States
<Button disabled>Disabled</Button>
<Button className="w-full">Full Width</Button>

// With icon
<Button>
  <PlusIcon className="mr-2 h-4 w-4" />
  Add Item
</Button>

// Loading state
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>
```

### Card

```bash
pnpm dlx shadcn@latest add card
```

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Video Summary</CardTitle>
    <CardDescription>AI-generated summary of your video</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Summary content goes here...</p>
  </CardContent>
  <CardFooter className="flex justify-between">
    <Button variant="ghost">Cancel</Button>
    <Button>Save</Button>
  </CardFooter>
</Card>

// Interactive card
<Card className="cursor-pointer transition-shadow hover:shadow-md">
  <CardContent className="p-6">
    Click me!
  </CardContent>
</Card>
```

### Input & Label

```bash
pnpm dlx shadcn@latest add input label
```

```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Basic input
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@example.com" />
</div>

// With icon
<div className="relative">
  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input className="pl-10" placeholder="Search videos..." />
</div>

// Error state
<div className="space-y-2">
  <Label htmlFor="url">YouTube URL</Label>
  <Input
    id="url"
    className="border-destructive focus-visible:ring-destructive"
    placeholder="https://youtube.com/watch?v=..."
  />
  <p className="text-sm text-destructive">Please enter a valid YouTube URL</p>
</div>

// Disabled
<Input disabled placeholder="Can't edit this" />
```

### Form (React Hook Form Integration)

```bash
pnpm dlx shadcn@latest add form
```

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Define schema
const formSchema = z.object({
  url: z.string().url("Please enter a valid URL").includes("youtube", {
    message: "Must be a YouTube URL",
  }),
});

// Component
function AddVideoForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
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
              <FormDescription>
                Paste a YouTube video URL to generate a summary
              </FormDescription>
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

## Feedback Components

### Toast (Sonner)

```bash
pnpm dlx shadcn@latest add sonner
```

```tsx
// In your root layout
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <>
      <Routes />
      <Toaster />
    </>
  );
}

// Usage anywhere
import { toast } from "sonner";

// Success
toast.success("Video added successfully!");

// Error
toast.error("Failed to process video");

// With description
toast("Video Processing", {
  description: "Your video is being summarized...",
});

// Promise toast (auto-handles loading/success/error)
toast.promise(submitVideo(url), {
  loading: "Processing video...",
  success: "Summary ready!",
  error: "Failed to process video",
});

// Custom action
toast("Video processed", {
  action: {
    label: "View",
    onClick: () => navigate(`/videos/${id}`),
  },
});
```

### Alert

```bash
pnpm dlx shadcn@latest add alert
```

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

// Info alert
<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>
    Processing typically takes 1-2 minutes depending on video length.
  </AlertDescription>
</Alert>

// Success
<Alert className="border-success/50 bg-success/10 text-success">
  <CheckCircle2 className="h-4 w-4" />
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>Your video has been processed.</AlertDescription>
</Alert>

// Destructive/Error
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Could not fetch video transcript. Please try again.
  </AlertDescription>
</Alert>
```

### Dialog

```bash
pnpm dlx shadcn@latest add dialog
```

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>Add Video</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add New Video</DialogTitle>
      <DialogDescription>
        Paste a YouTube URL to generate an AI summary.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      <Input placeholder="https://youtube.com/watch?v=..." />
    </div>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Submit</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>;

// Controlled dialog
const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    {/* ... */}
    <Button onClick={() => setOpen(false)}>Close</Button>
  </DialogContent>
</Dialog>;
```

---

## Navigation Components

### Dropdown Menu

```bash
pnpm dlx shadcn@latest add dropdown-menu
```

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => handleEdit()}>
      <Edit className="mr-2 h-4 w-4" />
      Edit
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleShare()}>
      <Share className="mr-2 h-4 w-4" />
      Share
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      className="text-destructive focus:text-destructive"
      onClick={() => handleDelete()}
    >
      <Trash className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>;
```

### Tabs

```bash
pnpm dlx shadcn@latest add tabs
```

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs defaultValue="summary" className="w-full">
  <TabsList>
    <TabsTrigger value="summary">Summary</TabsTrigger>
    <TabsTrigger value="sections">Sections</TabsTrigger>
    <TabsTrigger value="concepts">Key Concepts</TabsTrigger>
  </TabsList>
  <TabsContent value="summary" className="mt-4">
    <p>Overall video summary...</p>
  </TabsContent>
  <TabsContent value="sections" className="mt-4">
    <SectionsList sections={sections} />
  </TabsContent>
  <TabsContent value="concepts" className="mt-4">
    <ConceptsList concepts={concepts} />
  </TabsContent>
</Tabs>;
```

---

## Data Display

### Badge

```bash
pnpm dlx shadcn@latest add badge
```

```tsx
import { Badge } from "@/components/ui/badge";

// Variants
<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Error</Badge>

// Custom status badges
<Badge className="bg-success/10 text-success border-success/20">
  Completed
</Badge>
<Badge className="bg-warning/10 text-warning border-warning/20">
  Processing
</Badge>
<Badge className="bg-info/10 text-info border-info/20">
  Queued
</Badge>
```

### Skeleton

```bash
pnpm dlx shadcn@latest add skeleton
```

```tsx
import { Skeleton } from "@/components/ui/skeleton";

// Simple skeleton
<Skeleton className="h-4 w-32" />;

// Card skeleton
function VideoCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

// List skeleton
function VideoListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}
```

### Scroll Area

```bash
pnpm dlx shadcn@latest add scroll-area
```

```tsx
import { ScrollArea } from "@/components/ui/scroll-area";

// Scrollable container
<ScrollArea className="h-72 rounded-md border p-4">
  {items.map(item => (
    <div key={item.id} className="py-2">
      {item.title}
    </div>
  ))}
</ScrollArea>

// Horizontal scroll
<ScrollArea className="w-full whitespace-nowrap">
  <div className="flex gap-4 p-4">
    {items.map(item => (
      <Card key={item.id} className="w-64 flex-shrink-0">
        {item.title}
      </Card>
    ))}
  </div>
</ScrollArea>
```

---

## Composed Components

### Video Card (Project-Specific)

```tsx
// src/components/video-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Play, Trash, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    thumbnail?: string;
    status: "queued" | "processing" | "completed" | "failed";
    createdAt: string;
  };
  onDelete?: (id: string) => void;
  onClick?: () => void;
}

const statusConfig = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-warning/10 text-warning" },
  completed: { label: "Ready", className: "bg-success/10 text-success" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
};

export function VideoCard({ video, onDelete, onClick }: VideoCardProps) {
  const status = statusConfig[video.status];

  return (
    <Card
      className={cn(
        "group transition-shadow",
        onClick && "cursor-pointer hover:shadow-md"
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden rounded-t-lg bg-muted">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <Badge className={cn("absolute right-2 top-2", status.className)}>
          {status.label}
        </Badge>
      </div>

      <CardHeader className="p-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-base">
            {video.title}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open on YouTube
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete?.(video.id)}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground">
          Added {new Date(video.createdAt).toLocaleDateString()}
        </p>
      </CardHeader>
    </Card>
  );
}
```

### Empty State

```tsx
// src/components/empty-state.tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Usage
<EmptyState
  icon={<Video className="h-6 w-6 text-muted-foreground" />}
  title="No videos yet"
  description="Add your first YouTube video to get started"
  action={{
    label: "Add Video",
    onClick: () => setDialogOpen(true),
  }}
/>;
```

### Loading Overlay

```tsx
// src/components/loading-overlay.tsx
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}

export function LoadingOverlay({
  loading,
  children,
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
```

---

## Best Practices

### 1. Use `asChild` for Custom Triggers

```tsx
// ✅ Correct - merges props with child
<DialogTrigger asChild>
  <Button>Open</Button>
</DialogTrigger>

// ❌ Wrong - nests button in button
<DialogTrigger>
  <Button>Open</Button>
</DialogTrigger>
```

### 2. Always Handle Loading States

```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading...
    </>
  ) : (
    "Submit"
  )}
</Button>
```

### 3. Compose, Don't Configure

```tsx
// ✅ Compose components together
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
</Card>

// ❌ Don't try to pass everything as props
<Card title="Title" description="..." footer={...} />
```

### 4. Use Semantic Color Variables

```tsx
// ✅ Semantic - adapts to theme
<div className="bg-destructive text-destructive-foreground" />

// ❌ Hardcoded - won't work in dark mode
<div className="bg-red-500 text-white" />
```

### 5. Prevent Layout Shift

```tsx
// ✅ Reserve space for content
<div className="min-h-[400px]">{loading ? <Skeleton /> : <Content />}</div>;

// ❌ Content pops in causing shift
{
  loading ? <Skeleton /> : <Content />;
}
```

---

## Component Checklist for MVP

### Must Have

- [x] Button (variants, loading states)
- [x] Card (video cards, info panels)
- [x] Input + Label (forms)
- [x] Form (validation)
- [x] Dialog (add video modal)
- [x] Toast/Sonner (notifications)
- [x] Badge (status indicators)
- [x] Skeleton (loading states)
- [x] Dropdown Menu (actions)

### Nice to Have

- [ ] Tabs (summary sections)
- [ ] Scroll Area (long content)
- [ ] Alert (info messages)
- [ ] Tooltip (helpful hints)
- [ ] Progress (processing indicator)

### Install All MVP Components

```bash
pnpm dlx shadcn@latest add button card input label form dialog sonner badge skeleton dropdown-menu
```

---

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Lucide Icons](https://lucide.dev/icons)
