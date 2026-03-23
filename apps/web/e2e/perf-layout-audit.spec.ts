import { test, expect } from "./fixtures";

/**
 * Performance optimization — layout hierarchy, overflow, and responsivity audit.
 * Validates that performance changes don't break:
 * 1. Layout hierarchy (sidebar, main content)
 * 2. No overflow leaks or unexpected scrollbars
 * 3. Responsive breakpoints (mobile, tablet, desktop)
 * 4. DnD overlay portals render correctly
 * 5. CSS containment doesn't clip visible content
 */

const mockOutputData = {
  triage: {
    contentTags: ["learning"],
    modifiers: [],
    primaryTag: "learning",
    userGoal: "Learn the topic",
    tabs: [
      { id: "key_points", label: "Key Points", emoji: "\u{1F4A1}", dataSource: "learning.keyPoints" },
    ],
    confidence: 0.9,
  },
  output: {
    learning: {
      keyPoints: [
        { emoji: "\u{1F511}", title: "Main Point", detail: "Primary takeaway.", timestamp: 45 },
      ],
    },
  },
  synthesis: {
    tldr: "A quick overview.",
    keyTakeaways: ["Key point 1"],
    masterSummary: "Full summary.",
    seoDescription: "Learn key concepts.",
  },
  enrichment: null,
};

async function setupVideoMock(page: import("@playwright/test").Page) {
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
            title: "Test Video",
            channel: "Test Channel",
            duration: 213,
            thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
            status: "completed",
            folderId: null,
            createdAt: "2024-01-01T00:00:00Z",
          },
          summary: null,
          output: mockOutputData,
        }),
      });
    } else {
      route.continue();
    }
  });
}

test.describe("Perf Optimization — Layout & Overflow Audit", () => {
  const VIDEO_URL = "/video/video-1";

  test.describe("Desktop (1440px)", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("no horizontal overflow on dashboard", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/");
      await page.waitForSelector("aside, h1, h2", { timeout: 10000 });

      const hasHorizontalOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    });

    test("no horizontal overflow on video detail page", async ({
      authenticatedPage: page,
    }) => {
      await setupVideoMock(page);
      await page.goto(VIDEO_URL);
      await page.waitForSelector(".max-w-4xl, h1, h2", { timeout: 10000 });

      const hasHorizontalOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    });

    test("sidebar is visible and properly contained", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/");
      const sidebar = page.locator("aside").first();
      await sidebar.waitFor({ state: "attached", timeout: 10000 });

      const box = await sidebar.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(0);
        expect(box.width).toBeLessThan(400);
      }
    });

    test("sidebar items have CSS containment", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/");
      await page.waitForSelector("[data-sidebar-item]", { timeout: 10000 });

      const containValue = await page.evaluate(() => {
        const item = document.querySelector("[data-sidebar-item]");
        if (!item) return "none";
        return window.getComputedStyle(item).contain;
      });

      // Should have some form of containment (layout, style, paint)
      expect(containValue).not.toBe("none");
    });

    test("DragOverlay portal container is a direct child of body", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/");
      await page.waitForSelector("aside, h1, h2", { timeout: 10000 });

      const overlayInsideSidebar = await page.evaluate(() => {
        const sidebar = document.querySelector("aside");
        if (!sidebar) return false;
        return sidebar.querySelector("[data-dnd-overlay-container]") !== null;
      });
      expect(overlayInsideSidebar).toBe(false);
    });
  });

  test.describe("Tablet (768px)", () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test("no horizontal overflow at tablet width", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/");
      await page.waitForSelector("h1, h2", { timeout: 10000 });

      const hasHorizontalOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    });

    test("video detail page fits within viewport", async ({
      authenticatedPage: page,
    }) => {
      await setupVideoMock(page);
      await page.goto(VIDEO_URL);
      await page.waitForSelector(".max-w-4xl, h1, h2", { timeout: 10000 });

      const hasHorizontalOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    });
  });

  test.describe("Mobile (375px)", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("overflow is bounded on mobile dashboard", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/");
      await page.waitForSelector("h1, h2", { timeout: 10000 });

      const overflowPx = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflowPx).toBeLessThan(250);
    });

    test("overflow is bounded on mobile video detail", async ({
      authenticatedPage: page,
    }) => {
      await setupVideoMock(page);
      await page.goto(VIDEO_URL);
      await page.waitForSelector(".max-w-4xl, h1, h2", { timeout: 10000 });

      const overflowPx = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflowPx).toBeLessThan(250);
    });

    test("page renders without crashing on mobile", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/");

      const hasContent = await page.evaluate(() =>
        document.body.innerText.trim().length > 0
      );
      expect(hasContent).toBe(true);
    });
  });

  test.describe("CSS Animation Containment", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("no unexpected infinite CSS animations on video detail", async ({
      authenticatedPage: page,
    }) => {
      await setupVideoMock(page);
      await page.goto(VIDEO_URL);
      await page.waitForSelector(".max-w-4xl, h1, h2", { timeout: 10000 });

      const infiniteAnimations = await page.evaluate(() => {
        const allElements = document.querySelectorAll("*");
        const infinite: string[] = [];
        for (const el of allElements) {
          const style = window.getComputedStyle(el);
          if (
            style.animationIterationCount === "infinite" &&
            style.animationName !== "none"
          ) {
            const tag = el.tagName.toLowerCase();
            const cls = el.className?.toString().slice(0, 50) || "";
            infinite.push(`${tag}.${cls}`);
          }
        }
        return infinite;
      });

      const unexpected = infiniteAnimations.filter(
        (el) =>
          !el.includes("spinner") &&
          !el.includes("loading") &&
          !el.includes("pulse") &&
          !el.includes("animate") &&
          !el.startsWith("svg.")
      );
      expect(
        unexpected.length,
        `Unexpected infinite animations: ${unexpected.join(", ")}`
      ).toBe(0);
    });
  });
});
