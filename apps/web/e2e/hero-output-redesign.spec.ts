/**
 * E2E tests for VideoHero component — layout, overflow, responsivity, interactions.
 *
 * Tests against the Design System page where VideoHero is rendered with mock data.
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

/** Navigate to design system page and wait for it to fully load. */
async function goToDesignSystem(page: Page) {
  await page.goto(DESIGN_SYSTEM_URL, { waitUntil: 'networkidle' });
  // The page lazy-loads — wait for any heading to appear
  await page.waitForSelector('h1, h2, h3', { timeout: 15000 });
}

/** Navigate to VIE Library tab. */
async function goToVIELibrary(page: Page) {
  await goToDesignSystem(page);
  // Click the VIE Library tab
  const vieTab = page.getByRole('tab', { name: /VIE Library/i });
  await vieTab.waitFor({ state: 'visible', timeout: 10000 });
  await vieTab.click();
  // Wait for VideoHero demo card to appear
  await page.waitForSelector('text=VideoHero', { timeout: 5000 });
}

test.describe('VideoHero — Design System Showcase', () => {
  test.beforeEach(async ({ page }) => {
    await goToVIELibrary(page);
  });

  test('renders title, creator, and duration in collapsed state', async ({ page }) => {
    // VideoHero renders inside VIE Library — text appears inside the hero
    const hero = page.locator('[style*="perspective"]').first();
    await expect(hero.getByText('React Performance Masterclass')).toBeVisible();
    await expect(hero.getByText('Tech Channel')).toBeVisible();
    await expect(hero.getByText('1:04:07')).toBeVisible();
  });

  test('expands on click and shows TLDR + action buttons', async ({ page }) => {
    const hero = page.locator('[style*="perspective"]').first();
    const expandButton = hero.getByRole('button', { name: /expand hero/i });
    await expandButton.click();

    await expect(hero.getByText(/deep-dive into React rendering/)).toBeVisible();
    await expect(hero.getByText('Watch Video')).toBeVisible();
  });

  test('flips to Key Takeaways face', async ({ page }) => {
    const hero = page.locator('[style*="perspective"]').first();
    await hero.getByRole('button', { name: /expand hero/i }).click();

    // Click Key Takeaways button
    await hero.getByText('Key Takeaways').first().click();
    await page.waitForTimeout(600);

    await expect(hero.getByText('Use React DevTools Profiler before optimizing')).toBeVisible();
  });

  test('flips to Overview face and back', async ({ page }) => {
    const hero = page.locator('[style*="perspective"]').first();
    await hero.getByRole('button', { name: /expand hero/i }).click();
    await hero.getByText('Key Takeaways').first().click();
    await page.waitForTimeout(600);
    await hero.getByText('Overview').first().click();
    await page.waitForTimeout(600);

    await expect(hero.getByText(/full React performance toolkit/)).toBeVisible();
    await expect(hero.getByText('Close')).toBeVisible();
  });

  test('Close returns to collapsed state', async ({ page }) => {
    const hero = page.locator('[style*="perspective"]').first();
    await hero.getByRole('button', { name: /expand hero/i }).click();
    await hero.getByText('Key Takeaways').first().click();
    await page.waitForTimeout(600);
    await hero.getByText('Overview').first().click();
    await page.waitForTimeout(600);
    await hero.getByText('Close').click();
    await page.waitForTimeout(600);

    await expect(hero.getByRole('button', { name: /expand hero/i })).toBeVisible();
  });

  test('no horizontal overflow in hero container', async ({ page }) => {
    await assertNoHorizontalOverflow(page, '[style*="perspective"]');
  });

  test('hero container has correct 3D perspective', async ({ page }) => {
    const perspective = await page.evaluate(() => {
      const el = document.querySelector('[style*="perspective"]');
      return el ? (el as HTMLElement).style.perspective : null;
    });
    expect(perspective).toBe('1200px');
  });
});

test.describe('VideoHero — Responsivity', () => {
  const viewports = [
    { name: 'mobile (375px)', width: 375, height: 812 },
    { name: 'tablet (768px)', width: 768, height: 1024 },
    { name: 'desktop (1440px)', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`renders correctly at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goToVIELibrary(page);

      const hero = page.locator('[style*="perspective"]').first();
      await expect(hero.getByText('React Performance Masterclass')).toBeVisible();
      await assertNoHorizontalOverflow(page, 'body');
    });
  }
});

test.describe('Tab Bar — Compact Styling', () => {
  test('tabs use compact padding', async ({ page }) => {
    await goToDesignSystem(page);
    // Go to Interactive tab
    const interactiveTab = page.getByRole('tab', { name: /Interactive/i });
    await interactiveTab.waitFor({ state: 'visible', timeout: 10000 });
    await interactiveTab.click();

    const tablist = page.getByRole('tablist').first();
    if (await tablist.isVisible()) {
      const gap = await tablist.evaluate((el) => getComputedStyle(el).gap);
      expect(parseFloat(gap)).toBeLessThanOrEqual(8);
    }
  });
});

test.describe('VideoHero — Interactive Showcase', () => {
  test('renders in Interactive block showcase core section', async ({ page }) => {
    await goToDesignSystem(page);
    const interactiveTab = page.getByRole('tab', { name: /Interactive/i });
    await interactiveTab.waitFor({ state: 'visible', timeout: 10000 });
    await interactiveTab.click();

    // Filter to core section
    await page.getByText('Core Primitives').first().click();

    await expect(page.getByText('How to Build a REST API with Node.js')).toBeVisible();
    await expect(page.getByText('Dev Academy')).toBeVisible();
  });
});
