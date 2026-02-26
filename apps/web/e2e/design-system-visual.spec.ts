/**
 * E2E Visual & Layout Tests for Design System Overhaul
 *
 * Tests layout hierarchy, overflow, responsivity, theme switching,
 * focus rings, and color token correctness.
 */
import { test, expect, type Page } from '@playwright/test';

const DESIGN_SYSTEM_URL = '/dev/design-system';

// Helper: check no horizontal overflow on an element
async function assertNoHorizontalOverflow(page: Page, selector: string) {
  const overflow = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false, overflows: false };
    return {
      found: true,
      overflows: el.scrollWidth > el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    };
  }, selector);
  if (overflow.found) {
    expect(overflow.overflows).toBe(false);
  }
}

test.describe('Design System - Visual & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DESIGN_SYSTEM_URL);
    await expect(page.getByRole('heading', { name: 'Design System' })).toBeVisible();
  });

  // ─────────────────────────────────────────────────────
  // Layout Hierarchy
  // ─────────────────────────────────────────────────────

  test('page has correct layout hierarchy (header > sidebar + main)', async ({ page }) => {
    // Header exists and is sticky
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    const headerPosition = await header.evaluate((el) => getComputedStyle(el).position);
    expect(headerPosition).toBe('sticky');

    // Sidebar nav exists
    const sidebar = page.locator('nav[aria-label="Design system sections"]');
    await expect(sidebar).toBeVisible();

    // Main content area exists
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Sidebar comes before main in DOM
    const sidebarBox = await sidebar.boundingBox();
    const mainBox = await main.boundingBox();
    expect(sidebarBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(sidebarBox!.x).toBeLessThan(mainBox!.x);
  });

  test('all 7 sections exist in correct order', async ({ page }) => {
    const sectionIds = ['colors', 'typography', 'spacing', 'status', 'categories', 'blocks', 'views'];
    for (const id of sectionIds) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }

    // Verify order
    const positions = await Promise.all(
      sectionIds.map(async (id) => {
        const box = await page.locator(`#${id}`).boundingBox();
        return box?.y ?? -1;
      })
    );
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  // ─────────────────────────────────────────────────────
  // Overflow Tests
  // ─────────────────────────────────────────────────────

  test('no horizontal overflow on page body', async ({ page }) => {
    await assertNoHorizontalOverflow(page, 'body');
  });

  test('no horizontal overflow on main content', async ({ page }) => {
    await assertNoHorizontalOverflow(page, 'main');
  });

  test('code blocks handle overflow with scroll', async ({ page }) => {
    // Scroll to blocks section
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Code blocks use a wrapper div with overflow-x-auto around pre
    const codeWrappers = page.locator('.overflow-x-auto');
    const count = await codeWrappers.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const wrapper = codeWrappers.nth(i);
        if (await wrapper.isVisible()) {
          const overflow = await wrapper.evaluate((el) => getComputedStyle(el).overflowX);
          expect(['auto', 'scroll']).toContain(overflow);
        }
      }
    }
  });

  // ─────────────────────────────────────────────────────
  // Theme Toggle
  // ─────────────────────────────────────────────────────

  test('theme toggle switches between light and dark', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /toggle theme/i });
    await expect(themeToggle).toBeVisible();

    // Get initial theme state
    const isDarkInitially = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );

    // Toggle
    await themeToggle.click();
    await page.waitForTimeout(300); // Wait for transition

    const isDarkAfterToggle = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(isDarkAfterToggle).not.toBe(isDarkInitially);

    // Toggle back
    await themeToggle.click();
    await page.waitForTimeout(300);

    const isDarkAfterSecondToggle = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(isDarkAfterSecondToggle).toBe(isDarkInitially);
  });

  test('light mode uses oklch with cool hue (~285)', async ({ page }) => {
    // Ensure light mode
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    if (isDark) {
      await page.getByRole('button', { name: /toggle theme/i }).click();
      await page.waitForTimeout(300);
    }

    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    );
    // oklch format: oklch(98.5% 0.006 285) — hue 285 (cool blue)
    expect(bgColor).toContain('285');
  });

  test('dark mode uses oklch with warm hue (~280)', async ({ page }) => {
    // Ensure dark mode
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    if (!isDark) {
      await page.getByRole('button', { name: /toggle theme/i }).click();
      await page.waitForTimeout(300);
    }

    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    );
    // oklch format: oklch(12% 0.03 280) — hue 280 (warm dark)
    expect(bgColor).toContain('280');
  });

  // ─────────────────────────────────────────────────────
  // Color Grouping
  // ─────────────────────────────────────────────────────

  test('color palette shows grouped sections', async ({ page }) => {
    const colorSection = page.locator('#colors');
    await expect(colorSection.getByRole('heading', { name: 'Base' })).toBeVisible();
    await expect(colorSection.getByRole('heading', { name: 'Interactive' })).toBeVisible();
    await expect(colorSection.getByRole('heading', { name: 'Semantic' })).toBeVisible();
    await expect(colorSection.getByRole('heading', { name: 'Status' })).toBeVisible();
  });

  // ─────────────────────────────────────────────────────
  // Block Filter
  // ─────────────────────────────────────────────────────

  test('block search filter works', async ({ page }) => {
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const filterInput = page.getByPlaceholder('Filter blocks by name or type...');
    await expect(filterInput).toBeVisible();

    // Filter to "code"
    await filterInput.fill('code');
    await page.waitForTimeout(200);

    // Should show count
    await expect(page.getByText(/\d+ of \d+/)).toBeVisible();

    // Clear filter
    await filterInput.fill('');
    await page.waitForTimeout(200);
  });

  test('block filter with no results shows message', async ({ page }) => {
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const filterInput = page.getByPlaceholder('Filter blocks by name or type...');
    await filterInput.fill('xyznonexistent');
    await page.waitForTimeout(200);

    await expect(page.getByText(/no blocks match/i)).toBeVisible();
  });

  // ─────────────────────────────────────────────────────
  // Responsivity
  // ─────────────────────────────────────────────────────

  test('responsive: content readable at 768px width', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(DESIGN_SYSTEM_URL);
    await page.waitForTimeout(500);

    // Main content should still be visible
    await expect(page.getByRole('heading', { name: 'Design System' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Color Palette' })).toBeVisible();

    // Sidebar should be hidden at tablet width
    const sidebar = page.locator('nav[aria-label="Design system sections"]');
    await expect(sidebar).toBeHidden();

    // No horizontal overflow
    await assertNoHorizontalOverflow(page, 'body');
  });

  test('responsive: content readable at 1280px width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DESIGN_SYSTEM_URL);
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: 'Design System' })).toBeVisible();

    // Sidebar should be visible at desktop width
    const sidebar = page.locator('nav[aria-label="Design system sections"]');
    await expect(sidebar).toBeVisible();

    await assertNoHorizontalOverflow(page, 'body');
  });

  test('responsive: block cards adapt to viewport width', async ({ page }) => {
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // At full width, block cards should be in grid
    // Prefer data-slot or semantic selectors over fragile class substring matches
    const blockCards = page.locator('#blocks [data-slot="card"], #blocks .rounded-xl');
    const cardCount = await blockCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Cards should not overflow their container
    const firstCard = blockCards.first();
    if (await firstCard.isVisible()) {
      const mainBox = await page.locator('main').boundingBox();
      const cardBox = await firstCard.boundingBox();
      if (mainBox && cardBox) {
        expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(mainBox.x + mainBox.width + 2);
      }
    }
  });

  // ─────────────────────────────────────────────────────
  // Focus & Keyboard Navigation
  // ─────────────────────────────────────────────────────

  test('sidebar buttons are keyboard navigable', async ({ page }) => {
    const sidebar = page.locator('nav[aria-label="Design system sections"]');
    const firstButton = sidebar.getByRole('button').first();

    await firstButton.focus();
    await expect(firstButton).toBeFocused();

    // Tab to next button
    await page.keyboard.press('Tab');
    const secondButton = sidebar.getByRole('button').nth(1);
    await expect(secondButton).toBeFocused();
  });

  test('theme toggle has visible focus ring', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /toggle theme/i });
    await themeToggle.focus();
    await expect(themeToggle).toBeFocused();

    // Check that focus styling is applied (ring or outline)
    const hasRing = await themeToggle.evaluate((el) => {
      const style = getComputedStyle(el);
      return (
        style.outlineStyle !== 'none' ||
        style.boxShadow.includes('ring') ||
        style.boxShadow !== 'none'
      );
    });
    expect(hasRing).toBe(true);
  });

  // ─────────────────────────────────────────────────────
  // Card Component Styling
  // ─────────────────────────────────────────────────────

  test('cards have shadow and hover elevation', async ({ page }) => {
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const card = page.locator('[data-slot="card"]').first();
    if (await card.isVisible()) {
      const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(shadow).not.toBe('none');
    }
  });

  // ─────────────────────────────────────────────────────
  // Category Views
  // ─────────────────────────────────────────────────────

  test('category view selector renders all 10 categories', async ({ page }) => {
    const viewSection = page.locator('#views');
    await viewSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const categories = [
      'cooking', 'coding', 'travel', 'reviews', 'fitness',
      'education', 'podcast', 'diy', 'gaming', 'standard'
    ];

    for (const cat of categories) {
      await expect(viewSection.getByRole('button', { name: new RegExp(cat, 'i') })).toBeVisible();
    }
  });

  test('switching category view updates preview', async ({ page }) => {
    const viewSection = page.locator('#views');
    await viewSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Click coding view
    await viewSection.getByRole('button', { name: /coding/i }).click();
    await page.waitForTimeout(300);

    // Should show coding-related content
    await expect(viewSection.getByText(/coding view/i)).toBeVisible();
  });

  // ─────────────────────────────────────────────────────
  // All 31 Blocks Render
  // ─────────────────────────────────────────────────────

  test('all block groups render without errors', async ({ page }) => {
    await page.locator('#blocks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const expectedGroups = [
      'Universal Blocks',
      'New Universal Blocks',
      'Cooking Blocks',
      'Coding Blocks',
      'Travel Blocks',
      'Review Blocks',
      'Fitness Blocks',
      'Education Blocks',
      'Podcast Blocks',
      'Special Callouts',
    ];

    for (const groupName of expectedGroups) {
      await expect(page.getByText(groupName).first()).toBeVisible();
    }

    // No React error boundaries or error messages
    const hasReactError = await page.evaluate(
      () => document.querySelector('#react-error-overlay') !== null
    );
    expect(hasReactError).toBe(false);
  });

  // ─────────────────────────────────────────────────────
  // No Console Errors
  // ─────────────────────────────────────────────────────

  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(DESIGN_SYSTEM_URL);
    await page.waitForTimeout(1000);

    // Filter out known non-critical errors (favicon 404, auth 401 from background API calls)
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
});
