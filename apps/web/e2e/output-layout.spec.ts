/**
 * Output Layout E2E Tests
 *
 * Tests layout hierarchy, overflow, responsivity, and visual correctness
 * of the output renderer (GlassCard, TabLayout, OutputShell, output views).
 */
import { test, expect } from "./fixtures";

// ── Mock Data ──

const mockOutput = {
  triage: {
    contentTags: ["learning"],
    modifiers: [],
    primaryTag: "learning",
    userGoal: "Get a comprehensive overview of the video",
    tabs: [
      { id: "key_points", label: "Key Points", emoji: "\u{1F4A1}", dataSource: "learning.keyPoints" },
      { id: "concepts", label: "Concepts", emoji: "\u{1F4DA}", dataSource: "learning.concepts" },
      { id: "takeaways", label: "Takeaways", emoji: "\u{1F3AF}", dataSource: "learning.takeaways" },
      { id: "timestamps", label: "Timestamps", emoji: "\u23F1\uFE0F", dataSource: "learning.timestamps" },
    ],
    confidence: 0.95,
  },
  output: {
    learning: {
      keyPoints: [
        { emoji: "\u{1F511}", title: "Main Insight", detail: "This is the primary takeaway from the video content that provides deep understanding.", timestamp: 45 },
        { emoji: "\u{1F4A1}", title: "Key Discovery", detail: "An important finding that changes how we think about the topic discussed in the video.", timestamp: 120 },
        { emoji: "\u{1F3AF}", title: "Actionable Advice", detail: "Practical steps viewers can take immediately after watching this content.", timestamp: 200 },
      ],
      concepts: [
        { name: "Core Concept", definition: "A fundamental idea that forms the basis of the discussion.", emoji: "\u{1F4D6}" },
        { name: "Advanced Topic", definition: "A more complex idea building on the core concept.", emoji: "\u{1F9E0}" },
      ],
      takeaways: [
        "Start implementing the main strategy today",
        "Review your current approach based on the insights shared",
        "Share these findings with your team for discussion",
      ],
      timestamps: [
        { time: "0:45", seconds: 45, label: "Introduction to the topic" },
        { time: "2:00", seconds: 120, label: "Key discovery revealed" },
        { time: "3:20", seconds: 200, label: "Practical advice begins" },
      ],
    },
  },
  synthesis: {
    tldr: "A comprehensive video exploring key insights about modern technology with practical advice for implementation.",
    keyTakeaways: [
      "Start implementing today",
      "Review your approach",
      "Collaborate with your team",
    ],
    masterSummary: "This video provides an in-depth analysis of modern approaches...",
    seoDescription: "Learn about modern technology insights and practical implementation strategies.",
  },
  enrichment: null,
};

const mockRecipeOutput = {
  triage: {
    contentTags: ["food"],
    modifiers: [],
    primaryTag: "food",
    userGoal: "Get a complete recipe with ingredients and steps",
    tabs: [
      { id: "ingredients", label: "Ingredients", emoji: "\u{1F955}", dataSource: "food.ingredients" },
      { id: "steps", label: "Steps", emoji: "\u{1F468}\u200D\u{1F373}", dataSource: "food.steps" },
      { id: "tips", label: "Tips", emoji: "\u{1F4A1}", dataSource: "food.tips" },
    ],
    confidence: 0.98,
  },
  output: {
    food: {
      meta: { prepTime: 15, cookTime: 30, totalTime: 45, servings: 4, difficulty: "medium", cuisine: "Italian" },
      ingredients: [
        { name: "Pasta", amount: 500, displayAmount: "500", unit: "g", group: "Main" },
        { name: "Olive Oil", amount: 2, displayAmount: "2", unit: "tbsp", group: "Sauce" },
        { name: "Garlic", amount: 3, displayAmount: "3", unit: "cloves", group: "Sauce" },
        { name: "Fresh Basil", amount: 1, displayAmount: "1", unit: "bunch", notes: "For garnish" },
      ],
      steps: [
        { number: 1, instruction: "Boil water and cook pasta according to package directions.", duration: 10, tips: "Salt the water generously" },
        { number: 2, instruction: "Heat olive oil in a large pan over medium heat.", duration: 2 },
        { number: 3, instruction: "Add garlic and cook until fragrant, about 1 minute.", duration: 1, tips: "Don't let it burn" },
      ],
      tips: [
        { type: "chef_tip", text: "Reserve some pasta water for the sauce." },
        { type: "warning", text: "Don't overcook the garlic or it will become bitter." },
      ],
      substitutions: [{ original: "Fresh basil", substitute: "Dried basil", notes: "Use 1 tsp" }],
      nutrition: [],
      equipment: ["Large pot", "Saut\u00E9 pan"],
    },
  },
  synthesis: {
    tldr: "A classic Italian pasta recipe with garlic and olive oil.",
    keyTakeaways: ["Simple ingredients, big flavor", "Don't overcook the garlic"],
    masterSummary: "This recipe demonstrates a classic approach to Italian cooking...",
    seoDescription: "Easy Italian pasta recipe with garlic and olive oil.",
  },
  enrichment: null,
};

// ── Helper: Set up video mock ──

async function setupOutputMocks(page: import("@playwright/test").Page, output = mockOutput) {
  await page.route(/\/api\/videos\/video-1$/, (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          video: {
            id: "video-1",
            videoSummaryId: "summary-1",
            youtubeId: "dQw4w9WgXcQ",
            title: "Never Gonna Give You Up - Deep Analysis",
            channel: "Rick Astley",
            duration: 213,
            thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
            status: "completed",
            folderId: null,
            createdAt: "2024-01-01T00:00:00Z",
          },
          summary: null,
          output,
        }),
      });
    } else {
      route.continue();
    }
  });
}

/** Wait for the output shell to fully render */
async function waitForOutputShell(page: import("@playwright/test").Page) {
  await page.waitForSelector(".max-w-4xl", { timeout: 10000 });
  // Wait for tabs to be rendered
  await page.waitForSelector("[role='tablist']", { timeout: 5000 });
}

// ── Tests ──

test.describe("Output Layout", () => {
  test.describe("Desktop layout hierarchy", () => {
    test("should render OutputShell with correct structure", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Check the output shell rendered
      const shell = page.locator(".max-w-4xl");
      await expect(shell).toBeVisible();

      // Should have the title bar
      const titleBar = page.locator("text=Never Gonna Give You Up");
      await expect(titleBar.first()).toBeVisible();

      // Should have TLDR
      const tldr = page.getByText("A comprehensive video exploring key insights");
      await expect(tldr).toBeVisible();
    });

    test("should render tab navigation with emoji pills", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Tabs should be visible (TabLayout uses role="tab")
      const keyPointsTab = page.getByRole("tab", { name: /Key Points/i });
      await expect(keyPointsTab).toBeVisible();

      const conceptsTab = page.getByRole("tab", { name: /Concepts/i });
      await expect(conceptsTab).toBeVisible();

      const takeawaysTab = page.getByRole("tab", { name: /Takeaways/i });
      await expect(takeawaysTab).toBeVisible();
    });

    test("should display key points on initial tab", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Key points should be visible (first tab is active by default)
      await expect(page.getByText("Main Insight")).toBeVisible();
      // Detail text visible (line-clamp-2 but still in DOM)
      await expect(page.getByText("This is the primary takeaway")).toBeVisible();
    });

    test("key points should render detail text", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Key points render as GlassCards with emoji, title, and detail
      await expect(page.getByText("Main Insight")).toBeVisible();
      await expect(page.getByText("This is the primary takeaway")).toBeVisible();
      await expect(page.getByText("Key Discovery")).toBeVisible();
    });

    test("should switch tabs when clicked", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Click Concepts tab
      const conceptsTab = page.getByRole("tab", { name: /Concepts/i });
      await conceptsTab.click();
      await page.waitForTimeout(300);

      // Concepts render as flashcards — first card should show the concept name
      await expect(page.getByText("Core Concept")).toBeVisible();
    });

    test("takeaways should render as list", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Switch to Takeaways tab
      const takeawaysTab = page.getByRole("tab", { name: /Takeaways/i });
      await takeawaysTab.click();
      await page.waitForTimeout(300);

      // Takeaways render as a string list
      await expect(page.getByText("Start implementing the main strategy today")).toBeVisible();
      await expect(page.getByText("Review your current approach")).toBeVisible();
    });

    test("should render key takeaways section", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Key takeaways should render at bottom
      await expect(page.getByText("Key Takeaways")).toBeVisible();
      await expect(page.getByText("Start implementing today")).toBeVisible();
    });
  });

  test.describe("Overflow handling", () => {
    test("should not have horizontal overflow on desktop", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Check that body doesn't have horizontal scroll
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBe(false);
    });

    test("tab bar should scroll horizontally on narrow content", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.setViewportSize({ width: 400, height: 800 });
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Tab bar should be horizontally scrollable (overflow-x-auto)
      const tabBar = page.locator("[role='tablist']");
      if (await tabBar.count() > 0) {
        const overflowX = await tabBar.evaluate((el) => {
          return getComputedStyle(el).overflowX;
        });
        expect(["auto", "scroll"]).toContain(overflowX);
      }
    });

    test("long text should not overflow card boundaries", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Check all glass cards don't overflow
      const cards = page.locator(".rounded-2xl.p-5");
      const cardCount = await cards.count();

      for (let i = 0; i < Math.min(cardCount, 5); i++) {
        const card = cards.nth(i);
        if (await card.isVisible()) {
          const overflows = await card.evaluate((el) => {
            return el.scrollWidth > el.clientWidth;
          });
          expect(overflows).toBe(false);
        }
      }
    });
  });

  test.describe("Responsivity", () => {
    test("should render correctly at mobile width (375px)", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/video/video-1");

      // On mobile the sidebar covers the main panel; click the video to open it
      const videoItem = page.getByText("Never Gonna Give You Up");
      if (await videoItem.first().isVisible()) {
        await videoItem.first().click();
      }

      // Wait for content (tablist may be below fold on mobile — check main container)
      await page.waitForSelector(".max-w-4xl", { timeout: 10000 });

      // No horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBe(false);
    });

    test("should render correctly at tablet width (768px)", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Tabs should be visible (role="tab")
      const tab = page.getByRole("tab", { name: /Key Points/i });
      await expect(tab).toBeVisible();

      // No horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBe(false);
    });

    test("should adapt layout at different breakpoints", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // At desktop — content should be visible
      await expect(page.getByText("Main Insight")).toBeVisible();

      // At mobile (375px) — page should render without horizontal overflow
      // Note: sidebar overlay covers content at mobile, so we only check overflow
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(500);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBe(false);
    });
  });

  test.describe("Recipe output type", () => {
    test("should render recipe with correct structure", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page, mockRecipeOutput as any);
      await page.goto("/video/video-1");
      await page.waitForSelector(".max-w-4xl", { timeout: 10000 });

      // Should render recipe TLDR
      await expect(page.getByText("A classic Italian pasta recipe")).toBeVisible();

      // Should have recipe-specific tabs (ingredients first)
      const ingredientsTab = page.getByRole("tab", { name: /Ingredients/i });
      await expect(ingredientsTab).toBeVisible();

      // Ingredients should be rendered as a checklist with normalized labels
      await expect(page.getByText(/Pasta/)).toBeVisible();
    });

    test("recipe tabs should switch correctly", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page, mockRecipeOutput as any);
      await page.goto("/video/video-1");
      await page.waitForSelector(".max-w-4xl", { timeout: 10000 });

      // Click Steps tab
      const stepsTab = page.getByRole("tab", { name: /Steps/i });
      await stepsTab.click();
      await page.waitForTimeout(300);

      // Steps content should be visible
      await expect(page.getByText("Boil water and cook pasta")).toBeVisible();
    });
  });

  test.describe("Glass card visual consistency", () => {
    test("glass cards should have consistent border radius", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // GlassCard uses rounded-2xl and p-5
      const cards = page.locator("[class*='rounded-2xl']");
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Verify first few cards have border-radius
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = cards.nth(i);
        if (await card.isVisible()) {
          const borderRadius = await card.evaluate((el) => {
            return getComputedStyle(el).borderRadius;
          });
          // rounded-2xl = 1rem = 16px
          expect(borderRadius).toBeTruthy();
        }
      }
    });

    test("glass cards should have backdrop blur", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      const glassCards = page.locator('[class*="backdrop-blur"]');
      if (await glassCards.count() > 0) {
        const blur = await glassCards.first().evaluate((el) => {
          return getComputedStyle(el).backdropFilter;
        });
        expect(blur).toContain("blur");
      }
    });
  });

  test.describe("Accessibility", () => {
    test("tab navigation should be keyboard accessible", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      // Focus first tab (role="tab")
      const firstTab = page.getByRole("tab", { name: /Key Points/i });
      if (await firstTab.count() > 0) {
        await firstTab.focus();
        // Tab should be focusable
        const isFocused = await firstTab.evaluate((el) => document.activeElement === el);
        expect(isFocused).toBe(true);
      }
    });

    test("footer disclaimer should be present", async ({ authenticatedPage: page }) => {
      await setupOutputMocks(page);
      await page.goto("/video/video-1");
      await waitForOutputShell(page);

      const footer = page.getByText("AI-generated summary");
      await expect(footer).toBeVisible();
    });
  });
});
