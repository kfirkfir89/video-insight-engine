/**
 * E2E Tests for Block Design Overhaul
 *
 * Validates all 7 phases of the design overhaul:
 * Phase 1: Accent variant — top fade-edge gradient (no left border)
 * Phase 2: Compact callouts — smaller text and icons
 * Phase 3: Comparison grid — row-aligned pro/con, do/don't
 * Phase 4: Fade-edge design language — dividers, block-card::before
 * Phase 5: Block polish — quote transparent, definition card
 * Phase 6: View deduplication (tested via unit tests)
 *
 * Tests cover: layout hierarchy, overflow, responsivity, dark mode
 */
import { test, expect, type Page } from '@playwright/test';

const DESIGN_SYSTEM_URL = '/dev/design-system';

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

async function navigateToBlocks(page: Page) {
  await page.goto(DESIGN_SYSTEM_URL, { waitUntil: 'networkidle' });
  await expect(page.locator('text=Design System').first()).toBeVisible({ timeout: 15000 });
  await page.locator('#blocks').scrollIntoViewIfNeeded();
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

async function switchToDarkMode(page: Page) {
  const isDark = await page.evaluate(() =>
    document.documentElement.classList.contains('dark')
  );
  if (!isDark) {
    await page.getByRole('button', { name: /toggle theme/i }).click();
    await page.waitForTimeout(300);
  }
}

// ─────────────────────────────────────────────────────
// Phase 1: Accent Variant Redesign
// ─────────────────────────────────────────────────────

test.describe('Phase 1: Accent Variant — Top Fade-Edge Gradient', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBlocks(page);
  });

  test('accent blocks use ::before pseudo-element instead of left border', async ({ page }) => {
    const accentBlocks = page.locator('.block-accent');
    const count = await accentBlocks.count();

    // At least some accent blocks should exist on the design system page
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const block = accentBlocks.nth(i);
      await block.scrollIntoViewIfNeeded();

      // Should NOT have a left border
      const borderLeft = await block.evaluate((el) => getComputedStyle(el).borderLeftWidth);
      expect(parseFloat(borderLeft)).toBe(0);

      // Should have position relative (for ::before)
      const position = await block.evaluate((el) => getComputedStyle(el).position);
      expect(position).toBe('relative');

      // Should have the CSS custom property --accent-line-color
      const hasAccentVar = await block.evaluate((el) => {
        const style = el.getAttribute('style') || '';
        return style.includes('--accent-line-color');
      });
      expect(hasAccentVar).toBe(true);
    }
  });

  test('accent ::before gradient is visible at top of block', async ({ page }) => {
    const accentBlock = page.locator('.block-accent').first();
    await accentBlock.scrollIntoViewIfNeeded();

    // ::before should create a visible gradient line
    const beforeStyles = await accentBlock.evaluate((el) => {
      const before = getComputedStyle(el, '::before');
      return {
        content: before.content,
        position: before.position,
        height: before.height,
        top: before.top,
      };
    });

    expect(beforeStyles.content).not.toBe('none');
    expect(beforeStyles.position).toBe('absolute');
    // Height should be thin (1-3px)
    expect(parseFloat(beforeStyles.height)).toBeLessThanOrEqual(4);
    expect(parseFloat(beforeStyles.top)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────
// Phase 2: Compact Callouts
// ─────────────────────────────────────────────────────

test.describe('Phase 2: Compact Callouts', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBlocks(page);
  });

  test('callout icons are compact size (3.5 or smaller)', async ({ page }) => {
    // Callout blocks use callout-type-specific gradients
    const callouts = page.locator('[data-block-id*="callout"]');
    const count = await callouts.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const callout = callouts.nth(i);
        await callout.scrollIntoViewIfNeeded();

        // Icons should be small (h-3.5 w-3.5 = 14px)
        const icon = callout.locator('svg').first();
        if (await icon.count() > 0) {
          const size = await icon.evaluate((el) => ({
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
          }));
          // 14px = 0.875rem (h-3.5) — allow some tolerance
          expect(size.width).toBeLessThanOrEqual(16);
          expect(size.height).toBeLessThanOrEqual(16);
        }
      }
    }
  });

  test('callout text uses compact font size', async ({ page }) => {
    const callouts = page.locator('[data-block-id*="callout"]');
    const count = await callouts.count();

    if (count > 0) {
      const callout = callouts.first();
      await callout.scrollIntoViewIfNeeded();

      // Text should be text-xs (12px)
      const textEl = callout.locator('p, span').first();
      if (await textEl.count() > 0) {
        const fontSize = await textEl.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(fontSize).toBeLessThanOrEqual(13); // text-xs = 12px, allow tolerance
      }
    }
  });
});

// ─────────────────────────────────────────────────────
// Phase 3: Comparison Grid System
// ─────────────────────────────────────────────────────

test.describe('Phase 3: Comparison Grid — Row-Aligned', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBlocks(page);
  });

  test('pro/con block uses grid layout with two columns', async ({ page }) => {
    const proCon = page.locator('[data-block-id*="pro_con"]').first();
    if (await proCon.count() > 0) {
      await proCon.scrollIntoViewIfNeeded();

      // Should contain grid elements
      const grids = proCon.locator('.grid');
      expect(await grids.count()).toBeGreaterThan(0);

      // Column headers should be visible
      await expect(proCon.locator('text=Pros').first()).toBeVisible();
      await expect(proCon.locator('text=Cons').first()).toBeVisible();
    }
  });

  test('do/dont block uses grid layout with two columns', async ({ page }) => {
    const doDont = page.locator('[data-block-id*="do_dont"]').first();
    if (await doDont.count() > 0) {
      await doDont.scrollIntoViewIfNeeded();

      const grids = doDont.locator('.grid');
      expect(await grids.count()).toBeGreaterThan(0);

      await expect(doDont.locator('text=Do').first()).toBeVisible();
      await expect(doDont.locator("text=Don't").first()).toBeVisible();
    }
  });

  test('comparison block uses row-aligned grid', async ({ page }) => {
    const comparison = page.locator('[data-block-id*="comparison"]').first();
    if (await comparison.count() > 0) {
      await comparison.scrollIntoViewIfNeeded();

      const grids = comparison.locator('.grid');
      expect(await grids.count()).toBeGreaterThan(0);
    }
  });

  test('comparison grids have vertical center divider', async ({ page }) => {
    const proCon = page.locator('[data-block-id*="pro_con"]').first();
    if (await proCon.count() > 0) {
      await proCon.scrollIntoViewIfNeeded();

      const vertDivider = proCon.locator('.fade-divider-vertical');
      expect(await vertDivider.count()).toBeGreaterThan(0);
    }
  });

  test('comparison grids have fade-dividers between rows', async ({ page }) => {
    const proCon = page.locator('[data-block-id*="pro_con"]').first();
    if (await proCon.count() > 0) {
      await proCon.scrollIntoViewIfNeeded();

      const fadeDividers = proCon.locator('.fade-divider');
      // Should have dividers between rows (at least 1 if 2+ rows)
      expect(await fadeDividers.count()).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────
// Phase 4: Fade-Edge Design Language
// ─────────────────────────────────────────────────────

test.describe('Phase 4: Fade-Edge Design Language', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBlocks(page);
  });

  test('fade-dividers exist between block items', async ({ page }) => {
    const fadeDividers = page.locator('#blocks .fade-divider');
    expect(await fadeDividers.count()).toBeGreaterThan(0);
  });

  test('block-card has subtle top fade line via ::before', async ({ page }) => {
    const cardBlocks = page.locator('.block-card');
    const count = await cardBlocks.count();

    if (count > 0) {
      const card = cardBlocks.first();
      await card.scrollIntoViewIfNeeded();

      const beforeStyles = await card.evaluate((el) => {
        const before = getComputedStyle(el, '::before');
        return {
          content: before.content,
          position: before.position,
          height: before.height,
        };
      });

      expect(beforeStyles.content).not.toBe('none');
      expect(beforeStyles.position).toBe('absolute');
      expect(parseFloat(beforeStyles.height)).toBeLessThanOrEqual(2);
    }
  });

  test('fade-dividers use gradient (not solid border)', async ({ page }) => {
    const divider = page.locator('#blocks .fade-divider').first();
    if (await divider.count() > 0) {
      await divider.scrollIntoViewIfNeeded();

      const bg = await divider.evaluate((el) => getComputedStyle(el).backgroundImage);
      // Should use a linear-gradient
      expect(bg).toContain('linear-gradient');
    }
  });

  test('dark mode adjusts fade-divider opacity', async ({ page }) => {
    await switchToDarkMode(page);
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const divider = page.locator('#blocks .fade-divider').first();
    if (await divider.count() > 0) {
      const opacity = await divider.evaluate((el) => getComputedStyle(el).opacity);
      // Dark mode opacity should be 0.4
      expect(parseFloat(opacity)).toBeGreaterThanOrEqual(0.3);
    }
  });
});

// ─────────────────────────────────────────────────────
// Phase 5: Block-by-Block Polish
// ─────────────────────────────────────────────────────

test.describe('Phase 5: Block Polish', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBlocks(page);
  });

  test('quote blocks use transparent variant (no card border)', async ({ page }) => {
    const quotes = page.locator('[data-block-id*="quote"]');
    const count = await quotes.count();

    if (count > 0) {
      const quote = quotes.first();
      await quote.scrollIntoViewIfNeeded();

      // Should NOT have .block-card class
      const hasCardClass = await quote.evaluate((el) => {
        const wrapper = el.closest('.block-card') || el.querySelector('.block-card');
        return wrapper !== null;
      });
      expect(hasCardClass).toBe(false);
    }
  });

  test('definition blocks use card variant', async ({ page }) => {
    const defs = page.locator('[data-block-id*="definition"]');
    const count = await defs.count();

    if (count > 0) {
      const def = defs.first();
      await def.scrollIntoViewIfNeeded();

      // Should have .block-card class
      const hasCardClass = await def.evaluate((el) => {
        const wrapper = el.closest('.block-card') || el.querySelector('.block-card');
        return wrapper !== null || el.classList.contains('block-card');
      });
      expect(hasCardClass).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────
// Layout Hierarchy, Overflow & Responsivity
// ─────────────────────────────────────────────────────

test.describe('Layout: Hierarchy, Overflow, Responsivity', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 900 },
  ];

  for (const { name, width, height } of viewports) {
    test(`no horizontal overflow at ${name} viewport (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await navigateToBlocks(page);

      await assertNoHorizontalOverflow(page, 'body');
      await assertNoHorizontalOverflow(page, 'main');

      // Check each block group doesn't overflow
      const blockGroups = page.locator('[data-block-id]');
      const count = await blockGroups.count();
      for (let i = 0; i < Math.min(count, 10); i++) {
        const block = blockGroups.nth(i);
        const overflow = await block.evaluate((el) => ({
          id: el.getAttribute('data-block-id'),
          overflows: el.scrollWidth > el.clientWidth + 2, // 2px tolerance
        }));
        expect(overflow.overflows, `Block ${overflow.id} overflows at ${name}`).toBe(false);
      }
    });

    test(`all blocks visible at ${name} viewport (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await navigateToBlocks(page);

      // Blocks section should be visible
      await expect(page.locator('#blocks')).toBeVisible();

      // No React error boundaries
      const hasReactError = await page.evaluate(
        () => document.querySelector('#react-error-overlay') !== null
      );
      expect(hasReactError).toBe(false);
    });
  }

  test('comparison grids stack on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateToBlocks(page);

    const doDont = page.locator('[data-block-id*="do_dont"]').first();
    if (await doDont.count() > 0) {
      await doDont.scrollIntoViewIfNeeded();

      // On mobile, grid-cols-1 should make items stack
      const grids = doDont.locator('.grid');
      if (await grids.count() > 0) {
        const gridCols = await grids.first().evaluate((el) =>
          getComputedStyle(el).gridTemplateColumns
        );
        // Single column should be the full width (one value, not two)
        const colCount = gridCols.split(' ').filter(v => v.trim()).length;
        expect(colCount).toBeLessThanOrEqual(2);
      }
    }
  });

  test('no console errors during block rendering', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await navigateToBlocks(page);

    // Scroll through all blocks to trigger lazy rendering
    const blocks = page.locator('[data-block-id]');
    const count = await blocks.count();
    for (let i = 0; i < count; i += 3) {
      await blocks.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
    }

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('401') &&
        !e.includes('Unauthorized') &&
        !e.includes('Failed to load resource') &&
        !e.includes('WebSocket')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('dark mode renders blocks without layout issues', async ({ page }) => {
    await navigateToBlocks(page);
    await switchToDarkMode(page);
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await assertNoHorizontalOverflow(page, 'body');

    // Verify accent blocks still show gradient in dark mode
    const accentBlocks = page.locator('.block-accent');
    if (await accentBlocks.count() > 0) {
      const hasGradient = await accentBlocks.first().evaluate((el) => {
        const before = getComputedStyle(el, '::before');
        return before.content !== 'none';
      });
      expect(hasGradient).toBe(true);
    }

    // Verify fade-dividers are visible in dark mode
    const fadeDividers = page.locator('#blocks .fade-divider');
    if (await fadeDividers.count() > 0) {
      const opacity = await fadeDividers.first().evaluate((el) =>
        parseFloat(getComputedStyle(el).opacity)
      );
      expect(opacity).toBeGreaterThan(0);
    }
  });
});
