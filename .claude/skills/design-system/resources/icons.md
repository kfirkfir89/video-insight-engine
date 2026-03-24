# Icon System

Project-specific icon mappings and conventions for vie-web using lucide-react.

<rules>
- ALWAYS use the semantic icon mapping below — same concept = same icon everywhere (inconsistent UX if violated)
- ALWAYS add `shrink-0` to icons in flex containers (icon squishes on long text if violated)
- ALWAYS use semantic color tokens (`text-destructive`, `text-status-error`) not palette colors (`text-red-500`) (breaks theming)
- ALWAYS use `aria-label` on icon-only buttons or `aria-hidden="true"` on decorative icons (accessibility violation)
- NEVER import custom SVGs when lucide-react has an equivalent (inconsistent icon style across app)
- NEVER mix icons for the same action across components — e.g., use `X` for close everywhere, not `XCircle` somewhere (confusing UX)
</rules>

---

## Sizing by Context

| Context                 | Classes                   | Notes                           |
| ----------------------- | ------------------------- | ------------------------------- |
| Button icon (with text) | `h-4 w-4 mr-2`            |                                 |
| Button icon (icon-only) | `h-4 w-4`                 | Use `size="icon"` button        |
| Sidebar items           | `h-4 w-4`                 | Or `useSidebarTextClasses` hook |
| Sidebar secondary       | `h-3.5 w-3.5`             | Chevrons, status indicators     |
| Section headers         | `h-6 w-6`                 |                                 |
| Empty states            | `h-12 w-12` / `h-16 w-16` | Centered, muted color           |

Sidebar icons support responsive sizing via `useSidebarTextClasses` hook — returns `mainIconClasses` and `secondaryIconClasses` that scale with user preference (small/medium/large).

---

## Semantic Icon Mapping

### Status Icons

| Status     | Icon          | Color                    | Animation      |
| ---------- | ------------- | ------------------------ | -------------- |
| Pending    | `Clock`       | `text-status-pending`    | none           |
| Processing | `Loader2`     | `text-status-processing` | `animate-spin` |
| Success    | `CheckCircle` | `text-status-success`    | none           |
| Error      | `AlertCircle` | `text-status-error`      | none           |

Use `<StatusIcon status="processing" className="h-4 w-4" />` for automatic icon/color/animation selection.

### Navigation & Actions

| Action       | Icon           |     | Action          | Icon                         |
| ------------ | -------------- | --- | --------------- | ---------------------------- |
| Add/Create   | `Plus`         |     | Delete          | `Trash2`                     |
| Edit         | `Pencil`       |     | Close           | `X`                          |
| More options | `MoreVertical` |     | Expand/Collapse | `ChevronRight`/`ChevronDown` |
| Back         | `ArrowLeft`    |     | External link   | `ExternalLink`               |
| Copy         | `Copy`/`Check` |     | Search          | `Search`                     |
| Refresh      | `RefreshCw`    |     |                 |                              |

### Content Types

| Content  | Icon                  |     | Content    | Icon               |
| -------- | --------------------- | --- | ---------- | ------------------ |
| Video    | `Film`                |     | Play/Pause | `Play`/`Pause`     |
| Folder   | `Folder`/`FolderOpen` |     | Bookmark   | `Bookmark`         |
| Document | `FileText`            |     | Code       | `Code2`/`FileCode` |
| Link     | `Link2`               |     | Quote      | `Quote`            |

### Persona/Category Icons

| Persona | Icon              |     | Persona   | Icon                   |
| ------- | ----------------- | --- | --------- | ---------------------- |
| Cooking | `ChefHat`         |     | Coding    | `Code2`                |
| Fitness | `Dumbbell`        |     | Travel    | `MapPin`/`Compass`     |
| Reviews | `Star`            |     | Education | `Book`/`GraduationCap` |
| Podcast | `Radio`           |     | Gaming    | `Gamepad2`             |
| DIY     | `Wrench`/`Hammer` |     | Default   | `Film`                 |

### AI & Chat

`Bot` (AI responses), `Sparkles` (AI features), `Send` (chat input), `User` (human), `Brain` (thinking), `Lightbulb` (suggestions).

### Block Types

`FileText` (summary), `ListChecks` (key points), `Clock` (timestamps), `Code2` (code), `UtensilsCrossed` (recipe), `DollarSign` (cost), `GitCompare` (comparison), `Trophy`/`Award` (achievement), `Target` (goal), `Lightbulb` (tip), `AlertTriangle` (warning), `Info` (info).

### Ratings & Feedback

`Star` with `fill-current` (full), `StarHalf` (half), `ThumbsUp`/`ThumbsDown`, `Heart` (optional fill).

### UI Chrome

`Settings`, `Sun`/`Moon` (theme), `Menu` (hamburger), `PanelLeft`/`PanelLeftClose` (sidebar), `GripVertical` (drag), `HelpCircle` (help), `LogOut`.

---

## Common Patterns

```tsx
// Icon + text button
<Button><Plus className="h-4 w-4 mr-2" />Add Video</Button>

// Icon-only button (MUST have aria-label)
<Button variant="ghost" size="icon" aria-label="Delete">
  <Trash2 className="h-4 w-4" />
</Button>

// Loading button
<Button disabled={isLoading}>
  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
  Save
</Button>

// Collapsible chevron
<ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
```

---

## Adding New Icons

1. Check this mapping first. 2. Search codebase for existing usage. 3. Find at lucide.dev. 4. Add to appropriate category above. Ensure: named import (not dynamic), Tailwind sizing classes, semantic color token, `shrink-0` in flex.

---

## Edge Cases

- **Copy button feedback**: Swap `Copy` to `Check` with `text-emerald-500` on success (this is the one case where a non-semantic color is acceptable for transient feedback).
- **Ratings**: `Star` with `fill-current` for filled stars, plain `Star` for empty. `StarHalf` for half ratings.
- **Sidebar size preference**: When icons appear in the sidebar, always use `useSidebarTextClasses` hook rather than hardcoding sizes, since users can change text size preference.

---

## Rules Summary

All icons come from lucide-react with named imports and Tailwind sizing classes. Every icon must map to a single semantic concept documented above — never use different icons for the same action across components. Use `shrink-0` in flex layouts, semantic color tokens (never palette colors), and `aria-label` on icon-only buttons. The `StatusIcon` component handles status display automatically. Sidebar icons must use `useSidebarTextClasses` for responsive sizing. When adding a new icon, check this mapping, search existing usage, then document the new mapping here.
