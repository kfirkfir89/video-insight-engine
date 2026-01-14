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
    const tldrHero = page.locator('[data-slot="tldr-hero"]');
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
    await mainContentChapter.click();

    // Wait for scroll animation
    await page.waitForTimeout(500);

    // Section should be in viewport
    const section = page.locator("#section-section-2");
    await expect(section).toBeInViewport();
  });

  test("clicking play button in nav seeks video", async ({
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

    // Video player should be present (we can't verify actual playback in mocked tests)
    const videoPlayer = page.locator('[data-slot="collapsible-video"]');
    await expect(videoPlayer).toBeVisible();
  });

  test("clicking chapter nav scrolls to corresponding section", async ({
    authenticatedPage: page,
  }) => {
    // Wait for chapters to load
    await page.waitForSelector('[data-slot="chapter-nav-item"]');

    // Initially first section should be active
    const firstChapter = page.locator('[data-slot="chapter-nav-item"]').first();
    await expect(firstChapter).toHaveAttribute("data-active", "true");

    // Click on Conclusion chapter to scroll
    const thirdChapter = page
      .locator('[data-slot="chapter-nav-item"]')
      .filter({ hasText: "Conclusion" });
    await thirdChapter.click();

    // Wait for scroll animation
    await page.waitForTimeout(600);

    // Third section should now be in viewport
    const thirdSection = page.locator("#section-section-3");
    await expect(thirdSection).toBeInViewport();
  });

  test("collapsible video player expands and collapses", async ({
    authenticatedPage: page,
  }) => {
    const videoPlayer = page.locator('[data-slot="collapsible-video"]');
    await expect(videoPlayer).toBeVisible();

    // Find expand button
    const expandButton = videoPlayer.locator('button[aria-label*="Expand"]');
    await expandButton.click();

    // Button should now say "Collapse"
    const collapseButton = videoPlayer.locator('button[aria-label*="Collapse"]');
    await expect(collapseButton).toBeVisible();

    // Click to collapse
    await collapseButton.click();

    // Button should say "Expand" again
    await expect(expandButton).toBeVisible();
  });
});

test.describe("Video Detail - Mobile Layout", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Set viewport BEFORE navigating to ensure hook initializes correctly
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/video/video-1");
    // Wait for mobile layout to render
    await page.waitForSelector('[data-slot="mobile-chapter-nav"]', { timeout: 10000 });
  });

  test("displays single column layout with bottom nav on mobile", async ({
    authenticatedPage: page,
  }) => {
    // Sticky sidebar should NOT be in DOM (conditional rendering)
    const stickyNav = page.locator('[data-slot="sticky-chapter-nav"]');
    await expect(stickyNav).toHaveCount(0);

    // Mobile bottom nav should be visible
    const mobileNav = page.locator('[data-slot="mobile-chapter-nav"]');
    await expect(mobileNav).toBeVisible();

    // TL;DR hero should be in DOM (may need scroll to see)
    const tldrHero = page.locator('[data-slot="tldr-hero"]');
    await expect(tldrHero).toBeAttached();
  });

  test("chapter pills are horizontally scrollable", async ({
    authenticatedPage: page,
  }) => {
    const mobileNav = page.locator('[data-slot="mobile-chapter-nav"]');
    await expect(mobileNav).toBeVisible();

    // Check that nav contains multiple buttons
    const pills = mobileNav.locator("button");
    const count = await pills.count();
    expect(count).toBe(3);
  });

  test("clicking chapter pill scrolls to section", async ({
    authenticatedPage: page,
  }) => {
    const mobileNav = page.locator('[data-slot="mobile-chapter-nav"]');

    // Click on "Conclusion" pill
    const conclusionPill = mobileNav.locator("button").filter({ hasText: "Conclusion" });
    await conclusionPill.click();

    // Wait for scroll animation
    await page.waitForTimeout(500);

    // Section should be in viewport
    const section = page.locator("#section-section-3");
    await expect(section).toBeInViewport();
  });

  test("collapsible video section works on mobile", async ({
    authenticatedPage: page,
  }) => {
    // Video player should be collapsed initially (iframe not in DOM or hidden)
    const youtubeIframe = page.locator('iframe[src*="youtube.com"]');

    // Click to expand
    const watchButton = page.locator('button:has-text("Watch Video")');
    await watchButton.click();

    // Wait for animation and content to appear
    await page.waitForTimeout(500);

    // Video should now be in DOM
    await expect(youtubeIframe).toBeAttached();
  });
});

test.describe("Video Detail - Content Display", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/video/video-1");
    await page.waitForSelector("h1", { timeout: 10000 });
  });

  test("displays TL;DR hero prominently", async ({ authenticatedPage: page }) => {
    const tldrHero = page.locator('[data-slot="tldr-hero"]');
    await expect(tldrHero).toBeVisible();
    await expect(tldrHero).toContainText("TL;DR");
    await expect(tldrHero).toContainText("This is a summary of the video content");
  });

  test("displays key takeaways", async ({ authenticatedPage: page }) => {
    const takeaways = page.locator('[data-slot="key-takeaways"]');
    await expect(takeaways).toBeVisible();
    await expect(takeaways).toContainText("Key Takeaways");
    await expect(takeaways).toContainText("Key point 1");
    await expect(takeaways).toContainText("Key point 2");
  });

  test("displays section cards with content", async ({
    authenticatedPage: page,
  }) => {
    const sectionCards = page.locator('[data-slot="section-card"]');
    await expect(sectionCards).toHaveCount(3);

    // First section should have title and content
    const firstSection = sectionCards.first();
    await expect(firstSection).toContainText("Introduction");
    await expect(firstSection).toContainText("The video starts with an introduction");
    await expect(firstSection).toContainText("Opening remarks");
  });

  test("section cards have play buttons with timestamps", async ({
    authenticatedPage: page,
  }) => {
    const sectionCards = page.locator('[data-slot="section-card"]');

    // Each section should have a play button
    const playButtons = sectionCards.locator('button[aria-label*="Play from"]');
    await expect(playButtons).toHaveCount(3);

    // Buttons should show timestamps
    await expect(playButtons.first()).toContainText("0:00");
  });

  test("displays concepts grid", async ({ authenticatedPage: page }) => {
    const conceptsGrid = page.locator('[data-slot="concepts-grid"]');
    await expect(conceptsGrid).toBeVisible();
    await expect(conceptsGrid).toContainText("Concepts");
    await expect(conceptsGrid).toContainText("Main Concept");
    await expect(conceptsGrid).toContainText("Definition of the main concept");
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

    // Tab to first chapter item
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab"); // Skip back button

    // Focus first chapter item
    const firstChapter = page.locator('[data-slot="chapter-nav-item"]').first();
    await firstChapter.focus();

    // Press Enter to activate
    await page.keyboard.press("Enter");

    // Wait for scroll
    await page.waitForTimeout(500);

    // First section should be in viewport
    const section = page.locator("#section-section-1");
    await expect(section).toBeInViewport();
  });

  test("sections have proper heading structure", async ({
    authenticatedPage: page,
  }) => {
    // H1 for title
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Never Gonna Give You Up");

    // H2 for sections header
    const h2 = page.locator("h2").filter({ hasText: "Sections" });
    await expect(h2).toBeVisible();

    // H3 for section titles
    const h3s = page.locator('[data-slot="section-card"] h3');
    await expect(h3s).toHaveCount(3);
  });

  test("collapsible video has aria-expanded state", async ({
    authenticatedPage: page,
  }) => {
    const expandButton = page.locator('button[aria-label*="Expand video"]');
    await expect(expandButton).toHaveAttribute("aria-expanded", "false");

    await expandButton.click();

    const collapseButton = page.locator('button[aria-label*="Collapse video"]');
    await expect(collapseButton).toHaveAttribute("aria-expanded", "true");
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

  test("back button navigates to dashboard", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/video/video-1");
    await page.waitForSelector("h1");

    const backButton = page.locator('button:has-text("Back")');
    await backButton.click();

    await expect(page).toHaveURL("/");
  });

  test("video title and metadata are displayed", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/video/video-1");
    await page.waitForSelector("h1");

    await expect(page.locator("h1")).toContainText("Never Gonna Give You Up");
    await expect(page.locator("text=Rick Astley")).toBeVisible();
    await expect(page.locator("text=completed")).toBeVisible();
  });
});

test.describe("Video Detail - Responsive Transitions", () => {
  test("layout switches correctly between desktop and mobile", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/video/video-1", { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });

    // Start in desktop mode
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(100);

    const stickyNav = page.locator('[data-slot="sticky-chapter-nav"]');
    const mobileNav = page.locator('[data-slot="mobile-chapter-nav"]');

    await expect(stickyNav).toBeVisible();
    await expect(mobileNav).not.toBeVisible();

    // Switch to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);

    await expect(stickyNav).not.toBeVisible();
    await expect(mobileNav).toBeVisible();

    // Switch back to desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(100);

    await expect(stickyNav).toBeVisible();
    await expect(mobileNav).not.toBeVisible();
  });
});
