/**
 * E2E Tests for Per-Chapter Views + Concept Tooltips
 *
 * Tests:
 * - Per-chapter view renders different view per chapter when view field present
 * - Backward compat: chapters without view field use global category
 * - Concept tooltips appear inline in paragraph text
 * - Only one concept popover open at a time
 * - Layout hierarchy and overflow checks on video detail page
 */
import { test, expect, mockVideoSummary } from './fixtures';

// Mock summary with per-chapter views
const mockSummaryWithViews = {
  ...mockVideoSummary,
  chapters: [
    {
      id: 'ch-cooking',
      timestamp: '0:00',
      startSeconds: 0,
      endSeconds: 60,
      title: 'Making the Dish',
      isCreatorChapter: true,
      view: 'cooking',
      content: [
        { blockId: 'b1', type: 'paragraph', text: 'This Penca de Maguey recipe is a traditional Mexican dish using Enmoladas and chile paste.' },
        { blockId: 'b2', type: 'ingredient', servings: 4, items: [{ name: 'flour', amount: '2', unit: 'cups' }] },
        { blockId: 'b3', type: 'step', steps: [{ number: 1, instruction: 'Mix dry ingredients' }] },
      ],
    },
    {
      id: 'ch-review',
      timestamp: '1:00',
      startSeconds: 60,
      endSeconds: 120,
      title: 'Product Review',
      isCreatorChapter: true,
      view: 'reviews',
      content: [
        { blockId: 'b4', type: 'paragraph', text: 'This product excels in several areas.' },
        { blockId: 'b5', type: 'pro_con', pros: ['Great taste', 'Affordable'], cons: ['Hard to find'] },
      ],
    },
    {
      id: 'ch-standard',
      timestamp: '2:00',
      startSeconds: 120,
      endSeconds: 180,
      title: 'Conclusion',
      isCreatorChapter: true,
      // No view field — should fallback to global category
      content: [
        { blockId: 'b6', type: 'paragraph', text: 'Final thoughts on the experience.' },
      ],
    },
  ],
  concepts: [
    {
      id: 'c1',
      name: 'Penca de Maguey',
      definition: 'The thick leaf of the maguey (agave) plant, used as a cooking vessel.',
      timestamp: '0:15',
    },
    {
      id: 'c2',
      name: 'Enmoladas',
      definition: 'Corn tortillas dipped in mole sauce, similar to enchiladas.',
      timestamp: '0:45',
    },
  ],
};

test.describe('Per-Chapter Views + Concept Tooltips', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Override the video API mock with our custom summary
    await page.route(/\/api\/videos\/video-1$/, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            video: {
              id: 'video-1',
              videoSummaryId: 'summary-1',
              youtubeId: 'dQw4w9WgXcQ',
              title: 'Mexican Food Vlog',
              channel: 'Food Channel',
              duration: 180,
              thumbnailUrl: null,
              status: 'completed',
              folderId: null,
              createdAt: '2024-01-01T00:00:00Z',
              context: { category: 'cooking', youtubeCategory: 'Howto & Style', tags: [], displayTags: [] },
            },
            summary: mockSummaryWithViews,
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/video/video-1');
    // Wait for the video detail page to load
    await page.waitForSelector('[data-slot="article-chapter"]', { timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────
  // Per-Chapter View Rendering
  // ─────────────────────────────────────────────────────

  test('renders chapters with per-chapter view data', async ({ authenticatedPage: page }) => {
    // All 3 chapters should render
    const chapters = page.locator('[data-slot="article-chapter"]');
    await expect(chapters).toHaveCount(3);
  });

  test('cooking chapter renders ingredient/step blocks', async ({ authenticatedPage: page }) => {
    // The cooking chapter should show ingredient and step blocks
    const firstChapter = page.locator('[data-slot="article-chapter"]').first();
    await expect(firstChapter.getByText('Making the Dish')).toBeVisible();
    // Ingredient block should be present
    await expect(firstChapter.getByText('flour')).toBeVisible();
  });

  test('review chapter renders pro_con block', async ({ authenticatedPage: page }) => {
    const secondChapter = page.locator('[data-slot="article-chapter"]').nth(1);
    await expect(secondChapter.getByText('Product Review')).toBeVisible();
    // Pro/con content should be visible
    await expect(secondChapter.getByText('Great taste')).toBeVisible();
    await expect(secondChapter.getByText('Hard to find')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────
  // Concept Tooltips
  // ─────────────────────────────────────────────────────

  test('concept names are highlighted with dotted underline in paragraph text', async ({ authenticatedPage: page }) => {
    // Look for inline concept triggers (not sidebar concept buttons)
    const conceptTrigger = page.getByRole('button', { name: 'Definition: Penca de Maguey' });
    await expect(conceptTrigger).toBeVisible();

    // Should have dotted underline styling
    const borderBottom = await conceptTrigger.evaluate((el) =>
      getComputedStyle(el).borderBottomStyle
    );
    expect(borderBottom).toBe('dotted');
  });

  test('clicking concept shows definition popover', async ({ authenticatedPage: page }) => {
    const conceptTrigger = page.getByRole('button', { name: 'Definition: Penca de Maguey' });
    await conceptTrigger.click();

    // Popover should appear with definition (scoped to radix popover content)
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover.getByText('The thick leaf of the maguey')).toBeVisible({ timeout: 3000 });
  });

  test('only one concept popover open at a time', async ({ authenticatedPage: page }) => {
    // Open first inline concept
    const trigger1 = page.getByRole('button', { name: 'Definition: Penca de Maguey' });
    await trigger1.click();
    const popoverWrapper = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popoverWrapper.getByText('The thick leaf of the maguey')).toBeVisible({ timeout: 3000 });

    // Open second inline concept
    const trigger2 = page.getByRole('button', { name: 'Definition: Enmoladas' });
    await trigger2.click();
    await expect(popoverWrapper.getByText('Corn tortillas dipped in mole')).toBeVisible({ timeout: 3000 });

    // First popover should be closed — only the Enmoladas definition should be in a popover
    await expect(popoverWrapper.getByText('The thick leaf of the maguey')).toBeHidden();
  });

  // ─────────────────────────────────────────────────────
  // Layout & Overflow
  // ─────────────────────────────────────────────────────

  test('no horizontal overflow on video detail page', async ({ authenticatedPage: page }) => {
    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test('concept popovers do not overflow viewport', async ({ authenticatedPage: page }) => {
    const conceptTrigger = page.getByRole('button', { name: 'Definition: Penca de Maguey' });
    await conceptTrigger.click();

    // Wait for popover
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover).toBeVisible({ timeout: 3000 });

    // Check it's within viewport
    const box = await popover.boundingBox();
    const viewport = await page.viewportSize();
    if (box && viewport) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2);
    }
  });

  // ─────────────────────────────────────────────────────
  // Responsivity
  // ─────────────────────────────────────────────────────

  test('responsive: chapters readable at 375px mobile width', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    // All chapters should still be visible
    const chapters = page.locator('[data-slot="article-chapter"]');
    await expect(chapters).toHaveCount(3);

    // Inline concept trigger should still be visible
    const conceptTrigger = page.getByRole('button', { name: 'Definition: Penca de Maguey' });
    await expect(conceptTrigger).toBeVisible();

    // No horizontal overflow
    const overflow = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
    expect(overflow).toBe(false);
  });

  test('responsive: concept popover works on mobile viewport', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    const conceptTrigger = page.getByRole('button', { name: 'Definition: Penca de Maguey' });
    await conceptTrigger.click();

    // Popover should still appear (scoped to radix popover)
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover.getByText('The thick leaf of the maguey')).toBeVisible({ timeout: 3000 });

    // Check no overflow with popover open
    const overflow = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
    expect(overflow).toBe(false);
  });

  // ─────────────────────────────────────────────────────
  // Backward Compatibility
  // ─────────────────────────────────────────────────────

  test('chapters without view field render with global category', async ({ authenticatedPage: page }) => {
    // Third chapter has no view field — should fall back to global category (cooking)
    const thirdChapter = page.locator('[data-slot="article-chapter"]').nth(2);
    await expect(thirdChapter.getByText('Conclusion')).toBeVisible();
    // Content should render (paragraph text visible)
    await expect(thirdChapter.getByText('Final thoughts')).toBeVisible();
  });
});
