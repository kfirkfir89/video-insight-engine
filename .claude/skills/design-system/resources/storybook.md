# Storybook Setup

Component documentation with Storybook. **Not currently configured** in this project.

<rules>
- ALWAYS show all CVA variants in stories when documenting a component (incomplete documentation if skipped)
- ALWAYS include dark mode preview and accessibility annotations (misses theme/a11y issues)
- ALWAYS use `tags: ["autodocs"]` for automatic documentation generation (manual docs drift)
- NEVER create stories without argTypes for variant props (controls panel will be empty)
</rules>

---

## Installation (When Needed)

```bash
cd apps/web
npx storybook@latest init
```

Configure `.storybook/main.ts` with `stories: ["../src/**/*.stories.@(js|jsx|ts|tsx|mdx)"]`, framework `@storybook/react-vite`, and addons: `@storybook/addon-essentials`, `@storybook/addon-a11y`, `@chromatic-com/storybook`.

---

## Story Pattern

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "destructive", "outline", "secondary", "ghost", "link"] },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: "Button", variant: "default" } };
export const Destructive: Story = { args: { children: "Delete", variant: "destructive" } };
```

---

## Edge Cases

- **Custom non-shadcn components**: Still document them with stories, but ensure they follow the same CVA variant pattern for consistency.
- **Theme-dependent components**: Add a theme decorator to toggle light/dark in the Storybook toolbar using `@storybook/addon-themes`.

---

## Rules Summary

When Storybook is set up, every component story must show all CVA variants, include dark mode previews, add accessibility annotations via the a11y addon, and use `autodocs` for automatic documentation. Use `argTypes` with `control: "select"` for all variant props. Include loading and error states in stories for completeness.
