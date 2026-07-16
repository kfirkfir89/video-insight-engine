/**
 * E2E Tests for the Modes Showcase
 *
 * Tests the "Modes" tab on the design system page — the dedicated home for the
 * immersive "enter mode" FlowPlayer runners that were moved out of the
 * Interactive tab. One card is rendered per `FLOW_MODE_REGISTRY` mode.
 *
 * Modes under test: cooking, workout, build, study, explore, practice, listen.
 */
import { test, expect, type Page } from '@playwright/test';

const DESIGN_SYSTEM_URL = '/dev/design-system';

/** Every mode that should have a card in the Modes tab (matches FLOW_MODE_REGISTRY). */
const MODE_IDS = ['cooking', 'workout', 'build', 'study', 'explore', 'practice', 'listen'] as const;

/** Navigate to the design system page and switch to the Modes tab. */
async function goToModesTab(page: Page) {
  await page.goto(DESIGN_SYSTEM_URL);
  // 30s: the design-system route is a huge lazy chunk — a cold Vite dev
  // server can take >5s to transform it (Suspense "Loading page..." flake).
  await expect(
    page.getByRole('heading', { name: 'Design System' }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole('tab', { name: /Modes/i }).click();
  await page.waitForTimeout(300);
  await expect(page.getByRole('heading', { name: 'Enter Modes' })).toBeVisible();
}

test.describe('Modes Showcase', () => {
  test.beforeEach(async ({ page }) => {
    await goToModesTab(page);
  });

  test('renders a card for every flow mode', async ({ page }) => {
    for (const id of MODE_IDS) {
      await expect(page.getByTestId(`showcase-mode-${id}`)).toBeVisible();
    }
  });

  test('every mode card renders a live FlowPlayer with its step counter', async ({ page }) => {
    for (const id of MODE_IDS) {
      const card = page.getByTestId(`showcase-mode-${id}`);
      // The FlowPlayer header always shows a "N/M <noun>" progress counter.
      await expect(card.getByText(/0\/\d+ \w+/)).toBeVisible();
    }
  });

  test('the FlowPlayer enter-mode card no longer appears on the Interactive tab', async ({ page }) => {
    await page.getByRole('tab', { name: /Interactive/i }).click();
    await expect(page.getByRole('heading', { name: 'Interactive Components' })).toBeVisible();
    await expect(page.getByTestId('showcase-flow-player')).toHaveCount(0);
  });
});
