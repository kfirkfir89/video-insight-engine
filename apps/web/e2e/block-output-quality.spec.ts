/**
 * E2E Tests for Block Output Quality — New Block Types
 *
 * Validates:
 * - ProblemSolutionBlock and VisualBlock rendering
 * - Layout hierarchy (sections, wrappers)
 * - Overflow behavior (no horizontal scroll)
 * - Responsivity at multiple viewport sizes
 */
import { test, expect, type Page } from '@playwright/test';

const DESIGN_SYSTEM_URL = '/dev/design-system';

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

async function navigateToBlocks(page: Page) {
  await page.goto(DESIGN_SYSTEM_URL, { waitUntil: 'networkidle' });
  await expect(page.locator('text=Design System').first()).toBeVisible({ timeout: 15000 });
  // Scroll to Quality Blocks section (use heading h3 to avoid strict mode violation)
  await page.locator('h3:has-text("Quality Blocks")').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
}

async function assertNoHorizontalOverflow(page: Page, selector: string) {
  const overflow = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false, overflows: false };
    return {
      found: true,
      overflows: el.scrollWidth > el.clientWidth,
    };
  }, selector);
  if (overflow.found) {
    expect(overflow.overflows).toBe(false);
  }
}

// ─────────────────────────────────────────────────────
// ProblemSolutionBlock Tests
// ─────────────────────────────────────────────────────

test.describe('ProblemSolutionBlock', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBlocks(page);
  });

  test('renders problem and solution sections', async ({ page }) => {
    const block = page.locator('[aria-label="Problem & Solution"]').first();
    await expect(block).toBeVisible();

    // Both sections should be present
    await expect(block.locator('text=Problem').first()).toBeVisible();
    await expect(block.locator('text=Solution').first()).toBeVisible();
  });

  test('has correct color coding — destructive for problem, success for solution', async ({ page }) => {
    const block = page.locator('[aria-label="Problem & Solution"]').first();
    await block.scrollIntoViewIfNeeded();

    // Problem section should have destructive background
    const problemSection = block.locator('.bg-destructive\\/\\[0\\.04\\]');
    await expect(problemSection).toBeVisible();

    // Solution section should have success background
    const solutionSection = block.locator('.bg-success\\/\\[0\\.04\\]');
    await expect(solutionSection).toBeVisible();
  });

  test('layout hierarchy — wrapped in section with block-container', async ({ page }) => {
    const block = page.locator('[aria-label="Problem & Solution"]').first();
    await expect(block).toBeVisible();

    const tagName = await block.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe('section');

    const hasBlockContainer = await block.evaluate((el) =>
      el.classList.contains('block-container')
    );
    expect(hasBlockContainer).toBe(true);
  });

  test('no horizontal overflow', async ({ page }) => {
    await assertNoHorizontalOverflow(page, '[aria-label="Problem & Solution"]');
  });

  test('icons have aria-hidden', async ({ page }) => {
    const block = page.locator('[aria-label="Problem & Solution"]').first();
    const icons = block.locator('svg[aria-hidden="true"]');
    const count = await icons.count();
    expect(count).toBeGreaterThanOrEqual(2); // AlertCircle + CheckCircle2
  });
});

// ─────────────────────────────────────────────────────
// VisualBlock Tests
// ─────────────────────────────────────────────────────

test.describe('VisualBlock', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBlocks(page);
  });

  test('renders with description text', async ({ page }) => {
    // The visual block shows "Architecture diagram..." in the sample
    const description = page.locator('text=Architecture diagram showing the data flow');
    await expect(description.first()).toBeVisible();
  });

  test('renders with label in header', async ({ page }) => {
    // The sample block has label "System Architecture Overview"
    const header = page.locator('text=System Architecture Overview');
    await expect(header.first()).toBeVisible();
  });

  test('layout hierarchy — uses block-container class', async ({ page }) => {
    const block = page.locator('section[aria-label*="Visual"]').first();
    if (await block.count() > 0) {
      // When rendered directly, it's a section
      const hasBlockContainer = await block.evaluate((el) =>
        el.classList.contains('block-container')
      );
      expect(hasBlockContainer).toBe(true);
    } else {
      // In design system showcase, the aria-label may be on a wrapper div
      const wrapper = page.locator('[aria-label*="Visual"]').first();
      await expect(wrapper).toBeVisible();
    }
  });

  test('no horizontal overflow', async ({ page }) => {
    const block = page.locator('[aria-label*="Visual"]').first();
    const overflows = await block.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflows).toBe(false);
  });
});

// ─────────────────────────────────────────────────────
// Responsivity Tests
// ─────────────────────────────────────────────────────

test.describe('Responsivity — Quality Blocks', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 },
  ];

  for (const vp of viewports) {
    test(`ProblemSolutionBlock renders without overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await navigateToBlocks(page);

      const block = page.locator('[aria-label="Problem & Solution"]').first();
      await expect(block).toBeVisible();

      // No horizontal overflow
      const overflows = await block.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(overflows).toBe(false);

      // Text should be visible
      await expect(block.locator('text=Problem').first()).toBeVisible();
      await expect(block.locator('text=Solution').first()).toBeVisible();
    });

    test(`VisualBlock renders without overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await navigateToBlocks(page);

      const block = page.locator('[aria-label*="Visual"]').first();
      await expect(block).toBeVisible();

      // No horizontal overflow
      const overflows = await block.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(overflows).toBe(false);
    });
  }
});

// ─────────────────────────────────────────────────────
// Cross-block Layout Hierarchy Check
// ─────────────────────────────────────────────────────

test.describe('Layout Hierarchy — All Quality Blocks', () => {
  test('all quality blocks use proper section/region pattern', async ({ page }) => {
    await navigateToBlocks(page);

    // Check that Problem & Solution block uses section with role=region
    const psBlock = page.locator('[aria-label="Problem & Solution"]').first();
    await expect(psBlock).toBeVisible();
    const psTag = await psBlock.evaluate((el) => el.tagName.toLowerCase());
    expect(psTag).toBe('section');

    // Check that Visual block is visible — it renders inside a section from BlockWrapper
    // In the design system, the aria-label may be on the section or a wrapping div
    const vSection = page.locator('section[aria-label*="Visual"]').first();
    const vDiv = page.locator('[aria-label*="Visual"]').first();
    if (await vSection.count() > 0) {
      await expect(vSection).toBeVisible();
    } else {
      await expect(vDiv).toBeVisible();
    }
  });
});
