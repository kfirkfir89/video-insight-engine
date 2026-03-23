/**
 * Cooking Mode & Component Interconnection E2E Tests
 *
 * Tests:
 * - Cooking mode detection (food domain with checklist + step_player)
 * - Cooking mode toggle (enter/exit)
 * - Cross-tab state: ingredient check persists in cooking mode
 * - RecipePlayer layout (desktop two-column, mobile drawer)
 * - Step navigation and completion
 * - Non-food videos don't show cooking mode
 */
import { test, expect } from './fixtures';

// ── Shared helpers ──

function makeVideo(title: string, overrides?: Record<string, unknown>) {
  return {
    id: 'video-1',
    videoSummaryId: 'summary-1',
    youtubeId: 'dQw4w9WgXcQ',
    title,
    channel: 'Test Channel',
    duration: 600,
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    status: 'completed',
    folderId: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

interface TabEntry {
  id: string;
  label: string;
  emoji: string;
  component: string;
  props: Record<string, unknown>;
  crossTabLinks?: { targetTab: string; label: string }[];
}

async function setupMock(
  page: import('@playwright/test').Page,
  title: string,
  primaryTag: string,
  assembledTabs: TabEntry[],
) {
  // Return flat VideoDetail matching what the backend GET /videos/:id returns
  const videoDetail = {
    ...makeVideo(title),
    meta: {
      contentTags: [primaryTag],
      modifiers: [],
      primaryTag,
      userGoal: `Testing ${primaryTag}`,
    },
    tabs: assembledTabs,
  };

  await page.route(/\/api\/videos\/video-1$/, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(videoDetail),
      });
    } else {
      route.continue();
    }
  });
}

async function waitForOutput(page: import('@playwright/test').Page) {
  await page.waitForSelector('.max-w-4xl', { timeout: 10000 });
  await page.waitForSelector("[role='tablist']", { timeout: 5000 });
}

// ── Test data ──

const FOOD_TABS: TabEntry[] = [
  {
    id: 'overview',
    label: 'Overview',
    emoji: '🍽️',
    component: 'overview',
    props: {
      title: 'Pasta Recipe',
      emoji: '🍝',
      subtitle: 'A classic Italian dish',
      stats: [{ label: 'Time', value: '30 min' }],
      summary: 'Quick and easy pasta.',
    },
  },
  {
    id: 'ingredients',
    label: 'Ingredients',
    emoji: '🛒',
    component: 'checklist',
    props: {
      items: [
        { label: 'pasta', note: 'penne or fusilli' },
        { label: 'olive oil' },
        { label: 'garlic', note: '3 cloves, minced' },
        { label: 'tomato sauce', note: '1 can' },
        { label: 'salt' },
      ],
      tabLabel: 'Ingredients',
      scalable: true,
      baseServings: 2,
    },
    crossTabLinks: [{ targetTab: 'steps', label: 'Start cooking' }],
  },
  {
    id: 'steps',
    label: 'Steps',
    emoji: '👨‍🍳',
    component: 'step_player',
    props: {
      steps: [
        { number: 1, title: 'Boil Water', instruction: 'Bring a pot of salted water to boil.', duration: '5 min', timestamp: 30 },
        { number: 2, title: 'Cook Pasta', instruction: 'Add pasta and cook until al dente.', duration: '10 min', timestamp: 60 },
        { number: 3, title: 'Make Sauce', instruction: 'Heat olive oil, add garlic and tomato sauce.', duration: '5 min', timestamp: 180 },
        { number: 4, title: 'Combine', instruction: 'Drain pasta, toss with sauce and salt to taste.', timestamp: 300 },
      ],
      timers: true,
    },
    crossTabLinks: [{ targetTab: 'tips', label: 'Pro tips' }],
  },
  {
    id: 'tips',
    label: 'Tips',
    emoji: '💡',
    component: 'display_section',
    props: {
      data: ['Save pasta water for sauce consistency', 'Don\'t overcook the garlic'],
    },
  },
];

const LEARNING_TABS: TabEntry[] = [
  {
    id: 'key_points',
    label: 'Key Points',
    emoji: '📌',
    component: 'overview',
    props: {
      title: 'Key Points',
      emoji: '📌',
      summary: 'Important concepts from the video.',
    },
  },
  {
    id: 'timestamps',
    label: 'Timestamps',
    emoji: '⏱️',
    component: 'timeline',
    props: {
      entries: [
        { time: '0:00', seconds: 0, label: 'Introduction' },
        { time: '2:30', seconds: 150, label: 'Main topic' },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════

test.describe('Cooking Mode', () => {
  test('food video shows "Enter Cooking Mode" button', async ({ authenticatedPage: page }) => {
    await setupMock(page, 'Pasta Recipe', 'food', FOOD_TABS);
    await page.goto('/video/video-1');
    await waitForOutput(page);

    const cookingBtn = page.getByText('Enter Cooking Mode');
    await expect(cookingBtn).toBeVisible();
  });

  test('non-food video does NOT show cooking mode button', async ({ authenticatedPage: page }) => {
    await setupMock(page, 'Learning Video', 'learning', LEARNING_TABS);
    await page.goto('/video/video-1');
    await waitForOutput(page);

    await expect(page.getByText('Enter Cooking Mode')).not.toBeVisible();
  });

  test('clicking Enter Cooking Mode shows RecipePlayer', async ({ authenticatedPage: page }) => {
    await setupMock(page, 'Pasta Recipe', 'food', FOOD_TABS);
    await page.goto('/video/video-1');
    await waitForOutput(page);

    await page.getByText('Enter Cooking Mode').click();
    await page.waitForTimeout(300);

    // Should show "Cooking Mode" header
    await expect(page.getByText('Cooking Mode')).toBeVisible();
    // Should show step content
    await expect(page.getByText('Boil Water')).toBeVisible();
    // Should show exit button
    await expect(page.getByLabel('Exit cooking mode')).toBeVisible();
  });

  test('exiting cooking mode returns to tabs', async ({ authenticatedPage: page }) => {
    await setupMock(page, 'Pasta Recipe', 'food', FOOD_TABS);
    await page.goto('/video/video-1');
    await waitForOutput(page);

    await page.getByText('Enter Cooking Mode').click();
    await page.waitForTimeout(300);

    // Exit
    await page.getByLabel('Exit cooking mode').click();
    await page.waitForTimeout(300);

    // Should be back to tabs — the cooking mode header (with X button) should be gone
    await expect(page.getByText('Enter Cooking Mode')).toBeVisible();
    await expect(page.getByLabel('Exit cooking mode')).not.toBeVisible();
  });

  test('step completion works in cooking mode', async ({ authenticatedPage: page }) => {
    await setupMock(page, 'Pasta Recipe', 'food', FOOD_TABS);
    await page.goto('/video/video-1');
    await waitForOutput(page);

    await page.getByText('Enter Cooking Mode').click();
    await page.waitForTimeout(300);

    // Click "Done" button on first step
    const doneBtn = page.getByRole('button', { name: /Done/i }).first();
    await doneBtn.click();
    await page.waitForTimeout(200);

    // Should show progress (1/4 steps)
    await expect(page.getByText('1/4 steps')).toBeVisible();
  });
});

test.describe('Cooking Mode — Responsive Layout', () => {
  test('desktop shows two-column layout', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupMock(page, 'Pasta Recipe', 'food', FOOD_TABS);
    await page.goto('/video/video-1');
    await waitForOutput(page);

    await page.getByText('Enter Cooking Mode').click();
    await page.waitForTimeout(300);

    // Desktop: ingredients panel should be visible (not hidden)
    const panel = page.locator('.hidden.md\\:block');
    await expect(panel).toBeVisible();
  });

  test('mobile shows collapsible ingredients drawer', async ({ authenticatedPage: page }) => {
    await setupMock(page, 'Pasta Recipe', 'food', FOOD_TABS);
    await page.goto('/video/video-1');
    await waitForOutput(page);

    // Switch to mobile viewport after page loads
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    await page.getByText('Enter Cooking Mode').click();
    await page.waitForTimeout(300);

    // Mobile: ingredients drawer toggle should be visible
    const drawer = page.getByText(/Ingredients \(\d+\)/);
    await expect(drawer).toBeVisible();
  });
});

test.describe('Layout & Overflow — Cooking Mode', () => {
  test('no horizontal overflow in cooking mode', async ({ authenticatedPage: page }) => {
    await setupMock(page, 'Pasta Recipe', 'food', FOOD_TABS);
    await page.goto('/video/video-1');
    await waitForOutput(page);

    await page.getByText('Enter Cooking Mode').click();
    await page.waitForTimeout(500);

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test('tab content has no overflow after entering and exiting cooking mode', async ({ authenticatedPage: page }) => {
    await setupMock(page, 'Pasta Recipe', 'food', FOOD_TABS);
    await page.goto('/video/video-1');
    await waitForOutput(page);

    // Enter then exit
    await page.getByText('Enter Cooking Mode').click();
    await page.waitForTimeout(300);
    await page.getByLabel('Exit cooking mode').click();
    await page.waitForTimeout(300);

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  });
});
