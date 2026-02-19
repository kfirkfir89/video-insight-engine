import { test, expect } from "./fixtures";

/**
 * Layout hierarchy, overflow, and responsivity audit for the right panel tabs refactor.
 * Validates that:
 * 1. Layout hierarchy is correct (no stacking context issues)
 * 2. No overflow/scroll leaks from the panel
 * 3. All three responsive breakpoints work correctly
 * 4. Panel doesn't clip content or create unwanted scrollbars
 */
test.describe("Right Panel — Layout Audit", () => {
  const VIDEO_URL = "/video/video-1";
  test.describe("Large Desktop (≥1280px) — Inline Panel", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("layout hierarchy: main content + right panel are flex siblings", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.getByTestId("right-panel-tabs").waitFor({ state: "visible", timeout: 10000 });

      // The right-panel-tabs should be inside a flex container alongside main content
      const parentDisplay = await page.getByTestId("right-panel-tabs").evaluate((el) => {
        // Walk up to find the flex container that holds both main content and panel
        const grandparent = el.closest("[class*='flex']");
        return grandparent ? window.getComputedStyle(grandparent).display : "none";
      });
      expect(parentDisplay).toBe("flex");
    });

    test("no horizontal overflow on body with always-open panel", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.getByTestId("right-panel-tabs").waitFor({ state: "visible", timeout: 10000 });

      // Panel is always open — check no horizontal scrollbar
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);
    });

    test("no vertical overflow leak from panel into body", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.getByTestId("right-panel-tabs").waitFor({ state: "visible", timeout: 10000 });

      // Panel is always open — check scroll containment
      const scrollContainerOverflow = await page.getByTestId("expanded-panel").evaluate((el) => {
        const scrollEl = el.querySelector("[class*='overflow-auto']");
        if (!scrollEl) return "not-found";
        return window.getComputedStyle(scrollEl).overflowY;
      });
      expect(["hidden", "auto", "scroll", "clip"]).toContain(scrollContainerOverflow);
    });

    test("main content area has min-w-0 to prevent flex blowout", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.getByTestId("right-panel-tabs").waitFor({ state: "visible", timeout: 10000 });

      // Panel is always open — check main content flex constraint
      const mainMinWidth = await page.evaluate(() => {
        const mainContent = document.querySelector("[class*='flex-1'][class*='min-w-0']");
        if (!mainContent) return "not-found";
        return window.getComputedStyle(mainContent).minWidth;
      });
      expect(mainMinWidth).toBe("0px");
    });

    test("panel is always 360px wide (no collapsed state)", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.getByTestId("right-panel-tabs").waitFor({ state: "visible", timeout: 10000 });

      // Panel should always be ~360px
      const panelWidth = await page.getByTestId("right-panel-tabs").evaluate((el) => {
        const container = el.parentElement!;
        return container.getBoundingClientRect().width;
      });
      expect(panelWidth).toBeGreaterThan(350);
      expect(panelWidth).toBeLessThan(370);
    });

    test("panel is sticky and stays visible when scrolling main content", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.getByTestId("right-panel-tabs").waitFor({ state: "visible", timeout: 10000 });

      // Get initial position
      const initialTop = await page.getByTestId("right-panel-tabs").evaluate((el) => {
        return el.getBoundingClientRect().top;
      });

      // Scroll just past the header (moderate scroll — not past the short mock content)
      await page.evaluate(() => {
        // Target the main content scroll container specifically
        const wrapper = document.querySelector('[class*="flex-1"][class*="min-w-0"]');
        const scrollable = wrapper?.querySelector('[class*="overflow-auto"]');
        if (scrollable) scrollable.scrollTop = 300;
      });
      await page.waitForTimeout(200);

      const afterScrollTop = await page.getByTestId("right-panel-tabs").evaluate((el) => {
        return el.getBoundingClientRect().top;
      });

      // After scrolling 300px, the panel should have moved less than 300px
      // (sticky keeps it closer to the viewport top than it would be without sticky)
      const movement = initialTop - afterScrollTop;
      expect(movement).toBeGreaterThan(0); // Panel did move (header scrolled)
      expect(movement).toBeLessThan(300); // But less than the full scroll distance (sticky engaged)
    });
  });

  test.describe("Medium Desktop (1024px) — Floating Panel", () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test("floating panel has correct z-index to overlay content", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.waitForTimeout(2000);

      const tabStrip = page.getByTestId("right-panel-tabs");
      await expect(tabStrip).toBeVisible();

      // Parent should have z-50 (z-index: 50)
      const zIndex = await tabStrip.evaluate((el) => {
        const parent = el.parentElement!;
        return window.getComputedStyle(parent).zIndex;
      });
      expect(parseInt(zIndex)).toBeGreaterThanOrEqual(50);
    });

    test("floating panel doesn't overflow viewport horizontally", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.waitForTimeout(2000);

      // Panel is always open
      const panel = page.getByTestId("expanded-panel");
      await expect(panel).toBeVisible();

      const panelBox = await panel.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { right: rect.right, viewportWidth: window.innerWidth };
      });
      expect(panelBox.right).toBeLessThanOrEqual(panelBox.viewportWidth + 5);
    });

    test("floating panel has correct dimensions", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.waitForTimeout(2000);

      // Always-open floating panel should be ~320px wide
      const tabStripBox = await page.getByTestId("right-panel-tabs").evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });

      expect(tabStripBox.width).toBeGreaterThan(300);
      expect(tabStripBox.width).toBeLessThan(330);
      expect(tabStripBox.height).toBeGreaterThan(200);
    });
  });

  test.describe("Mobile (375px) — No Right Panel", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("right panel tabs should not exist in DOM on mobile", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.waitForTimeout(2000);

      // On mobile (<768px), VideoDetailMobile is rendered, not VideoDetailDesktop
      // So right-panel-tabs should not be in the DOM at all
      const tabCount = await page.getByTestId("right-panel-tabs").count();
      expect(tabCount).toBe(0);
    });

    test("no horizontal overflow on mobile", async ({
      authenticatedPage: page,
    }) => {
      await page.goto(VIDEO_URL);
      await page.waitForTimeout(2000);

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);
    });
  });

  test.describe("Dashboard — No Right Panel", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("dashboard page should not show right panel tabs", async ({
      authenticatedPage: page,
    }) => {
      // Dashboard is the root page
      await page.goto("/");
      await page.waitForTimeout(1000);

      const tabCount = await page.getByTestId("right-panel-tabs").count();
      expect(tabCount).toBe(0);
    });
  });
});
