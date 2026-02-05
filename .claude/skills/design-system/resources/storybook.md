# Storybook Setup

Component documentation with Storybook.

---

## Current Status

**Not configured** - Storybook is not currently set up in this project.

---

## Future Setup

When Storybook is needed:

### Installation

```bash
cd apps/web
npx storybook@latest init
```

### Configuration

`.storybook/main.ts`:
```ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx|mdx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@chromatic-com/storybook",
  ],
  framework: "@storybook/react-vite",
};

export default config;
```

### Story Pattern

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
  },
};

export const Destructive: Story = {
  args: {
    children: "Delete",
    variant: "destructive",
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus className="h-4 w-4 mr-2" />
        Add Item
      </>
    ),
  },
};
```

---

## Recommended Addons

| Addon | Purpose |
|-------|---------|
| `@storybook/addon-essentials` | Core features (controls, docs, actions) |
| `@storybook/addon-a11y` | Accessibility testing |
| `@storybook/addon-themes` | Theme switching (light/dark) |
| `@chromatic-com/storybook` | Visual regression testing |

---

## Integration with Design System

When documenting components:

1. Show all CVA variants
2. Include dark mode preview
3. Add accessibility annotations
4. Link to token usage
5. Show loading/error states
