/**
 * E2E Tests for Dev Pages
 *
 * Tests the Design System and Video Examples dev-only pages.
 * These pages are only available in development mode.
 */
import { test, expect } from '@playwright/test';

test.describe('Dev Pages', () => {
  test.describe('Design System Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dev/design-system');
    });

    test('loads successfully', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Design System' })).toBeVisible();
      await expect(page.getByText('DEV ONLY')).toBeVisible();
    });

    test('shows sidebar navigation', async ({ page }) => {
      // Use nav element to scope to sidebar navigation
      const sidebar = page.locator('nav[aria-label="Design system sections"]');
      await expect(sidebar.getByRole('button', { name: /colors/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /typography/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /spacing/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /status/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /categories/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /blocks/i })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: /views/i })).toBeVisible();
    });

    test('shows Color Palette section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Color Palette' })).toBeVisible();
      await expect(page.getByText('background', { exact: true })).toBeVisible();
      await expect(page.getByText('primary', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('destructive', { exact: true })).toBeVisible();
    });

    test('shows Typography section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Typography' })).toBeVisible();
      await expect(page.locator('code').filter({ hasText: 'text-xs' })).toBeVisible();
      await expect(page.locator('code').filter({ hasText: 'text-base' })).toBeVisible();
      await expect(page.locator('code').filter({ hasText: 'font-bold' })).toBeVisible();
    });

    test('shows Spacing Scale section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Spacing Scale' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Token' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Pixels' })).toBeVisible();
    });

    test('shows Status Indicators section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Status Indicators' })).toBeVisible();
      await expect(page.getByText('Pending').first()).toBeVisible();
      await expect(page.getByText('Processing').first()).toBeVisible();
      await expect(page.getByText('Completed').first()).toBeVisible();
      await expect(page.getByText('Failed').first()).toBeVisible();
    });

    test('shows Category Accents section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Category Accents' })).toBeVisible();
      await expect(page.getByText('Cooking').first()).toBeVisible();
      await expect(page.getByText('Coding').first()).toBeVisible();
      await expect(page.getByText('Travel').first()).toBeVisible();
      await expect(page.getByText('Fitness').first()).toBeVisible();
    });

    test('shows Content Blocks section', async ({ page }) => {
      // Scroll to blocks section
      const blocksSection = page.locator('#blocks');
      await blocksSection.scrollIntoViewIfNeeded();

      await expect(page.getByText('Content Blocks').first()).toBeVisible();
      // Check for block groups - use first() since they appear in multiple places
      await expect(page.getByText('Universal Blocks').first()).toBeVisible();
      await expect(page.getByText('Cooking Blocks').first()).toBeVisible();
      await expect(page.getByText('Coding Blocks').first()).toBeVisible();
    });

    test('can toggle block JSON view', async ({ page }) => {
      // Find a JSON toggle button
      const jsonButtons = page.getByRole('button', { name: /json/i });
      const firstJsonButton = jsonButtons.first();

      // Click to show JSON
      await firstJsonButton.click();
      await expect(page.getByText('"type":')).toBeVisible();
    });

    test('shows Category Views section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Category Views' })).toBeVisible();
    });

    test('has working back to top button', async ({ page }) => {
      // Scroll down first
      await page.evaluate(() => window.scrollTo(0, 1000));

      // Click back to top
      await page.getByRole('button', { name: 'Back to top' }).click();

      // Check we're back at top (scroll position should be 0 or very small)
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeLessThan(100);
    });
  });

  test.describe('Video Examples Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dev/video-examples');
    });

    test('loads successfully', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Video Examples' })).toBeVisible();
      await expect(page.getByText('DEV ONLY')).toBeVisible();
    });

    test('shows all 10 category tabs', async ({ page }) => {
      // Use the category tabs navigation to scope
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await expect(tabs.getByRole('button', { name: 'Cooking' })).toBeVisible();
      await expect(tabs.getByRole('button', { name: 'Coding' })).toBeVisible();
      await expect(tabs.getByRole('button', { name: 'Travel' })).toBeVisible();
      await expect(tabs.getByRole('button', { name: 'Reviews' })).toBeVisible();
      await expect(tabs.getByRole('button', { name: 'Fitness' })).toBeVisible();
      await expect(tabs.getByRole('button', { name: 'Education' })).toBeVisible();
      await expect(tabs.getByRole('button', { name: 'Podcast' })).toBeVisible();
      await expect(tabs.getByRole('button', { name: 'DIY' })).toBeVisible();
      await expect(tabs.getByRole('button', { name: 'Gaming' })).toBeVisible();
      await expect(tabs.getByRole('button', { name: 'Standard' })).toBeVisible();
    });

    test('shows cooking video by default', async ({ page }) => {
      // Cooking is the default category
      await expect(page.getByText("Gordon Ramsay's Perfect Carbonara")).toBeVisible();
      await expect(page.getByText('TL;DR')).toBeVisible();
      await expect(page.getByText('Key Takeaways')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
    });

    test('can switch to coding category', async ({ page }) => {
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await tabs.getByRole('button', { name: 'Coding' }).click();

      await expect(page.getByText('React 19 Hooks Complete Tutorial')).toBeVisible();
    });

    test('can switch to fitness category', async ({ page }) => {
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await tabs.getByRole('button', { name: 'Fitness' }).click();

      await expect(page.getByText('30-Min Full Body HIIT Workout')).toBeVisible();
    });

    test('can switch to travel category', async ({ page }) => {
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await tabs.getByRole('button', { name: 'Travel' }).click();

      await expect(page.getByText('7 Days in Japan Complete Guide')).toBeVisible();
    });

    test('can switch to education category', async ({ page }) => {
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await tabs.getByRole('button', { name: 'Education' }).click();

      await expect(page.getByText('Quantum Computing Explained')).toBeVisible();
    });

    test('can switch to podcast category', async ({ page }) => {
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await tabs.getByRole('button', { name: 'Podcast' }).click();

      await expect(page.getByText(/Lex Fridman.*Naval Ravikant/i)).toBeVisible();
    });

    test('can switch to reviews category', async ({ page }) => {
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await tabs.getByRole('button', { name: 'Reviews' }).click();

      await expect(page.getByText('iPhone 15 Pro Max 6-Month Review')).toBeVisible();
    });

    test('can switch to gaming category', async ({ page }) => {
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await tabs.getByRole('button', { name: 'Gaming' }).click();

      await expect(page.getByText("Elden Ring Beginner's Walkthrough")).toBeVisible();
    });

    test('can switch to DIY category', async ({ page }) => {
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await tabs.getByRole('button', { name: 'DIY' }).click();

      await expect(page.getByText('Build a Standing Desk from Scratch')).toBeVisible();
    });

    test('can switch to standard category', async ({ page }) => {
      const tabs = page.locator('nav[aria-label="Video categories"]');
      await tabs.getByRole('button', { name: 'Standard' }).click();

      await expect(page.getByText('Understanding the Stock Market 2024')).toBeVisible();
    });

    test('can expand/collapse chapters', async ({ page }) => {
      // First chapter should be expanded by default
      await expect(page.getByText('Introduction')).toBeVisible();

      // Find a collapsed chapter and click to expand
      const chapters = page.locator('button', { hasText: /Ingredients|Preparing|Cooking/i });
      const chapterButton = chapters.first();
      await chapterButton.click();

      // Should see content from that chapter
      await expect(page.locator('[class*="border-t"] > div').first()).toBeVisible();
    });

    test('shows video info sidebar', async ({ page }) => {
      await expect(page.getByText('Video Info')).toBeVisible();
      await expect(page.getByText('Category', { exact: true })).toBeVisible();
      await expect(page.getByRole('complementary').getByText('Chapters')).toBeVisible();
    });

    test('shows resources sidebar', async ({ page }) => {
      await expect(page.getByText('Resources')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('DevToolPanel has links to dev pages', async ({ page }) => {
      // Go to dashboard first (need to be logged in)
      await page.goto('/login');

      // The dev tool panel should have links (in dev mode)
      // We'll test that the links exist on the page
    });

    test('dev pages are accessible via direct URL', async ({ page }) => {
      await page.goto('/dev/design-system');
      await expect(page.getByRole('heading', { name: 'Design System' })).toBeVisible();

      await page.goto('/dev/video-examples');
      await expect(page.getByRole('heading', { name: 'Video Examples' })).toBeVisible();
    });
  });
});
