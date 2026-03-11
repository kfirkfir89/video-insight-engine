/**
 * UI Components Showcase — Dev Only
 *
 * Showcases shadcn/ui primitives and custom UI components.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('UIShowcase should not be imported in production');
}

import { useState } from 'react';
import { AlertCircle, Info, MoreHorizontal, Settings, User, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusIcon } from '@/components/ui/status-icon';
import { GlassElevated } from '@/components/ui/glass-elevated';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function ShowcaseSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

const SAMPLE_MARKDOWN = `**Bold text** and *italic text* with \`inline code\`.

- First item with a [link](#)
- Second item
- Third item

> A blockquote for emphasis.

\`\`\`js
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`
`;

export function UIShowcase() {
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">UI Components</h2>
        <p className="text-sm text-muted-foreground">
          shadcn/ui primitives and custom components used across the application.
        </p>
      </div>

      {/* Buttons */}
      <ShowcaseSection title="Buttons" description="Button variants and sizes.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon"><Settings className="h-4 w-4" /></Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </ShowcaseSection>

      {/* Badges */}
      <ShowcaseSection title="Badges" description="Badge variants for status and labels.">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </ShowcaseSection>

      {/* Alerts */}
      <ShowcaseSection title="Alerts" description="Alert messages with icon support.">
        <div className="space-y-3 max-w-lg">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>This is a default alert with helpful information.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something went wrong. Please try again.</AlertDescription>
          </Alert>
        </div>
      </ShowcaseSection>

      {/* Card */}
      <ShowcaseSection title="Card" description="Card component with header, content, and footer slots.">
        <div className="max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>A brief description of the card content.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This is the card body. It can contain any content — text, forms, or other components.
              </p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>
        </div>
      </ShowcaseSection>

      {/* Form Inputs */}
      <ShowcaseSection title="Form Inputs" description="Text inputs, textarea, checkbox, and labels.">
        <div className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="demo-input">Text Input</Label>
            <Input id="demo-input" placeholder="Type something..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-textarea">Textarea</Label>
            <Textarea id="demo-textarea" placeholder="Write a longer message..." />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="demo-checkbox"
              checked={checkboxChecked}
              onCheckedChange={(v) => setCheckboxChecked(v === true)}
            />
            <Label htmlFor="demo-checkbox">Accept terms and conditions</Label>
          </div>
        </div>
      </ShowcaseSection>

      {/* Dialogs */}
      <ShowcaseSection title="Dialogs" description="Modal dialog and alert dialog with trigger buttons.">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog Title</DialogTitle>
                <DialogDescription>This is a standard dialog for general content and forms.</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Dialog body content goes here.</p>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Alert Dialog</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the item.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </ShowcaseSection>

      {/* Overlays */}
      <ShowcaseSection title="Overlays" description="Tooltip, popover, and dropdown menu.">
        <div className="flex flex-wrap items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover for Tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open Popover</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Popover Content</h4>
                <p className="text-sm text-muted-foreground">Rich content inside a floating panel.</p>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ShowcaseSection>

      {/* Skeleton */}
      <ShowcaseSection title="Skeleton" description="Loading placeholders for content.">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </ShowcaseSection>

      {/* StatusIcon */}
      <ShowcaseSection title="StatusIcon" description="Video processing status indicators.">
        <div className="flex items-center gap-6">
          {(['pending', 'processing', 'completed', 'failed'] as const).map((status) => (
            <div key={status} className="flex items-center gap-2">
              <StatusIcon status={status} />
              <span className="text-sm capitalize">{status}</span>
            </div>
          ))}
        </div>
      </ShowcaseSection>

      {/* Breadcrumb */}
      <ShowcaseSection title="Breadcrumb" description="Navigation breadcrumb trail.">
        <Breadcrumb
          items={[
            { id: null, label: 'Home' },
            { id: 'videos', label: 'Videos' },
            { id: 'current', label: 'Current Video' },
          ]}
          onNavigate={() => {}}
        />
      </ShowcaseSection>

      {/* GlassElevated */}
      <ShowcaseSection title="GlassElevated" description="Elevated glass surface with real backdrop blur. Max 3-4 per screen.">
        <GlassElevated className="p-6 max-w-sm">
          <h4 className="font-medium text-sm">Elevated Glass Surface</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Used sparingly for sticky nav, hero cards, active states, and modal overlays.
          </p>
        </GlassElevated>
      </ShowcaseSection>

      {/* MarkdownContent */}
      <ShowcaseSection title="MarkdownContent" description="Markdown renderer for LLM-generated content.">
        <div className="max-w-lg rounded-xl border border-border/40 bg-card/80 p-4">
          <MarkdownContent content={SAMPLE_MARKDOWN} />
        </div>
      </ShowcaseSection>
    </div>
  );
}
