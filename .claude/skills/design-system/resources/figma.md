# Figma Integration

Using Figma MCP tools to translate designs to code.

---

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `get_figma_data` | Fetch design structure, styles, properties |
| `download_figma_images` | Export images/icons from Figma |

---

## Design-to-Token Workflow

### 1. Extract Colors

```
Figma fill color → Find closest token in index.css
#FF6B35 → category-cooking accent
oklch(55% 0.25 29) → --primary
```

### 2. Extract Spacing

```
Figma padding/gap → Tailwind spacing class
16px → p-4 or gap-4
24px → p-6 or gap-6
```

### 3. Extract Typography

```
Figma text style → Tailwind typography
14px/500 → text-sm font-medium
24px/600 → text-2xl font-semibold
```

### 4. Map Components

```
Figma component → shadcn/ui equivalent
Button Primary → <Button variant="default">
Card → <Card>
Modal → <Dialog>
```

---

## Workflow Steps

1. **Get Figma file key** from URL: `figma.com/design/[FILE_KEY]/...`
2. **Fetch structure** with `get_figma_data`
3. **Map styles to tokens** (don't create new ones unless necessary)
4. **Identify components** that match shadcn/ui
5. **Export assets** (icons, images) with `download_figma_images`
6. **Implement** using existing design system

---

## DO NOT

- Create one-off colors not in the token system
- Use arbitrary Tailwind values (`w-[137px]`) unless truly necessary
- Export icons from Figma when Lucide has equivalents
- Replicate Figma structure 1:1 (adapt to React patterns)

---

## Token Mapping Reference

| Figma Token | CSS Variable | Tailwind Class |
|-------------|--------------|----------------|
| Colors/Primary | `--primary` | `bg-primary`, `text-primary` |
| Colors/Background | `--background` | `bg-background` |
| Colors/Muted | `--muted` | `bg-muted`, `text-muted-foreground` |
| Spacing/Small | 8px | `p-2`, `gap-2` |
| Spacing/Medium | 16px | `p-4`, `gap-4` |
| Spacing/Large | 24px | `p-6`, `gap-6` |
| Radius/Default | `--radius` | `rounded-lg` |
