/**
 * E2E coverage for the GeneratePage onboarding affordances.
 *
 * Two states verified:
 *   - First-run (no videos)        → full onboarding visible
 *   - Returning user (≥1 videos)   → onboarding collapses to a "back to
 *                                    your videos" link
 *
 * The fixture authenticates and routes /api/videos by default; this spec
 * overrides that route per test so we can flip between the two states
 * without touching React Query internals.
 */
import type { Route } from '@playwright/test';
import { test, expect } from './fixtures';

const SAMPLE_URL = 'https://www.youtube.com/watch?v=iDbyYGrswtg';

async function stubVideos(page: import('@playwright/test').Page, count: number): Promise<void> {
  await page.route(/\/api\/videos(\?.*)?$/, (route: Route) => {
    if (route.request().method() !== 'GET') {
      route.continue();
      return;
    }
    const videos = Array.from({ length: count }, (_, i) => ({
      id: `vid-${i}`,
      videoSummaryId: `sum-${i}`,
      youtubeId: `yt-${i}`,
      title: `Video ${i}`,
      channel: 'Channel',
      duration: 100,
      thumbnailUrl: '',
      status: 'completed' as const,
      folderId: null,
      createdAt: '2026-01-01T00:00:00Z',
    }));
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ videos, total: videos.length, hasMore: false }),
    });
  });
}

test.describe('GeneratePage — first-run onboarding', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await stubVideos(page, 0);
    await page.goto('/generate');
  });

  test('shows the welcome eyebrow and full-length subhead', async ({ authenticatedPage: page }) => {
    await expect(
      page.getByRole('heading', { name: /turn any video into a study guide/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/paste a youtube link and we'll break it down/i),
    ).toBeVisible();
  });

  test('renders every value-prop chip', async ({ authenticatedPage: page }) => {
    const region = page.getByRole('region', { name: /you'll get/i });
    await expect(region).toBeVisible();
    for (const label of ['Summary', 'Timestamps', 'Flashcards', 'Quiz', 'Q&A', 'Translation']) {
      await expect(region.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('expands and collapses the example disclosure', async ({ authenticatedPage: page }) => {
    const trigger = page.getByRole('button', { name: /see an example/i });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('prefills the URL input when the sample chip is clicked', async ({ authenticatedPage: page }) => {
    const sampleButton = page.getByTestId('sample-url-button');
    await expect(sampleButton).toBeVisible();
    await sampleButton.click();

    await expect(page.getByLabel('YouTube URL')).toHaveValue(SAMPLE_URL);
  });
});

test.describe('GeneratePage — returning user', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await stubVideos(page, 3);
    await page.goto('/generate');
  });

  test('uses the new-summary eyebrow instead of the welcome one', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('New summary', { exact: true })).toBeVisible();
    await expect(page.getByText('Welcome', { exact: true })).toHaveCount(0);
  });

  test('hides the value-prop chips and example disclosure', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('region', { name: /you'll get/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /see an example/i })).toHaveCount(0);
  });

  test('shows a back-to-your-videos link', async ({ authenticatedPage: page }) => {
    const link = page.getByRole('link', { name: /back to your videos/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/board');
  });

  test('keeps the form usable for adding a new video', async ({ authenticatedPage: page }) => {
    const input = page.getByLabel('YouTube URL');
    await expect(input).toBeVisible();
    await expect(page.getByRole('button', { name: /summarize/i })).toBeVisible();
  });
});

test.describe('GeneratePage — responsive layout', () => {
  test('does not overflow horizontally on a narrow phone viewport', async ({ authenticatedPage: page }) => {
    await stubVideos(page, 0);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/generate');

    await expect(
      page.getByRole('heading', { name: /turn any video into a study guide/i }),
    ).toBeVisible();

    // No horizontal scrollbar should appear on the page or main scroll
    // container — decorative aria-hidden bleed (e.g. the accent orb) is
    // expected to extend beyond the viewport but is clipped.
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main#main-content');
      const scroller = main?.querySelector<HTMLElement>('.overflow-auto') ?? null;
      return {
        body: document.body.scrollWidth - document.body.clientWidth,
        scroller: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
      };
    });
    expect(overflow.body).toBeLessThanOrEqual(0);
    expect(overflow.scroller).toBeLessThanOrEqual(0);
  });
});
