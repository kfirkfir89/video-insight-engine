import { test, expect } from "./fixtures";

/**
 * V1.5 Layout Audit — Layout hierarchy, overflow, and responsivity.
 *
 * Routes tested: /board (authenticated home), /video/:id (detail)
 * Tests across 4 breakpoints: mobile (375), tablet (768), desktop (1280), wide (1440).
 *
 * NOTE: Authenticated users redirect from / to /board.
 */

// ─── Breakpoint constants ─────────────────────────────────────────────
const MOBILE = { width: 375, height: 667 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 800 };
const WIDE = { width: 1440, height: 900 };

// ─── Mock data for video detail page ──────────────────────────────────

const mockOutputData = {
  triage: {
    contentTags: ["learning"],
    modifiers: [],
    primaryTag: "learning",
    userGoal: "Understand the topic",
    tabs: [
      { id: "key_points", label: "Key Points", emoji: "\u{1F4A1}", dataSource: "learning.keyPoints" },
      { id: "concepts", label: "Concepts", emoji: "\u{1F4DA}", dataSource: "learning.concepts" },
    ],
    confidence: 0.9,
  },
  output: {
    learning: {
      keyPoints: [
        { emoji: "\u{1F511}", title: "Main Insight", detail: "Primary takeaway from the video.", timestamp: 45 },
        { emoji: "\u{1F4A1}", title: "Key Discovery", detail: "An important finding.", timestamp: 120 },
      ],
      concepts: [
        { name: "Core Concept", definition: "A fundamental idea.", emoji: "\u{1F4D6}" },
      ],
    },
  },
  synthesis: {
    tldr: "A comprehensive overview of the topic.",
    keyTakeaways: ["Key point 1", "Key point 2"],
    masterSummary: "Full summary of the video.",
    seoDescription: "Learn about key concepts.",
  },
  enrichment: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const html = document.documentElement;
    return {
      scrollWidth: html.scrollWidth,
      clientWidth: html.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `scrollWidth (${overflow.scrollWidth}) should not exceed clientWidth (${overflow.clientWidth})`
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/** Set up video detail mock with output data */
async function setupVideoDetailMock(page: import("@playwright/test").Page) {
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
            title: "Never Gonna Give You Up - Analysis",
            channel: "Rick Astley",
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

// ─── Layout Hierarchy Tests ───────────────────────────────────────────

test.describe("V1.5 — Layout Hierarchy", () => {
  test.describe("Desktop (1280px)", () => {
    test.use({ viewport: DESKTOP });

    test("board page has proper layout structure", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/board");
      // Board shows "All Videos" heading
      await page.waitForSelector("h1, h2", { timeout: 10000 });

      const hasContent = await page.evaluate(
        () => document.body.innerText.trim().length > 20
      );
      expect(hasContent).toBe(true);

      // Sidebar exists
      const sidebar = page.locator('aside').first();
      await expect(sidebar).toBeAttached();
    });

    test("video detail page has proper content hierarchy", async ({
      authenticatedPage: page,
    }) => {
      await setupVideoDetailMock(page);
      await page.goto("/video/video-1");
      // Wait for output shell or error boundary
      await page.waitForSelector(".max-w-4xl, h1, h2", { timeout: 10000 });

      // Page has content
      const hasContent = await page.evaluate(
        () => document.body.innerText.trim().length > 20
      );
      expect(hasContent).toBe(true);
    });
  });
});

// ─── Overflow Tests ───────────────────────────────────────────────────

test.describe("V1.5 — Overflow Audit", () => {
  test.describe("Wide (1440px)", () => {
    test.use({ viewport: WIDE });

    test("no horizontal overflow on board page", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/board");
      await page.waitForSelector("h1, h2", { timeout: 10000 });
      await expectNoHorizontalOverflow(page);
    });

    test("no horizontal overflow on video detail", async ({
      authenticatedPage: page,
    }) => {
      await setupVideoDetailMock(page);
      await page.goto("/video/video-1");
      await page.waitForSelector(".max-w-4xl, h1, h2", { timeout: 10000 });
      await expectNoHorizontalOverflow(page);
    });
  });

  test.describe("Tablet (768px)", () => {
    test.use({ viewport: TABLET });

    test("no horizontal overflow on board at tablet", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/board");
      await page.waitForSelector("h1, h2", { timeout: 10000 });
      await expectNoHorizontalOverflow(page);
    });

    test("no horizontal overflow on video detail at tablet", async ({
      authenticatedPage: page,
    }) => {
      await setupVideoDetailMock(page);
      await page.goto("/video/video-1");
      await page.waitForSelector(".max-w-4xl, h1, h2", { timeout: 10000 });
      await expectNoHorizontalOverflow(page);
    });
  });

  test.describe("Mobile (375px)", () => {
    test.use({ viewport: MOBILE });

    test("overflow bounded on mobile board", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/board");
      await page.waitForSelector("h1, h2", { timeout: 10000 });

      const overflowPx = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflowPx).toBeLessThan(10);
    });

    test("overflow bounded on mobile video detail", async ({
      authenticatedPage: page,
    }) => {
      await setupVideoDetailMock(page);
      await page.goto("/video/video-1");
      await page.waitForSelector(".max-w-4xl, h1, h2", { timeout: 10000 });

      const overflowPx = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflowPx).toBeLessThan(10);
    });

    test("content renders without crash on mobile", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/board");
      await page.waitForSelector("h1, h2", { timeout: 10000 });
      const hasContent = await page.evaluate(
        () => document.body.innerText.trim().length > 0
      );
      expect(hasContent).toBe(true);
    });
  });
});

// ─── Glass System Tests ───────────────────────────────────────────────

test.describe("V1.5 — Glass System (Bible Compliance)", () => {
  test.use({ viewport: DESKTOP });

  test("glass class should NOT have backdrop blur", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/board");
    await page.waitForSelector("h1, h2", { timeout: 10000 });

    const backdropFilter = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "glass";
      document.body.appendChild(el);
      const val = window.getComputedStyle(el).backdropFilter;
      el.remove();
      return val;
    });

    // Bible v1.5: regular .glass should NOT blur
    expect(backdropFilter).toMatch(/^(none|)$/);
  });

  test("glass-elevated class should have backdrop blur", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/board");
    await page.waitForSelector("h1, h2", { timeout: 10000 });

    const backdropFilter = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "glass-elevated";
      document.body.appendChild(el);
      const val = window.getComputedStyle(el).backdropFilter;
      el.remove();
      return val;
    });

    // Bible v1.5: .glass-elevated (nav, hero, modals) gets real blur
    expect(backdropFilter).toContain("blur");
  });
});

// ─── Responsivity Tests ───────────────────────────────────────────────

test.describe("V1.5 — Responsivity", () => {
  test("board page heading fits at tablet width", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(TABLET);
    await page.goto("/board");
    await page.waitForSelector("h1, h2", { timeout: 10000 });

    // Board heading should not overflow viewport
    const heading = page.locator("h1, h2").first();
    const box = await heading.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x + box!.width).toBeLessThanOrEqual(TABLET.width + 20);
  });

  test("video detail renders at mobile width", async ({
    authenticatedPage: page,
  }) => {
    await setupVideoDetailMock(page);
    await page.setViewportSize(MOBILE);
    await page.goto("/video/video-1");
    await page.waitForSelector(".max-w-4xl, h1, h2", { timeout: 10000 });

    const hasContent = await page.evaluate(
      () => document.body.innerText.trim().length > 20
    );
    expect(hasContent).toBe(true);
  });

  test("board video cards reflow at mobile", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/board");
    await page.waitForSelector("h1, h2", { timeout: 10000 });

    // Video cards should not overflow
    await expectNoHorizontalOverflow(page);
  });
});

// ─── CSS Performance Tests ────────────────────────────────────────────

test.describe("V1.5 — CSS Perf", () => {
  test.use({ viewport: WIDE });

  test("no infinite animations on video detail page", async ({
    authenticatedPage: page,
  }) => {
    await setupVideoDetailMock(page);
    await page.goto("/video/video-1");
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

  test("board page has no unexpected infinite animations", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/board");
    await page.waitForSelector("h1, h2", { timeout: 10000 });

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
