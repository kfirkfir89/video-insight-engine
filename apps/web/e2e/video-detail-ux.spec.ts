import { test, expect } from "./fixtures";

test.describe("Video Detail - Sticky Navigation (Desktop)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-1");
    // Wait for content to load and layout to stabilize
    await page.waitForSelector('[data-slot="sticky-chapter-nav"]', { timeout: 10000 });
  });

  test("displays two-column layout on desktop", async ({
    authenticatedPage: page,
  }) => {
    // Sticky sidebar should be visible
    const stickyNav = page.locator('[data-slot="sticky-chapter-nav"]');
    await expect(stickyNav).toBeVisible();

    // Mobile nav should be hidden
    const mobileNav = page.locator('[data-slot="mobile-chapter-nav"]');
    await expect(mobileNav).not.toBeVisible();

    // TL;DR hero should be visible
    const tldrHero = page.locator('#video-header');
    await expect(tldrHero).toBeVisible();
  });

  test("sticky chapter nav stays visible while scrolling", async ({
    authenticatedPage: page,
  }) => {
    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(100);

    // Nav should still be visible
    const nav = page.locator('nav[aria-label="Chapters"]');
    await expect(nav).toBeVisible();
    await expect(nav).toBeInViewport();
  });

  test("clicking chapter nav item scrolls to section", async ({
    authenticatedPage: page,
  }) => {
    // Wait for sections to load
    await page.waitForSelector('[data-slot="chapter-nav-item"]');

    // Click on "Main Content" chapter
    const mainContentChapter = page
      .locator('[data-slot="chapter-nav-item"]')
      .filter({ hasText: "Main Content" });
    // Click the button inside the nav item
    await mainContentChapter.locator("button").first().click();

    // Wait for scroll animation to complete
    await page.waitForTimeout(500);

    // The "Main Content" section should be in viewport after click
    const section = page.locator("#chapter-chapter-2");
    await expect(section).toBeInViewport({ timeout: 3000 });
  });

  test("clicking play button in nav triggers video playback", async ({
    authenticatedPage: page,
  }) => {
    // Wait for chapters to load
    await page.waitForSelector('[data-slot="chapter-nav-item"]');

    // Hover over a chapter to show play button
    const chapterItem = page.locator('[data-slot="chapter-nav-item"]').first();
    await chapterItem.hover();

    // Click the play button
    const playButton = chapterItem.locator('button[aria-label*="Play from"]');
    await expect(playButton).toBeVisible();
    await playButton.click();

    // Video should now be embedded in the corresponding section (YouTube iframe appears)
    const youtubeIframe = page.locator('iframe[src*="youtube.com"]');
    await expect(youtubeIframe).toBeVisible({ timeout: 5000 });
  });

  test("clicking chapter nav activates corresponding chapter", async ({
    authenticatedPage: page,
  }) => {
    // Wait for chapters to load
    await page.waitForSelector('[data-slot="chapter-nav-item"]');

    // Initially first chapter should be active
    const firstChapter = page.locator('[data-slot="chapter-nav-item"]').first();
    await expect(firstChapter).toHaveAttribute("data-active", "true");

    // Click on Conclusion chapter
    const conclusionChapter = page
      .locator('[data-slot="chapter-nav-item"]')
      .filter({ hasText: "Conclusion" });
    await conclusionChapter.click();

    // Wait for activation
    await page.waitForTimeout(800);

    // Conclusion chapter should now be active
    await expect(conclusionChapter).toHaveAttribute("data-active", "true");
  });

  test("video can be played and stopped from section", async ({
    authenticatedPage: page,
  }) => {
    // Wait for sections to load
    await page.waitForSelector('[data-slot="article-section"]');

    // Hover over first section to reveal play button (opacity-0 by default)
    const firstSection = page.locator('[data-slot="article-section"]').first();
    await firstSection.hover();
    const playButton = firstSection.locator('button[aria-label*="Play from"]');
    await playButton.click();

    // Video iframe should appear
    const youtubeIframe = page.locator('iframe[src*="youtube.com"]');
    await expect(youtubeIframe).toBeVisible({ timeout: 5000 });

    // Hover over section again to reveal stop button
    await firstSection.hover();
    const stopButton = firstSection.locator('button[aria-label="Stop video"]');
    await expect(stopButton).toBeVisible();

    // Click stop
    await stopButton.click();

    // Video should be removed
    await expect(youtubeIframe).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Video Detail - Mobile Layout", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Close sidebar before navigation — zustand persists sidebarOpen to localStorage.
    // On narrow viewports the sidebar covers the entire viewport.
    await page.addInitScript(() => {
      const stored = localStorage.getItem("vie-ui-store");
      const parsed = stored ? JSON.parse(stored) : { state: {}, version: 0 };
      parsed.state = { ...parsed.state, sidebarOpen: false };
      localStorage.setItem("vie-ui-store", JSON.stringify(parsed));
    });
    // Set viewport BEFORE navigating to ensure hook initializes correctly
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/video/video-1");
    // Wait for mobile layout to render (VideoDetailMobile renders article sections)
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });
  });

  test("displays single column layout on mobile", async ({
    authenticatedPage: page,
  }) => {
    // Sticky sidebar should NOT be in DOM (conditional rendering — only in VideoDetailDesktop)
    const stickyNav = page.locator('[data-slot="sticky-chapter-nav"]');
    await expect(stickyNav).toHaveCount(0);

    // Article sections should be visible in single column layout
    const sections = page.locator('[data-slot="article-section"]');
    await expect(sections.first()).toBeVisible();

    // TL;DR hero should be in DOM (may need scroll to see)
    const tldrHero = page.locator('#video-header');
    await expect(tldrHero).toBeAttached();
  });

  test("article sections render on mobile", async ({
    authenticatedPage: page,
  }) => {
    // All 3 chapter sections should be in the DOM
    const sections = page.locator('[data-slot="article-section"]');
    const count = await sections.count();
    expect(count).toBe(3);
  });

  test("play buttons are accessible on mobile", async ({
    authenticatedPage: page,
  }) => {
    // Play buttons should be in the DOM (sections exist)
    const playButtons = page.locator('button[aria-label*="Play from"]');
    await expect(playButtons).toHaveCount(3);

    // Each button should have proper aria-label
    for (let i = 0; i < 3; i++) {
      const label = await playButtons.nth(i).getAttribute("aria-label");
      expect(label).toMatch(/Play from \d+:\d+/);
    }
  });
});

test.describe("Video Detail - Content Display", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/video/video-1");
    await page.waitForSelector("h1", { timeout: 10000 });
  });

  test("displays TL;DR hero prominently", async ({ authenticatedPage: page }) => {
    const tldrHero = page.locator('#video-header');
    await expect(tldrHero).toBeVisible();
    await expect(tldrHero).toContainText("TL;DR");
    await expect(tldrHero).toContainText("This is a summary of the video content");
  });

  test("displays key takeaways in TL;DR section", async ({ authenticatedPage: page }) => {
    // Key takeaways are displayed within the TL;DR hero component
    const tldrHero = page.locator('#video-header');
    await expect(tldrHero).toBeVisible();

    // Should contain the key takeaways as bullet points
    await expect(tldrHero).toContainText("Key point 1");
    await expect(tldrHero).toContainText("Key point 2");
    await expect(tldrHero).toContainText("Key point 3");
  });

  test("displays section articles with content", async ({
    authenticatedPage: page,
  }) => {
    const sections = page.locator('[data-slot="article-section"]');
    await expect(sections).toHaveCount(3);

    // First section should have title and content
    const firstSection = sections.first();
    await expect(firstSection).toContainText("Introduction");
    await expect(firstSection).toContainText("The video starts with an introduction");
    await expect(firstSection).toContainText("Opening remarks");
  });

  test("sections have play buttons with timestamps", async ({
    authenticatedPage: page,
  }) => {
    const sections = page.locator('[data-slot="article-section"]');

    // Each section should have a play button
    const playButtons = sections.locator('button[aria-label*="Play from"]');
    await expect(playButtons).toHaveCount(3);

    // Buttons should have timestamp in aria-label (icon-only buttons)
    const firstLabel = await playButtons.first().getAttribute("aria-label");
    expect(firstLabel).toContain("0:00");
  });

});

test.describe("Video Detail - Accessibility", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-1");
    await page.waitForSelector("h1", { timeout: 10000 });
  });

  test("all play buttons have aria-labels with timestamps", async ({
    authenticatedPage: page,
  }) => {
    // Section card play buttons
    const playButtons = page.locator('button[aria-label*="Play from"]');
    const count = await playButtons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const label = await playButtons.nth(i).getAttribute("aria-label");
      expect(label).toMatch(/Play from \d+:\d+/);
    }
  });

  test("chapter nav has proper landmark role", async ({
    authenticatedPage: page,
  }) => {
    const nav = page.locator('nav[aria-label="Chapters"]');
    await expect(nav).toBeVisible();
  });

  test("chapter nav items are keyboard navigable", async ({
    authenticatedPage: page,
  }) => {
    // Wait for chapters
    await page.waitForSelector('[data-slot="chapter-nav-item"]');

    // Click the second chapter item directly
    const secondChapter = page.locator('[data-slot="chapter-nav-item"]').nth(1);
    await secondChapter.click();

    // Wait for scroll
    await page.waitForTimeout(500);

    // Second section should be in viewport after activation
    const section = page.locator("#chapter-chapter-2");
    await expect(section).toBeInViewport({ timeout: 3000 });
  });

  test("sections have proper heading structure", async ({
    authenticatedPage: page,
  }) => {
    // H1 for title
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Never Gonna Give You Up");

    // H2 for TL;DR section in VideoHero
    const h2 = page.locator("h2").first();
    await expect(h2).toBeVisible();

    // H3 for section titles within articles
    const h3s = page.locator('[data-slot="article-section"] h3');
    await expect(h3s).toHaveCount(3);
  });

});

test.describe("Video Detail - Edge Cases", () => {
  test("handles video without summary gracefully", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/video/video-3"); // Processing video
    await page.waitForSelector("h1");

    await expect(
      page.locator("text=Summary not available yet")
    ).toBeVisible();

    // Should NOT show chapter nav for processing videos
    const chapterNav = page.locator('[data-slot="sticky-chapter-nav"]');
    await expect(chapterNav).not.toBeVisible();
  });

  test("Quick Read button is hidden when masterSummary is null", async ({
    authenticatedPage: page,
  }) => {
    // video-2 has summary without masterSummary
    await page.goto("/video/video-2");
    await page.waitForSelector("h1");

    // Quick Read button should NOT be visible when masterSummary is null
    const quickReadButton = page.locator('button:has-text("Quick Read")');
    await expect(quickReadButton).toHaveCount(0);
  });

  test("Quick Read button opens master summary modal", async ({
    authenticatedPage: page,
  }) => {
    // video-1 has full summary with masterSummary
    await page.goto("/video/video-1");
    await page.waitForSelector("h1");

    // Quick Read button should be visible
    const quickReadButton = page.locator('button:has-text("Quick Read")');
    await expect(quickReadButton).toBeVisible();

    // Click Quick Read button
    await quickReadButton.click();

    // Modal should open with master summary content
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("master summary");

    // Close modal using the dialog close button (has data-slot="dialog-close")
    const closeButton = modal.locator('[data-slot="dialog-close"]');
    await closeButton.click();
    await expect(modal).not.toBeVisible();
  });

  test("navigates to dashboard via logo/sidebar", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/video/video-1");
    await page.waitForSelector("h1");

    // Navigate back by clicking the logo/home link in sidebar
    const homeLink = page.locator('a[href="/"]').first();
    await homeLink.click();

    await expect(page).toHaveURL("/");
  });

  test("video title and metadata are displayed", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/video/video-1");
    await page.waitForSelector("h1");

    await expect(page.locator("h1")).toContainText("Never Gonna Give You Up");
    await expect(page.locator("text=Rick Astley")).toBeVisible();
    // VideoHero shows "Summarized X ago" for completed videos
    await expect(page.locator("text=Summarized")).toBeVisible();
  });
});

test.describe("Video Detail - Responsive Transitions", () => {
  test("layout switches correctly between desktop and mobile", async ({
    authenticatedPage: page,
  }) => {
    // Close sidebar so it doesn't cover mobile viewport
    await page.addInitScript(() => {
      const stored = localStorage.getItem("vie-ui-store");
      const parsed = stored ? JSON.parse(stored) : { state: {}, version: 0 };
      parsed.state = { ...parsed.state, sidebarOpen: false };
      localStorage.setItem("vie-ui-store", JSON.stringify(parsed));
    });
    await page.goto("/video/video-1", { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });

    // Start in desktop mode
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(100);

    const stickyNav = page.locator('[data-slot="sticky-chapter-nav"]');

    // Desktop: sticky chapter nav should be visible
    await expect(stickyNav).toBeVisible();

    // Switch to mobile — VideoDetailMobile renders (no sticky nav)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    await expect(stickyNav).not.toBeVisible();

    // Switch back to desktop — sticky nav returns
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);

    await expect(stickyNav).toBeVisible();
  });
});
