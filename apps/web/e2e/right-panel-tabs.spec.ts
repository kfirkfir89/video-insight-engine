import { test, expect } from "./fixtures";

test.describe("Right Panel Tabs — Always-Open Tab Bar", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const VIDEO_URL = "/video/video-1";
  const ANIM_WAIT = 500;

  /** Navigate to video page and wait for tab panel to render */
  async function navigateAndWaitForTabs(page: import("@playwright/test").Page) {
    await page.goto(VIDEO_URL);
    await page.getByTestId("right-panel-tabs").waitFor({ state: "visible", timeout: 10000 });
  }

  test.describe("Tab Visibility", () => {
    test("should show three tab buttons on large desktop", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForTabs(page);

      await expect(page.getByTestId("tab-minimap")).toBeVisible();
      await expect(page.getByTestId("tab-chapters")).toBeVisible();
      await expect(page.getByTestId("tab-chat")).toBeVisible();
    });

    test("tab bar and content panel are always visible (no collapsed state)", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForTabs(page);

      // Expanded panel should be visible immediately (no click needed)
      await expect(page.getByTestId("expanded-panel")).toBeVisible();

      // Chapters is the default active tab
      await expect(page.getByTestId("expanded-panel")).toHaveAttribute("aria-label", "Chapters");
    });

    test("should show floating tabs at narrow viewport (<1280px)", async ({
      authenticatedPage: page,
    }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto(VIDEO_URL);
      await page.waitForTimeout(1000);

      const tabStrip = page.getByTestId("right-panel-tabs");
      await expect(tabStrip).toBeVisible();

      // Content should also be visible
      await expect(page.getByTestId("expanded-panel")).toBeVisible();
    });
  });

  test.describe("Tab Switching", () => {
    test("should switch panel content when different tab is clicked", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForTabs(page);

      // Default is chapters
      await expect(page.getByTestId("expanded-panel")).toHaveAttribute("aria-label", "Chapters");

      // Switch to chat
      await page.getByTestId("tab-chat").click();
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).toHaveAttribute("aria-label", "Chat");

      // Switch to minimap
      await page.getByTestId("tab-minimap").click();
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).toHaveAttribute("aria-label", "Mini Map");
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("should support tab focus and Enter to switch tabs", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForTabs(page);

      const chatTab = page.getByTestId("tab-chat");
      await chatTab.focus();
      await page.waitForTimeout(100);

      await page.keyboard.press("Enter");
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).toHaveAttribute("aria-label", "Chat");
    });
  });

  test.describe("Responsive Layout", () => {
    test("large desktop (≥1280px) should show inline panel", async ({
      authenticatedPage: page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await navigateAndWaitForTabs(page);

      const tabStrip = page.getByTestId("right-panel-tabs");
      await expect(tabStrip).toBeVisible();

      // Should NOT have fixed positioning (inline)
      const position = await tabStrip.evaluate((el) => {
        return window.getComputedStyle(el).position;
      });
      expect(position).not.toBe("fixed");
    });

    test("medium desktop (<1280px) should show floating panel", async ({
      authenticatedPage: page,
    }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto(VIDEO_URL);
      await page.waitForTimeout(1000);

      const tabStrip = page.getByTestId("right-panel-tabs");
      await expect(tabStrip).toBeVisible();

      // Parent should have fixed positioning
      const parentPosition = await tabStrip.evaluate((el) => {
        return window.getComputedStyle(el.parentElement!).position;
      });
      expect(parentPosition).toBe("fixed");
    });

    test("mobile (<768px) should not show right panel", async ({
      authenticatedPage: page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(VIDEO_URL);
      await page.waitForTimeout(1000);

      const tabStrip = page.getByTestId("right-panel-tabs");
      await expect(tabStrip).not.toBeVisible();
    });
  });
});
