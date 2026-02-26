import { test, expect } from '@playwright/test';

test.describe('Admin Panel Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Set API key in localStorage before loading
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('admin_api_key', 'test-key'));
    await page.reload();
  });

  test('login prompt renders when no API key', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('admin_api_key'));
    await page.reload();
    const form = page.locator('form');
    await expect(form).toBeVisible();
    const input = page.locator('input[type="password"]');
    await expect(input).toBeVisible();
  });

  test('nav header is visible and sticky', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();
    const position = await header.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });

  test('nav links exist for all pages', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav.locator('a')).toHaveCount(4);
    const labels = await nav.locator('a').allTextContents();
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Usage');
    expect(labels).toContain('Health');
    expect(labels).toContain('Alerts');
  });

  test('main content area has proper max-width', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();
    const maxWidth = await main.evaluate((el) => getComputedStyle(el).maxWidth);
    // max-w-7xl = 80rem = 1280px
    expect(maxWidth).toBe('1280px');
  });
});

test.describe('Layout Hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('admin_api_key', 'test-key'));
    await page.reload();
  });

  test('header is before main in DOM order', async ({ page }) => {
    const headerIndex = await page.evaluate(() => {
      const root = document.querySelector('div.min-h-screen');
      if (!root) return -1;
      const children = Array.from(root.children);
      return children.findIndex((c) => c.tagName === 'HEADER');
    });
    const mainIndex = await page.evaluate(() => {
      const root = document.querySelector('div.min-h-screen');
      if (!root) return -1;
      const children = Array.from(root.children);
      return children.findIndex((c) => c.tagName === 'MAIN');
    });
    expect(headerIndex).toBeLessThan(mainIndex);
    expect(headerIndex).toBeGreaterThanOrEqual(0);
  });

  test('no elements overflow the viewport horizontally', async ({ page }) => {
    const overflows = await page.evaluate(() => {
      const vpWidth = document.documentElement.clientWidth;
      const elements = document.querySelectorAll('*');
      const overflowing: string[] = [];
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vpWidth + 2) {
          overflowing.push(`${el.tagName}.${el.className} (right: ${rect.right}, vpWidth: ${vpWidth})`);
        }
      });
      return overflowing;
    });
    expect(overflows).toEqual([]);
  });
});

test.describe('Overflow Checks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('admin_api_key', 'test-key'));
    await page.reload();
  });

  test('body has no horizontal scrollbar', async ({ page }) => {
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('tables are wrapped in overflow containers', async ({ page }) => {
    // Navigate to a page that might have tables
    await page.goto('/usage');
    await page.evaluate(() => localStorage.setItem('admin_api_key', 'test-key'));
    await page.reload();

    const tables = page.locator('table');
    const count = await tables.count();
    for (let i = 0; i < count; i++) {
      const parent = tables.nth(i).locator('..');
      const overflowX = await parent.evaluate((el) => getComputedStyle(el).overflowX);
      expect(['auto', 'scroll', 'hidden']).toContain(overflowX);
    }
  });
});

test.describe('Responsivity', () => {
  test('login form is centered and fits on mobile', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('admin_api_key'));
    await page.reload();

    const form = page.locator('form');
    await expect(form).toBeVisible();
    const box = await form.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      const vpWidth = page.viewportSize()?.width ?? 375;
      // Form should not exceed viewport
      expect(box.x + box.width).toBeLessThanOrEqual(vpWidth + 2);
      // On wider screens, form should have left margin (centered)
      // On mobile (< 400px), form may fill the viewport
      const vpWidth2 = page.viewportSize()?.width ?? 375;
      if (vpWidth2 >= 400) {
        expect(box.x).toBeGreaterThan(0);
      }
    }
  });

  test('nav items are accessible at all viewports', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('admin_api_key', 'test-key'));
    await page.reload();

    const navLinks = page.locator('nav a');
    const count = await navLinks.count();
    expect(count).toBe(4);
    // All nav links should be visible (not hidden behind overflow)
    for (let i = 0; i < count; i++) {
      await expect(navLinks.nth(i)).toBeVisible();
    }
  });

  test('content does not overflow on small screens', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('admin_api_key', 'test-key'));
    await page.reload();

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('page navigation works', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('admin_api_key', 'test-key'));
    await page.reload();

    // Click each nav link and verify URL changes
    await page.click('nav a:has-text("Usage")');
    expect(page.url()).toContain('/usage');

    await page.click('nav a:has-text("Health")');
    expect(page.url()).toContain('/health');

    await page.click('nav a:has-text("Alerts")');
    expect(page.url()).toContain('/alerts');

    await page.click('nav a:has-text("Dashboard")');
    expect(page.url()).toMatch(/\/$/);
  });
});
