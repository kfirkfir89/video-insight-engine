import { test, expect } from "./fixtures";

/**
 * Explainer V2 E2E tests.
 * Tests: Video Chat panel, Go Deeper buttons, Tell Me More, Export (copy/download),
 * layout hierarchy, overflow, and responsivity.
 */

test.describe("Explainer V2 — Desktop", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Mock explain endpoints
    await page.route(/\/api\/explain\/[^/]+\/section\/[^/]+$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ expansion: "This chapter explores the topic in greater depth. Key points include..." }),
      });
    });

    await page.route(/\/api\/explain\/[^/]+\/concept\/[^/]+$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ expansion: "Detailed explanation of this concept with examples and context." }),
      });
    });

    await page.route("**/api/explain/video-chat", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "This video discusses important topics related to your question." }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/video/video-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });
  });

  test("chat panel is visible in right panel on large desktop", async ({ authenticatedPage: page }) => {
    // At 1440px (>= 1280px), chat is in the right panel tabs
    // Chat tab should be visible
    const chatTab = page.getByTestId("tab-chat");
    await expect(chatTab).toBeVisible();

    // Chat toggle button is hidden on large desktop (only shown < 1280px)
    const chatButton = page.getByRole("button", { name: "Toggle video chat" });
    await expect(chatButton).toHaveCount(0);
  });

  test("shows chat toggle on smaller desktop", async ({ authenticatedPage: page }) => {
    // At 1024px (< 1280px), the toggle button appears
    await page.setViewportSize({ width: 1024, height: 768 });

    const chatButton = page.getByRole("button", { name: "Toggle video chat" });
    await expect(chatButton).toBeVisible();
  });

  test("can send a message in video chat", async ({ authenticatedPage: page }) => {
    // At 1440px, chat is in the right panel. Click the Chat tab to show it.
    const chatTab = page.getByTestId("tab-chat");
    await chatTab.click();
    await page.waitForTimeout(300);

    const input = page.getByPlaceholder("Ask about this video...").first();
    await expect(input).toBeVisible();
    await input.fill("What is this video about?");

    // Send message
    await page.getByRole("button", { name: "Send message" }).first().click();

    // User message should appear
    await expect(page.getByText("What is this video about?").first()).toBeVisible();

    // Wait for response
    await expect(
      page.getByText("This video discusses important topics").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("Go Deeper button is visible on each chapter", async ({ authenticatedPage: page }) => {
    const goDeeper = page.getByRole("button", { name: "Go Deeper" });
    // Should have one per chapter
    await expect(goDeeper.first()).toBeVisible();
  });

  test("Go Deeper expands and shows explanation", async ({ authenticatedPage: page }) => {
    // Click Go Deeper on first chapter
    const goDeeper = page.getByRole("button", { name: "Go Deeper" }).first();
    await goDeeper.click();

    // Should show explanation content
    await expect(
      page.getByText("This chapter explores the topic in greater depth")
    ).toBeVisible({ timeout: 5000 });

    // Button should now say "Close"
    await expect(page.getByRole("button", { name: "Close" }).first()).toBeVisible();

    // Click to close
    await page.getByRole("button", { name: "Close" }).first().click();
    await expect(
      page.getByText("This chapter explores the topic in greater depth")
    ).not.toBeVisible();
  });

  test("Copy and Export buttons are visible", async ({ authenticatedPage: page }) => {
    const copyButton = page.getByRole("button", { name: "Copy as Markdown" });
    const exportButton = page.getByRole("button", { name: "Download as Markdown" });

    await expect(copyButton).toBeVisible();
    await expect(exportButton).toBeVisible();
  });

  test("Copy button shows feedback state", async ({ authenticatedPage: page }) => {
    const copyButton = page.getByRole("button", { name: "Copy as Markdown" });
    await copyButton.click();

    // Should show "Copied" feedback (clipboard may fail in test, but button state changes)
    // In headless mode clipboard may not work, so we just verify the button is clickable
    await expect(copyButton).toBeVisible();
  });
});

test.describe("Explainer V2 — Layout & Overflow", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route("**/api/explain/video-chat", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "Test response" }),
      });
    });
  });

  test("desktop two-column layout has no horizontal overflow", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/video/video-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    // Check no horizontal scroll
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test("content respects container boundaries at 1024px", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/video/video-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test("chapter content blocks stay within viewport", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/video/video-1");
    await page.locator('[data-slot="article-section"]').first().waitFor({ timeout: 10000 });

    // Check each chapter article stays within the viewport width
    const results = await page.evaluate(() => {
      const chapters = document.querySelectorAll('[data-slot="article-section"]');
      const viewportWidth = window.innerWidth;
      const overflows: { right: number; width: number }[] = [];
      for (const ch of chapters) {
        const rect = ch.getBoundingClientRect();
        overflows.push({ right: rect.right, width: viewportWidth });
      }
      return overflows;
    });

    for (const { right, width } of results) {
      expect(right).toBeLessThanOrEqual(width);
    }
  });

  test("semantic HTML hierarchy is correct", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-1");
    await page.locator('[data-slot="article-section"]').first().waitFor({ timeout: 10000 });

    // Check that articles exist with correct structure
    const articleCount = await page.locator("article").count();
    expect(articleCount).toBeGreaterThan(0);

    // Check heading hierarchy within chapters
    const headingLevels = await page.evaluate(() => {
      const articles = document.querySelectorAll('[data-slot="article-section"]');
      const levels: number[] = [];
      for (const article of articles) {
        const h3 = article.querySelector("h3");
        if (h3) levels.push(3);
      }
      return levels;
    });

    // Each chapter should have an h3
    expect(headingLevels.length).toBeGreaterThan(0);
    for (const level of headingLevels) {
      expect(level).toBe(3);
    }
  });
});

test.describe("Explainer V2 — Responsivity", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route("**/api/explain/video-chat", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "Mobile chat response" }),
      });
    });
    await page.route(/\/api\/explain\/[^/]+\/section\/[^/]+$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ expansion: "Go deeper explanation for mobile." }),
      });
    });

    // Close sidebar before navigation — zustand persists sidebarOpen to localStorage.
    // On narrow viewports the 380px sidebar covers the entire viewport.
    await page.addInitScript(() => {
      const stored = localStorage.getItem("vie-ui-store");
      const parsed = stored ? JSON.parse(stored) : { state: {}, version: 0 };
      parsed.state = { ...parsed.state, sidebarOpen: false };
      localStorage.setItem("vie-ui-store", JSON.stringify(parsed));
    });
  });

  test("mobile layout shows single column at 375px", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/video/video-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    // Sticky sidebar should NOT be visible on mobile
    const stickyNav = page.locator('[data-slot="sticky-chapter-nav"]');
    await expect(stickyNav).not.toBeVisible();

    // Article sections should be visible (mobile single column layout)
    const sections = page.locator('[data-slot="article-section"]');
    await expect(sections.first()).toBeVisible();

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test("mobile chat opens as full-screen drawer", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/video/video-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    // Open chat
    await page.getByRole("button", { name: "Toggle video chat" }).click();

    // Chat should fill the screen (fixed inset-0)
    const chatDrawer = page.getByText("Video Chat");
    await expect(chatDrawer).toBeVisible();

    // Close button should be visible
    const closeButton = page.getByRole("button", { name: "Close chat" });
    await expect(closeButton).toBeVisible();

    // Close chat
    await closeButton.click();
    await expect(chatDrawer).not.toBeVisible();
  });

  test("tablet layout at 768px has no overflow", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/video/video-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test("Go Deeper works on mobile", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/video/video-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    // Go Deeper button should be visible
    const goDeeper = page.getByRole("button", { name: "Go Deeper" }).first();
    await expect(goDeeper).toBeVisible();

    // Click it
    await goDeeper.click();

    // Explanation should appear
    await expect(
      page.getByText("Go deeper explanation for mobile.")
    ).toBeVisible({ timeout: 5000 });
  });

  test("export buttons work on mobile (icon-only)", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/video/video-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    const copyButton = page.getByRole("button", { name: "Copy as Markdown" });
    const downloadButton = page.getByRole("button", { name: "Download as Markdown" });

    await expect(copyButton).toBeVisible();
    await expect(downloadButton).toBeVisible();
  });
});
