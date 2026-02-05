# Icon System

Project-specific icon mappings and conventions for vie-web.

> **General Lucide patterns:** See [react-vite/resources/lucide.md](../../react-vite/resources/lucide.md) for imports, props, accessibility, and Tailwind integration.

---

## Project Sizing Standards

### Default Sizes by Context

| Context | Size | Classes | Notes |
|---------|------|---------|-------|
| Button icon (with text) | 16px | `h-4 w-4` | Add `mr-2` for left icon |
| Button icon (icon-only) | 16px | `h-4 w-4` | Use with `size="icon"` button |
| Sidebar items | 16px | `h-4 w-4` | Or use `useSidebarTextClasses` |
| Sidebar secondary | 14px | `h-3.5 w-3.5` | Chevrons, status indicators |
| Section headers | 24px | `h-6 w-6` | Feature section icons |
| Empty states | 48-64px | `h-12 w-12` / `h-16 w-16` | Centered with muted color |
| Loading spinner | varies | `h-4 w-4` to `h-8 w-8` | Depends on context |

### Responsive Sidebar Icons

Use `useSidebarTextClasses` hook for user-preference-aware sizing:

```tsx
import { useSidebarTextClasses } from "@/hooks/use-sidebar-text-size";

function SidebarItem() {
  const { mainIconClasses, secondaryIconClasses } = useSidebarTextClasses();

  return (
    <div>
      <Film className={mainIconClasses} />        {/* h-4/h-[18px]/h-6 */}
      <ChevronRight className={secondaryIconClasses} /> {/* h-3.5/h-4/h-5 */}
    </div>
  );
}
```

| User Size | Main Icons | Secondary Icons |
|-----------|------------|-----------------|
| Small | `h-4 w-4` | `h-3.5 w-3.5` |
| Medium | `h-[18px] w-[18px]` | `h-4 w-4` |
| Large | `h-6 w-6` | `h-5 w-5` |

---

## Semantic Icon Mapping

### Status Icons

Use with semantic status colors from `index.css`:

| Status | Icon | Color Class | Animation |
|--------|------|-------------|-----------|
| Pending | `Clock` | `text-status-pending` | none |
| Processing | `Loader2` | `text-status-processing` | `animate-spin` |
| Success/Completed | `CheckCircle` | `text-status-success` | none |
| Error/Failed | `AlertCircle` | `text-status-error` | none |

**StatusIcon Component:**
```tsx
import { StatusIcon } from "@/components/ui/status-icon";

<StatusIcon status="processing" className="h-4 w-4" />
// Handles icon selection, color, and animation automatically
```

### Navigation & Actions

| Action | Icon | Notes |
|--------|------|-------|
| Add/Create | `Plus` | Primary action |
| Delete | `Trash2` | Use with destructive styling |
| Edit | `Pencil` | |
| Close/Dismiss | `X` | Dialogs, panels |
| More options | `MoreVertical` | Dropdown trigger |
| Expand/Collapse | `ChevronRight` / `ChevronDown` | Rotate or swap |
| Back | `ArrowLeft` | |
| External link | `ExternalLink` | Opens new tab |
| Copy | `Copy` / `Check` | Swap on success |
| Search | `Search` | |
| Refresh | `RefreshCw` or `RotateCcw` | |

### Content Types

| Content | Icon | Notes |
|---------|------|-------|
| Video | `Film` | Primary video identifier |
| Play video | `Play` | Overlays, buttons |
| Pause | `Pause` | |
| Folder | `Folder` / `FolderOpen` | Toggle on expand |
| Collection | `Library` or `Folder` | |
| Bookmark | `Bookmark` | Saved items |
| Document | `FileText` | |
| Code | `Code2` or `FileCode` | |
| Link | `Link2` | |
| Quote | `Quote` | Citations, blockquotes |

### Persona Icons

Used for video categorization/personas:

| Persona | Icon | Category Class |
|---------|------|----------------|
| Cooking/Chef | `ChefHat` | `category-cooking` |
| Coding/Tech | `Code2` | `category-coding` |
| Fitness | `Dumbbell` | `category-fitness` |
| Travel | `MapPin` or `Compass` | `category-travel` |
| Reviews | `Star` | `category-reviews` |
| Education | `Book` or `GraduationCap` | `category-education` |
| Podcast | `Radio` | `category-podcast` |
| Gaming | `Gamepad2` | `category-gaming` |
| DIY | `Wrench` or `Hammer` | `category-diy` |
| Standard/Default | `Film` | `category-standard` |

### AI & Chat

| Concept | Icon | Notes |
|---------|------|-------|
| AI/Bot | `Bot` | AI responses |
| AI magic/generate | `Sparkles` | AI-powered features |
| Send message | `Send` | Chat input |
| User message | `User` | Human in chat |
| Thinking/Processing | `Brain` | AI thinking state |
| Suggestion | `Lightbulb` | Tips, hints |

### Block Types (Content Blocks)

| Block Type | Icon | Notes |
|------------|------|-------|
| Summary | `FileText` | |
| Key Points | `ListChecks` | |
| Timestamps | `Clock` | |
| Code snippet | `Code2` | |
| Recipe | `UtensilsCrossed` | |
| Cost breakdown | `DollarSign` | |
| Comparison | `GitCompare` | |
| Achievement | `Trophy` or `Award` | |
| Target/Goal | `Target` | |
| Tip | `Lightbulb` | |
| Warning | `AlertTriangle` | |
| Info | `Info` | |

### Ratings & Feedback

| Concept | Icon | Notes |
|---------|------|-------|
| Rating (full) | `Star` with `fill-current` | |
| Rating (half) | `StarHalf` | |
| Like | `ThumbsUp` | |
| Dislike | `ThumbsDown` | |
| Heart/Favorite | `Heart` | Optional fill |

### UI Chrome

| Element | Icon | Notes |
|---------|------|-------|
| Settings | `Settings` | |
| Theme toggle (light) | `Sun` | |
| Theme toggle (dark) | `Moon` | |
| Menu/Hamburger | `Menu` | |
| Sidebar toggle | `PanelLeft` / `PanelLeftClose` | |
| Drag handle | `GripVertical` | |
| Help | `HelpCircle` | |
| Info | `Info` | |
| Logout | `LogOut` | |

---

## Adding New Icons

When introducing a new icon:

1. **Check existing mappings** - Search this file first
2. **Search codebase** - `grep -r "IconName" apps/web/src`
3. **Find at lucide.dev** - Use official icon names
4. **Add to this mapping** - Document the semantic meaning
5. **Use consistently** - Same icon = same meaning everywhere

### Checklist for New Icon

- [ ] Named import (not dynamic)
- [ ] Documented in appropriate category above
- [ ] Uses Tailwind classes for sizing
- [ ] Color via semantic token or text class
- [ ] Accessible (aria-hidden or sr-only text)
- [ ] Shrink-proof in flex containers (`shrink-0`)

---

## Common Patterns

### Icon + Text Button

```tsx
<Button>
  <Plus className="h-4 w-4 mr-2" />
  Add Video
</Button>
```

### Icon-Only Button

```tsx
<Button variant="ghost" size="icon" aria-label="Delete">
  <Trash2 className="h-4 w-4" />
</Button>
```

### Status with Icon

```tsx
<div className="flex items-center gap-2">
  <StatusIcon status={video.status} />
  <span>{video.title}</span>
</div>
```

### Animated State Change

```tsx
// Copy button with success feedback
const [copied, setCopied] = useState(false);

<Button onClick={handleCopy}>
  {copied ? (
    <Check className="h-4 w-4 text-emerald-500" />
  ) : (
    <Copy className="h-4 w-4" />
  )}
</Button>
```

### Loading Button

```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  ) : (
    <Save className="h-4 w-4 mr-2" />
  )}
  Save
</Button>
```

### Collapsible Section

```tsx
<button onClick={toggle}>
  <ChevronRight
    className={cn(
      "h-4 w-4 transition-transform",
      isOpen && "rotate-90"
    )}
  />
  Section Title
</button>
```

---

## Anti-Patterns

```tsx
// DON'T: Inconsistent icons for same action
<Button><X /></Button>      // Close in component A
<Button><XCircle /></Button> // Close in component B

// DON'T: Missing shrink-0 in flex
<div className="flex">
  <Film className="h-4 w-4" /> {/* May squish */}
  <span className="truncate">Long title...</span>
</div>

// DO: Prevent shrinking
<Film className="h-4 w-4 shrink-0" />

// DON'T: Hardcoded colors
<AlertCircle className="text-red-500" />

// DO: Semantic colors
<AlertCircle className="text-destructive" />
// OR
<AlertCircle className="text-status-error" />
```
