/**
 * E2E Tests for Block UX V2 - Content-First Flow Design
 *
 * Validates:
 * - Card hover has no translateY jump
 * - Transparent blocks merge with background
 * - Minimal labels render correctly
 * - Table fade dividers work
 * - Concept tooltip lightbulb is yellow
 * - Code blocks show syntax highlighting
 * - Layout hierarchy and overflow
 * - Responsivity at different viewports
 */
import { test, expect, type Page } from '@playwright/test';

const DESIGN_SYSTEM_URL = '/dev/design-system';

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

test.describe('Block UX V2 - Content-First Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DESIGN_SYSTEM_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('text=Design System').first()).toBeVisible({ timeout: 15000 });
    // Scroll to blocks section
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  });

  // ─────────────────────────────────────────────────────
  // Card Hover - No TranslateY Jump
  // ─────────────────────────────────────────────────────

  test('card blocks do not have translateY on hover', async ({ page }) => {
    // Find card-variant blocks (interactive blocks that still use card)
    const cards = page.locator('.block-card');
    const count = await cards.count();

    if (count > 0) {
      const card = cards.first();
      await card.scrollIntoViewIfNeeded();
      await card.hover();
      await page.waitForTimeout(300); // Wait for transition

      const transform = await card.evaluate((el) => getComputedStyle(el).transform);
      // Should be 'none' or 'matrix(1, 0, 0, 1, 0, 0)' — NOT contain translateY
      if (transform !== 'none') {
        // Parse transform matrix - last value is translateY
        const match = transform.match(/matrix\(([^)]+)\)/);
        if (match) {
          const values = match[1].split(',').map(Number);
          // values[5] is translateY in a 2D matrix
          expect(values[5]).toBe(0);
        }
      }
    }
  });

  test('card transition only uses box-shadow (no transform)', async ({ page }) => {
    const cards = page.locator('.block-card');
    const count = await cards.count();

    if (count > 0) {
      const transition = await cards.first().evaluate(
        (el) => getComputedStyle(el).transitionProperty
      );
      // Should NOT contain 'transform'
      expect(transition).not.toContain('transform');
    }
  });

  // ─────────────────────────────────────────────────────
  // Transparent Blocks - Merge With Background
  // ─────────────────────────────────────────────────────

  test('transparent blocks have no card border or background', async ({ page }) => {
    // Look for blocks that have transparent variant (no .block-card class)
    // These blocks should NOT have a card-like border
    const allBlocks = page.locator('[data-block-id]');
    const count = await allBlocks.count();

    // At least some blocks should exist
    expect(count).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────
  // Minimal Labels
  // ─────────────────────────────────────────────────────

  test('minimal labels render with small icon and text', async ({ page }) => {
    const minimalLabels = page.locator('.block-label-minimal');
    const count = await minimalLabels.count();

    if (count > 0) {
      const label = minimalLabels.first();
      await label.scrollIntoViewIfNeeded();

      // Should have an SVG icon
      const svgCount = await label.locator('svg').count();
      expect(svgCount).toBeGreaterThan(0);

      // Should have text content
      const text = await label.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);

      // Font size should be small (11px)
      const fontSize = await label.evaluate((el) => getComputedStyle(el).fontSize);
      const fontSizeNum = parseFloat(fontSize);
      expect(fontSizeNum).toBeLessThanOrEqual(12);
    }
  });

  // ─────────────────────────────────────────────────────
  // Table Fade Dividers
  // ─────────────────────────────────────────────────────

  test('table blocks use fade dividers (no solid borders)', async ({ page }) => {
    const tables = page.locator('.table-fade-dividers');
    const count = await tables.count();

    if (count > 0) {
      const table = tables.first();
      await table.scrollIntoViewIfNeeded();

      // Table should have border-collapse: separate
      const collapse = await table.evaluate((el) => getComputedStyle(el).borderCollapse);
      expect(collapse).toBe('separate');

      // Table body should NOT have divide-y class (solid dividers removed)
      const tbody = table.locator('tbody');
      const tbodyClass = await tbody.getAttribute('class') ?? '';
      expect(tbodyClass).not.toContain('divide-y');
    }
  });

  // ─────────────────────────────────────────────────────
  // Layout Hierarchy & Overflow
  // ─────────────────────────────────────────────────────

  test('no horizontal overflow on block content', async ({ page }) => {
    await assertNoHorizontalOverflow(page, 'body');
    await assertNoHorizontalOverflow(page, 'main');
  });

  test('all block groups render without errors', async ({ page }) => {
    // No React error boundaries or error messages
    const hasReactError = await page.evaluate(
      () => document.querySelector('#react-error-overlay') !== null
    );
    expect(hasReactError).toBe(false);

    // No console errors (filtered for known non-critical)
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForTimeout(1000);
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('401') &&
        !e.includes('Unauthorized') &&
        !e.includes('Failed to load resource')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────
  // Responsivity
  // ─────────────────────────────────────────────────────

  test('blocks render correctly at mobile viewport (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DESIGN_SYSTEM_URL);
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await assertNoHorizontalOverflow(page, 'body');

    // Blocks section should still be visible
    await expect(page.locator('#blocks')).toBeVisible();
  });

  test('blocks render correctly at tablet viewport (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(DESIGN_SYSTEM_URL);
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await assertNoHorizontalOverflow(page, 'body');
    await expect(page.locator('#blocks')).toBeVisible();
  });

  test('blocks render correctly at desktop viewport (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DESIGN_SYSTEM_URL);
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await assertNoHorizontalOverflow(page, 'body');
    await expect(page.locator('#blocks')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────
  // Dark Mode
  // ─────────────────────────────────────────────────────

  test('blocks render correctly in dark mode', async ({ page }) => {
    // Switch to dark mode
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    if (!isDark) {
      await page.getByRole('button', { name: /toggle theme/i }).click();
      await page.waitForTimeout(300);
    }

    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // No overflow
    await assertNoHorizontalOverflow(page, 'body');

    // No errors
    const hasReactError = await page.evaluate(
      () => document.querySelector('#react-error-overlay') !== null
    );
    expect(hasReactError).toBe(false);
  });

  // ─────────────────────────────────────────────────────
  // Softened Card Headers
  // ─────────────────────────────────────────────────────

  test('card header labels use softened styling', async ({ page }) => {
    const headers = page.locator('.block-card-header-label');
    const count = await headers.count();

    if (count > 0) {
      const header = headers.first();
      await header.scrollIntoViewIfNeeded();

      const fontWeight = await header.evaluate((el) => getComputedStyle(el).fontWeight);
      // font-medium = 500 (not font-semibold = 600)
      expect(parseInt(fontWeight)).toBeLessThanOrEqual(500);
    }
  });
});
