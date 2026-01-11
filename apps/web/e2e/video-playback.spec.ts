import { test, expect, mockVideos, mockVideoSummary } from "./fixtures";

test.describe("Video Playback - Gallery", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Fixture already navigates to dashboard with auth set up
    // Wait for videos to load
    await page.waitForSelector('[data-slot="card"]', { timeout: 10000 });
  });

  test("displays video grid with thumbnails", async ({ authenticatedPage: page }) => {
    // Should show completed videos
    const videoCards = page.locator('[data-slot="card"]');
    await expect(videoCards).toHaveCount(3);

    // First video should show thumbnail
    const firstThumbnail = page.locator('img[alt="Never Gonna Give You Up"]');
    await expect(firstThumbnail).toBeVisible();
  });

  test("shows play button overlay on hover for completed videos", async ({
    authenticatedPage: page,
  }) => {
    // Find the first completed video card
    const firstVideoCard = page.locator('[data-slot="card"]').first();

    // Play button should be hidden initially (opacity-0)
    const playButton = firstVideoCard.locator('button[aria-label*="Play"]');
    await expect(playButton).toBeAttached();

    // Hover over the card
    await firstVideoCard.hover();

    // Play button should be visible on hover
    await expect(playButton).toBeVisible();
  });

  test("does NOT show play button for processing videos", async ({
    authenticatedPage: page,
  }) => {
    // Find the processing video (video-3 "Me at the zoo")
    const processingVideoCard = page.locator('[data-slot="card"]').filter({
      has: page.locator('text=Me at the zoo'),
    });

    await processingVideoCard.hover();

    // Play button should NOT exist for processing videos
    const playButton = processingVideoCard.locator('button[aria-label*="Play"]');
    await expect(playButton).toHaveCount(0);
  });

  test("opens video modal when play button is clicked", async ({
    authenticatedPage: page,
  }) => {
    // Find the first video card and hover
    const firstVideoCard = page.locator('[data-slot="card"]').first();
    await firstVideoCard.hover();

    // Click the play button
    const playButton = firstVideoCard.locator('button[aria-label*="Play"]');
    await playButton.click();

    // Modal should open with dialog
    const modal = page.locator('[data-slot="dialog-content"]');
    await expect(modal).toBeVisible();

    // Modal should contain YouTube iframe
    const iframe = modal.locator('iframe[src*="youtube.com/embed"]');
    await expect(iframe).toBeVisible();

    // Iframe should have autoplay parameter
    const iframeSrc = await iframe.getAttribute("src");
    expect(iframeSrc).toContain("autoplay=1");
  });

  test("modal shows video title and channel", async ({ authenticatedPage: page }) => {
    // Open modal for first video
    const firstVideoCard = page.locator('[data-slot="card"]').first();
    await firstVideoCard.hover();
    await firstVideoCard.locator('button[aria-label*="Play"]').click();

    // Check modal content - use h3 specifically for the visible title
    const modal = page.locator('[data-slot="dialog-content"]');
    await expect(modal.locator("h3", { hasText: "Never Gonna Give You Up" })).toBeVisible();
    await expect(modal.locator("text=Rick Astley")).toBeVisible();
  });

  test("closes modal when clicking outside or close button", async ({
    authenticatedPage: page,
  }) => {
    // Open modal
    const firstVideoCard = page.locator('[data-slot="card"]').first();
    await firstVideoCard.hover();
    await firstVideoCard.locator('button[aria-label*="Play"]').click();

    const modal = page.locator('[data-slot="dialog-content"]');
    await expect(modal).toBeVisible();

    // Click close button
    const closeButton = modal.locator('[data-slot="dialog-close"]');
    await closeButton.click();

    // Modal should be closed
    await expect(modal).not.toBeVisible();
  });

  test("clicking video card (not play button) navigates to detail page", async ({
    authenticatedPage: page,
  }) => {
    // Click on the card info section (not the play button)
    const firstVideoCard = page.locator('[data-slot="card"]').first();
    const infoSection = firstVideoCard.locator(".p-4").first();
    await infoSection.click();

    // Should navigate to video detail page
    await expect(page).toHaveURL(/\/video\/video-1/);
  });
});

test.describe("Video Playback - Detail Page", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-1");
    // Wait for page to load
    await page.waitForSelector("h1", { timeout: 10000 });
  });

  test("displays embedded YouTube player in sidebar", async ({
    authenticatedPage: page,
  }) => {
    // Should have YouTube player iframe in collapsible section
    const youtubePlayer = page.locator('[data-slot="collapsible-video"] iframe[src*="youtube.com"]');
    await expect(youtubePlayer).toBeVisible();
  });

  test("displays video title and metadata", async ({ authenticatedPage: page }) => {
    await expect(page.locator("h1")).toContainText("Never Gonna Give You Up");
    await expect(page.locator("text=Rick Astley")).toBeVisible();
  });

  test("displays video summary sections", async ({ authenticatedPage: page }) => {
    // Wait for summary to load
    await page.waitForSelector('[data-slot="tldr-hero"]');

    // TLDR section
    await expect(page.locator('[data-slot="tldr-hero"]')).toBeVisible();
    await expect(page.locator("text=TL;DR")).toBeVisible();

    // Key Takeaways
    await expect(page.locator("text=Key Takeaways")).toBeVisible();

    // Sections - use h3 headings specifically
    await expect(page.locator("text=Sections")).toBeVisible();
    await expect(page.locator("h3", { hasText: "Introduction" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "Main Content" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "Conclusion" })).toBeVisible();
  });

  test("section cards have clickable play buttons with timestamps", async ({
    authenticatedPage: page,
  }) => {
    // Wait for sections to load
    await page.waitForSelector('[data-slot="section-card"]');

    // Find timestamp play buttons in section cards
    const timestampButtons = page.locator('[data-slot="section-card"] button[aria-label*="Play from"]');
    await expect(timestampButtons).toHaveCount(3);

    // First timestamp should show "0:00"
    await expect(timestampButtons.first()).toContainText("0:00");
  });

  test("clicking play button in section card triggers video", async ({ authenticatedPage: page }) => {
    // Wait for sections
    await page.waitForSelector('[data-slot="section-card"]');

    // Click a timestamp button in the section card specifically
    const sectionCard = page.locator('[data-slot="section-card"]').nth(1); // Main Content section
    const timestampButton = sectionCard.locator('button[aria-label="Play from 0:30"]');
    await timestampButton.click();

    // Video player should be visible
    const player = page.locator('[data-slot="collapsible-video"]');
    await expect(player).toBeVisible();
  });

  test("back button navigates to dashboard", async ({ authenticatedPage: page }) => {
    const backButton = page.locator('button:has-text("Back")');
    await backButton.click();

    await expect(page).toHaveURL("/");
  });
});

test.describe("Video Playback - Edge Cases", () => {
  test("handles video still processing (no summary)", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/video/video-3");
    await page.waitForSelector("h1");

    // Should show "processing" message or similar
    await expect(
      page.locator("text=Summary not available yet")
    ).toBeVisible();
  });
});

test.describe("Video Playback - Accessibility", () => {
  test("play button has accessible label", async ({ authenticatedPage: page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-slot="card"]');

    const firstVideoCard = page.locator('[data-slot="card"]').first();
    await firstVideoCard.hover();

    const playButton = firstVideoCard.locator('button[aria-label*="Play"]');
    const ariaLabel = await playButton.getAttribute("aria-label");
    expect(ariaLabel).toContain("Play");
    expect(ariaLabel).toContain("Never Gonna Give You Up");
  });

  test("modal has accessible title for screen readers", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForSelector('[data-slot="card"]');

    const firstVideoCard = page.locator('[data-slot="card"]').first();
    await firstVideoCard.hover();
    await firstVideoCard.locator('button[aria-label*="Play"]').click();

    // Dialog title should exist (even if visually hidden)
    const dialogTitle = page.locator('[data-slot="dialog-title"]');
    await expect(dialogTitle).toBeAttached();
  });

  test("section play buttons have accessible labels", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-1");
    await page.waitForSelector('[data-slot="section-card"]');

    const timestampButtons = page.locator('[data-slot="section-card"] button[aria-label*="Play from"]');
    const count = await timestampButtons.count();

    for (let i = 0; i < count; i++) {
      const label = await timestampButtons.nth(i).getAttribute("aria-label");
      expect(label).toMatch(/Play from \d+:\d+/);
    }
  });

  test("play button is keyboard accessible", async ({ authenticatedPage: page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-slot="card"]');

    // Tab to the first play button
    await page.keyboard.press("Tab"); // Skip to first focusable element

    // Find and focus the play button directly
    const firstVideoCard = page.locator('[data-slot="card"]').first();
    const playButton = firstVideoCard.locator('button[aria-label*="Play"]');
    await playButton.focus();

    // Play button should be visible when focused
    await expect(playButton).toBeVisible();

    // Press Enter to activate
    await page.keyboard.press("Enter");

    // Modal should open
    const modal = page.locator('[data-slot="dialog-content"]');
    await expect(modal).toBeVisible();
  });
});
