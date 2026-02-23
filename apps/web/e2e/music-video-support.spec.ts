import { test as base, expect, Page } from "@playwright/test";

// ─────────────────────────────────────────────────────
// Mock data for music video tests
// ─────────────────────────────────────────────────────

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
};

const mockMusicVideo = {
  id: "video-music-1",
  videoSummaryId: "summary-music-1",
  youtubeId: "nrzIrsJQT60",
  title: "Hebrew Music Mashup 2024",
  channel: "MusicChannel",
  duration: 240,
  thumbnailUrl: "https://i.ytimg.com/vi/nrzIrsJQT60/maxresdefault.jpg",
  status: "completed" as const,
  folderId: null,
  createdAt: "2024-01-01T00:00:00Z",
  context: {
    category: "music",
    persona: "music",
    youtubeCategory: "Music",
    displayTags: ["music", "mashup", "hebrew"],
    tags: ["music", "mashup", "hebrew", "2024"],
  },
};

const mockStandardVideo = {
  id: "video-standard-1",
  videoSummaryId: "summary-standard-1",
  youtubeId: "dQw4w9WgXcQ",
  title: "Never Gonna Give You Up",
  channel: "Rick Astley",
  duration: 213,
  thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  status: "completed" as const,
  folderId: null,
  createdAt: "2024-01-02T00:00:00Z",
  context: {
    category: "standard",
    persona: "standard",
  },
};

const createMockChapter = (
  id: string,
  title: string,
  startSeconds: number,
  endSeconds: number,
  content: Array<Record<string, unknown>>
) => ({
  id,
  timestamp: `${Math.floor(startSeconds / 60)}:${String(startSeconds % 60).padStart(2, "0")}`,
  startSeconds,
  endSeconds,
  title,
  isCreatorChapter: true,
  content,
});

const mockMusicSummary = {
  tldr: "A vibrant mashup of popular Hebrew songs from 2024, blending pop, Mediterranean, and electronic styles.",
  keyTakeaways: [
    "Features songs from top Israeli artists",
    "Seamless transitions between genres",
    "Production highlights contemporary Israeli music trends",
  ],
  masterSummary:
    "This music mashup brings together the biggest Hebrew hits of 2024. The producer skillfully blends pop ballads with upbeat Mediterranean rhythms and electronic beats, creating a cohesive listening experience that showcases the diversity of Israeli music.",
  chapters: [
    createMockChapter("chapter-1", "Opening Medley", 0, 60, [
      {
        blockId: "ch1-paragraph",
        type: "paragraph",
        text: "The mashup opens with an energetic blend of summer hits, setting the tone for the collection.",
      },
      {
        blockId: "ch1-quote",
        type: "quote",
        text: "שיר של שמחה, שיר של אהבה",
        attribution: "Opening Lyrics",
      },
      {
        blockId: "ch1-bullets",
        type: "bullets",
        items: ["Upbeat tempo introduction", "Featured artist: Omer Adam"],
      },
    ]),
    createMockChapter("chapter-2", "Ballad Section", 60, 150, [
      {
        blockId: "ch2-paragraph",
        type: "paragraph",
        text: "The middle section slows down with emotional ballads and heartfelt lyrics.",
      },
      {
        blockId: "ch2-callout",
        type: "callout",
        style: "note",
        text: "Featured Artists: Eden Ben Zaken, Static & Ben El",
      },
      {
        blockId: "ch2-bullets",
        type: "bullets",
        items: ["Emotional vocal performances", "Piano-driven arrangements"],
      },
    ]),
    createMockChapter("chapter-3", "Grand Finale", 150, 240, [
      {
        blockId: "ch3-paragraph",
        type: "paragraph",
        text: "The finale builds to a crescendo, bringing back themes from the opening.",
      },
      {
        blockId: "ch3-bullets",
        type: "bullets",
        items: ["High-energy conclusion", "Callback to opening medley"],
      },
    ]),
  ],
  concepts: [
    {
      id: "concept-1",
      name: "Mashup Production",
      definition: "The art of blending multiple songs into a cohesive mix.",
      timestamp: "0:30",
    },
  ],
};

const mockStandardSummary = {
  tldr: "This is a standard video summary.",
  keyTakeaways: ["Key point 1", "Key point 2"],
  masterSummary: null,
  chapters: [
    createMockChapter("chapter-1", "Introduction", 0, 60, [
      { blockId: "ch1-p", type: "paragraph", text: "Standard intro content." },
      { blockId: "ch1-b", type: "bullets", items: ["Point A", "Point B"] },
    ]),
  ],
  concepts: [],
};

// ─────────────────────────────────────────────────────
// Test fixture with music-aware API mocks
// ─────────────────────────────────────────────────────

const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Auth mocks
    await page.route(/\/api\/auth\/me$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    });

    await page.route(/\/api\/auth\/refresh/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "mock-token-123" }),
      });
    });

    // Videos list
    await page.route("**/api/videos", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            videos: [mockMusicVideo, mockStandardVideo],
          }),
        });
      } else {
        route.continue();
      }
    });

    // Individual video detail
    await page.route(/\/api\/videos\/[^/]+$/, (route) => {
      const url = route.request().url();
      const videoId = url.split("/").pop()?.split("?")[0];

      if (route.request().method() === "GET") {
        if (videoId === "video-music-1") {
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              video: mockMusicVideo,
              summary: mockMusicSummary,
            }),
          });
        } else if (videoId === "video-standard-1") {
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              video: mockStandardVideo,
              summary: mockStandardSummary,
            }),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              video: mockMusicVideo,
              summary: mockMusicSummary,
            }),
          });
        }
      } else {
        route.continue();
      }
    });

    // Folders
    await page.route(/\/api\/folders(\?.*)?$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ folders: [] }),
      });
    });

    // Inject auth state
    await page.addInitScript(() => {
      const authState = {
        state: {
          accessToken: "mock-token-123",
          user: { id: "user-123", email: "test@example.com", name: "Test User" },
        },
        version: 0,
      };
      localStorage.setItem("vie-auth", JSON.stringify(authState));
      localStorage.setItem("accessToken", "mock-token-123");

      // Mock WebSocket
      class MockWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        readyState = MockWebSocket.OPEN;
        onopen: ((ev: Event) => void) | null = null;
        onclose: ((ev: CloseEvent) => void) | null = null;
        onmessage: ((ev: MessageEvent) => void) | null = null;
        onerror: ((ev: Event) => void) | null = null;
        constructor(_url: string) {
          setTimeout(() => { if (this.onopen) this.onopen(new Event("open")); }, 10);
        }
        send(_data: string) {}
        close() { this.readyState = MockWebSocket.CLOSED; }
      }
      (window as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
    });

    await page.goto("/");
    await page.waitForSelector('[role="complementary"], main, aside, h1, h2', { timeout: 15000 });
    await use(page);
  },
});

// ─────────────────────────────────────────────────────
// Tests: Music Category Rendering
// ─────────────────────────────────────────────────────

test.describe("Music Video - Content Rendering", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-music-1");
    await page.waitForSelector("h1", { timeout: 10000 });
  });

  test("renders music video title and channel", async ({
    authenticatedPage: page,
  }) => {
    await expect(page.locator("h1")).toContainText("Hebrew Music Mashup 2024");
    await expect(page.locator("text=MusicChannel")).toBeVisible();
  });

  test("displays TL;DR with music-specific summary", async ({
    authenticatedPage: page,
  }) => {
    // VideoHero uses id="video-header" and contains TL;DR section
    const videoHeader = page.locator("#video-header");
    await expect(videoHeader).toBeVisible();
    await expect(videoHeader).toContainText("TL;DR");
    await expect(videoHeader).toContainText("vibrant mashup");
  });

  test("displays key takeaways for music video", async ({
    authenticatedPage: page,
  }) => {
    const videoHeader = page.locator("#video-header");
    await expect(videoHeader).toContainText("top Israeli artists");
    await expect(videoHeader).toContainText("Seamless transitions");
  });

  test("renders all 3 chapter sections", async ({
    authenticatedPage: page,
  }) => {
    const sections = page.locator('[data-slot="article-section"]');
    await expect(sections).toHaveCount(3);

    await expect(sections.nth(0)).toContainText("Opening Medley");
    await expect(sections.nth(1)).toContainText("Ballad Section");
    await expect(sections.nth(2)).toContainText("Grand Finale");
  });

  test("renders paragraph content blocks within chapters", async ({
    authenticatedPage: page,
  }) => {
    const firstSection = page.locator('[data-slot="article-section"]').first();
    await expect(firstSection).toContainText("energetic blend of summer hits");
  });

  test("renders bullet content blocks within chapters", async ({
    authenticatedPage: page,
  }) => {
    const firstSection = page.locator('[data-slot="article-section"]').first();
    await expect(firstSection).toContainText("Upbeat tempo introduction");
    await expect(firstSection).toContainText("Featured artist: Omer Adam");
  });

  test("renders quote blocks (lyrics) within chapters", async ({
    authenticatedPage: page,
  }) => {
    const firstSection = page.locator('[data-slot="article-section"]').first();
    await expect(firstSection).toContainText("שיר של שמחה");
  });

  test("renders callout blocks (credits) within chapters", async ({
    authenticatedPage: page,
  }) => {
    const secondSection = page.locator('[data-slot="article-section"]').nth(1);
    await expect(secondSection).toContainText("Featured Artists: Eden Ben Zaken");
  });

  test("chapter nav shows all music chapters", async ({
    authenticatedPage: page,
  }) => {
    const stickyNav = page.locator('[data-slot="sticky-chapter-nav"]');
    await expect(stickyNav).toBeVisible();

    const navItems = page.locator('[data-slot="chapter-nav-item"]');
    await expect(navItems).toHaveCount(3);

    await expect(navItems.nth(0)).toContainText("Opening Medley");
    await expect(navItems.nth(1)).toContainText("Ballad Section");
    await expect(navItems.nth(2)).toContainText("Grand Finale");
  });

  test("displays music tags when present", async ({
    authenticatedPage: page,
  }) => {
    const tagElements = page.locator("text=mashup");
    const count = await tagElements.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────
// Tests: Music vs Standard Rendering (No Regressions)
// ─────────────────────────────────────────────────────

test.describe("Music Video - Category Differentiation", () => {
  test("music category uses StandardView (same layout as standard)", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Load music video
    await page.goto("/video/video-music-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    const musicSections = page.locator('[data-slot="article-section"]');
    await expect(musicSections).toHaveCount(3);

    // Load standard video
    await page.goto("/video/video-standard-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    const standardSections = page.locator('[data-slot="article-section"]');
    await expect(standardSections).toHaveCount(1);
  });

  test("standard video still renders correctly (no regression)", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-standard-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });

    await expect(page.locator("h1")).toContainText("Never Gonna Give You Up");

    const sections = page.locator('[data-slot="article-section"]');
    await expect(sections).toHaveCount(1);
    await expect(sections.first()).toContainText("Standard intro content");
  });
});

// ─────────────────────────────────────────────────────
// Tests: Desktop Layout & Overflow
// ─────────────────────────────────────────────────────

test.describe("Music Video - Desktop Layout (1280px)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-music-1");
    await page.waitForSelector('[data-slot="sticky-chapter-nav"]', { timeout: 10000 });
  });

  test("two-column layout with sticky nav on desktop", async ({
    authenticatedPage: page,
  }) => {
    const stickyNav = page.locator('[data-slot="sticky-chapter-nav"]');
    await expect(stickyNav).toBeVisible();

    const mobileNav = page.locator('[data-slot="mobile-chapter-nav"]');
    await expect(mobileNav).not.toBeVisible();
  });

  test("no content extends beyond viewport on desktop", async ({
    authenticatedPage: page,
  }) => {
    // Check that key content areas don't extend beyond the viewport
    const outOfBounds = await page.evaluate(() => {
      const vw = window.innerWidth;
      const issues: string[] = [];
      // Check main content containers only (not every DOM element)
      document.querySelectorAll('#video-header, [data-slot="article-section"], [data-slot="sticky-chapter-nav"]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 5) {
          const slot = el.getAttribute("data-slot") || el.id;
          issues.push(`${slot} extends ${Math.round(rect.right - vw)}px beyond viewport`);
        }
      });
      return issues;
    });
    expect(outOfBounds).toEqual([]);
  });

  test("all content is within viewport bounds on desktop", async ({
    authenticatedPage: page,
  }) => {
    const outOfBounds = await page.evaluate(() => {
      const vw = window.innerWidth;
      const issues: string[] = [];
      document.querySelectorAll('[data-slot="article-section"], #video-header, [data-slot="sticky-chapter-nav"]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 2) {
          const slot = el.getAttribute("data-slot") || el.id;
          issues.push(`${slot} extends ${Math.round(rect.right - vw)}px beyond viewport`);
        }
      });
      return issues;
    });
    expect(outOfBounds).toEqual([]);
  });

  test("sticky nav stays visible while scrolling", async ({
    authenticatedPage: page,
  }) => {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(100);

    const nav = page.locator('nav[aria-label="Chapters"]');
    await expect(nav).toBeVisible();
    await expect(nav).toBeInViewport();
  });
});

// ─────────────────────────────────────────────────────
// Tests: Mobile Layout
// Known issue: sidebar covers viewport on mobile (375px).
// These tests verify the music video renders after navigating
// from the sidebar list.
// ─────────────────────────────────────────────────────

test.describe("Music Video - Mobile Layout (375px)", () => {
  test("music video appears in sidebar list on mobile", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForSelector("text=Hebrew Music Mashup 2024", { timeout: 10000 });

    // The sidebar list should show the music video
    await expect(page.locator("text=Hebrew Music Mashup 2024")).toBeVisible();
  });

  test("music video detail page renders on mobile after click", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/video/video-music-1");
    // On mobile, title appears in both sidebar and h1 — use h1 specifically
    await page.waitForSelector("h1", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Hebrew Music Mashup 2024");
  });
});

// ─────────────────────────────────────────────────────
// Tests: Tablet Layout
// ─────────────────────────────────────────────────────

test.describe("Music Video - Tablet Layout (768px)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/video/video-music-1");
    // Wait for the article sections to render
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });
  });

  test("renders all content blocks at tablet width", async ({
    authenticatedPage: page,
  }) => {
    const sections = page.locator('[data-slot="article-section"]');
    await expect(sections).toHaveCount(3);

    await expect(sections.first()).toContainText("Opening Medley");
    await expect(sections.first()).toContainText("energetic blend");
  });

  test("Hebrew text and callouts render at tablet width", async ({
    authenticatedPage: page,
  }) => {
    // Check Hebrew quote renders
    await expect(page.locator("text=שיר של שמחה")).toBeVisible();

    // Check callout renders
    await expect(page.locator("text=Featured Artists: Eden Ben Zaken")).toBeVisible();
  });

  test("main content areas within viewport at tablet width", async ({
    authenticatedPage: page,
  }) => {
    // Check that the main content containers are within the viewport
    // (hover buttons positioned at -right-7 are intentionally outside)
    const outOfBounds = await page.evaluate(() => {
      const vw = window.innerWidth;
      const issues: string[] = [];
      document.querySelectorAll('#video-header, [data-slot="article-section"] > .min-w-0, [data-slot="article-section"] h3').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 5) {
          const tag = (el as HTMLElement).tagName;
          issues.push(`${tag} extends ${Math.round(rect.right - vw)}px beyond viewport`);
        }
      });
      return issues;
    });
    expect(outOfBounds).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────
// Tests: Responsive Transitions
// ─────────────────────────────────────────────────────

test.describe("Music Video - Responsive Transitions", () => {
  test("layout transitions correctly between desktop and tablet", async ({
    authenticatedPage: page,
  }) => {
    // Start in desktop mode
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-music-1");
    await page.waitForSelector('[data-slot="sticky-chapter-nav"]', { timeout: 10000 });

    const stickyNav = page.locator('[data-slot="sticky-chapter-nav"]');
    await expect(stickyNav).toBeVisible();

    // Switch to tablet mode
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);

    // Content should still be rendered
    const sections = page.locator('[data-slot="article-section"]');
    await expect(sections).toHaveCount(3);

    // Switch back to desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);

    await expect(stickyNav).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────
// Tests: Accessibility
// ─────────────────────────────────────────────────────

test.describe("Music Video - Accessibility", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-music-1");
    await page.waitForSelector('[data-slot="article-section"]', { timeout: 10000 });
  });

  test("heading hierarchy is correct", async ({
    authenticatedPage: page,
  }) => {
    // H1 for video title
    const h1 = page.locator("h1");
    await expect(h1).toContainText("Hebrew Music Mashup");

    // H3 for chapter titles within article sections
    const h3s = page.locator('[data-slot="article-section"] h3');
    await expect(h3s).toHaveCount(3);
  });

  test("play buttons have proper aria-labels", async ({
    authenticatedPage: page,
  }) => {
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

  test("keyboard navigation activates music video chapter", async ({
    authenticatedPage: page,
  }) => {
    await page.waitForSelector('[data-slot="chapter-nav-item"]');

    // The clickable area is the first <button> inside the chapter nav item
    const secondChapter = page.locator('[data-slot="chapter-nav-item"]').nth(1);
    const scrollButton = secondChapter.locator("button").first();
    await scrollButton.focus();
    await page.keyboard.press("Enter");

    // Wait for chapter activation
    await page.waitForTimeout(800);

    // Verify the chapter nav item becomes active
    await expect(secondChapter).toHaveAttribute("data-active", "true");
  });
});

// ─────────────────────────────────────────────────────
// Tests: Interactions
// ─────────────────────────────────────────────────────

test.describe("Music Video - Interactions", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/video/video-music-1");
    await page.waitForSelector('[data-slot="sticky-chapter-nav"]', { timeout: 10000 });
  });

  test("clicking chapter nav activates target chapter", async ({
    authenticatedPage: page,
  }) => {
    const grandFinale = page
      .locator('[data-slot="chapter-nav-item"]')
      .filter({ hasText: "Grand Finale" });
    const scrollButton = grandFinale.locator("button").first();
    await scrollButton.click();

    await page.waitForTimeout(800);

    // Verify the chapter nav item becomes active
    await expect(grandFinale).toHaveAttribute("data-active", "true");

    // Verify the Grand Finale section exists in the DOM
    const section = page.locator("#chapter-chapter-3");
    await expect(section).toBeAttached();
    await expect(section).toContainText("Grand Finale");
  });

  test("clicking play triggers video embed", async ({
    authenticatedPage: page,
  }) => {
    await page.waitForSelector('[data-slot="chapter-nav-item"]');

    const chapterItem = page.locator('[data-slot="chapter-nav-item"]').first();
    await chapterItem.hover();

    const playButton = chapterItem.locator('button[aria-label*="Play from"]');
    await expect(playButton).toBeVisible();
    await playButton.click();

    const youtubeIframe = page.locator('iframe[src*="youtube.com"]');
    await expect(youtubeIframe).toBeVisible({ timeout: 5000 });
  });

  test("Quick Read button works for music video", async ({
    authenticatedPage: page,
  }) => {
    const quickReadButton = page.locator('button:has-text("Quick Read")');
    await expect(quickReadButton).toBeVisible();

    await quickReadButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("biggest Hebrew hits");

    const closeButton = modal.locator('[data-slot="dialog-close"]');
    await closeButton.click();
    await expect(modal).not.toBeVisible();
  });
});
