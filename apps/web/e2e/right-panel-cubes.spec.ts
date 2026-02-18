import { test, expect } from "./fixtures";

test.describe("Right Panel Cubes — In-Place Expansion", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const VIDEO_URL = "/video/video-1";
  /** Animation is 1200ms — wait 1400ms for it to settle */
  const ANIM_WAIT = 1400;
  /** Must match RIGHT_PANEL_WIDTH / CUBE_STRIP_WIDTH in Layout.tsx */
  const PANEL_WIDTH = 360;
  const CUBE_WIDTH = 64;

  /** Navigate to video page and wait for cube strip to render */
  async function navigateAndWaitForCubes(page: import("@playwright/test").Page) {
    await page.goto(VIDEO_URL);
    await page.getByTestId("cube-strip").waitFor({ state: "visible", timeout: 10000 });
  }

  test.describe("Cube Visibility", () => {
    test("should show three cube buttons on large desktop", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      await expect(page.getByTestId("cube-minimap")).toBeVisible();
      await expect(page.getByTestId("cube-chapters")).toBeVisible();
      await expect(page.getByTestId("cube-chat")).toBeVisible();
    });

    test("should show floating cubes at narrow viewport (<1280px)", async ({
      authenticatedPage: page,
    }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto(VIDEO_URL);
      await page.waitForTimeout(1000);

      // Layout aside should not be visible
      const cubeRail = page.getByTestId("right-cube-rail");
      await expect(cubeRail).not.toBeVisible();

      // But floating cube strip should be visible
      const cubeStrip = page.getByTestId("cube-strip");
      await expect(cubeStrip).toBeVisible();
    });
  });

  test.describe("In-Place Panel Expansion", () => {
    test("should expand cube into full-height panel when clicked", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      await page.getByTestId("cube-chapters").click();
      await page.waitForTimeout(ANIM_WAIT);

      const panel = page.getByTestId("expanded-panel");
      await expect(panel).toBeVisible();

      const aside = page.getByTestId("right-cube-rail");
      const asideBox = await aside.boundingBox();
      expect(asideBox).not.toBeNull();
      expect(asideBox!.width).toBeCloseTo(PANEL_WIDTH, -1);
    });

    test("should collapse panel when same cube clicked again — rail shrinks to cube strip", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      await page.getByTestId("cube-chapters").click();
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).toBeVisible();

      await page.getByTestId("cube-chapters").click();
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).not.toBeVisible();

      // Rail shrinks to cube strip width (64px) when no panel is active
      const rail = page.getByTestId("right-cube-rail");
      const railBox = await rail.boundingBox();
      expect(railBox).not.toBeNull();
      expect(railBox!.width).toBeCloseTo(CUBE_WIDTH, -1);
    });

    test("should switch panel when different cube is clicked", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      await page.getByTestId("cube-chapters").click();
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).toHaveAttribute("aria-label", "Chapters");

      await page.getByTestId("cube-chat").click();
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).toHaveAttribute("aria-label", "Chat");
    });

    test("should close panel when Escape key is pressed", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      await page.getByTestId("cube-chat").click();
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).toBeVisible();

      await page.keyboard.press("Escape");
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).not.toBeVisible();
    });

    test("should close panel when clicking outside (blur)", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      await page.getByTestId("cube-chapters").click();
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).toBeVisible();

      // Click on main content area (outside the cube strip)
      // Click at center of viewport to trigger the click-outside handler
      await page.mouse.click(600, 400);
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).not.toBeVisible();
    });
  });

  test.describe("Cube Styling", () => {
    test("inactive cubes should have colored background with white icon", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      // Cubes should have solid colored backgrounds (not transparent)
      for (const id of ["cube-minimap", "cube-chapters", "cube-chat"]) {
        const bgColor = await page.getByTestId(id).evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });
        // Should NOT be transparent
        expect(bgColor).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
      }

      // Icons inside cubes should be white
      for (const id of ["cube-minimap", "cube-chapters", "cube-chat"]) {
        const color = await page.getByTestId(id).evaluate((el) => {
          return window.getComputedStyle(el).color;
        });
        // White = rgb(255, 255, 255)
        expect(color).toBe("rgb(255, 255, 255)");
      }
    });

    test("expanded panel should have colored tint background", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      await page.getByTestId("cube-chapters").click();
      await page.waitForTimeout(ANIM_WAIT);

      const bgColor = await page.getByTestId("expanded-panel").evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(bgColor).not.toBe("transparent");
    });

    test("aside container should have transparent background", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      const bgColor = await page.getByTestId("right-cube-rail").evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(bgColor).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
    });

    test("aside should have no left border", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      const borderLeft = await page.getByTestId("right-cube-rail").evaluate((el) => {
        return window.getComputedStyle(el).borderLeftWidth;
      });
      expect(borderLeft).toBe("0px");
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("should support focus, Enter to open, Escape to close", async ({
      authenticatedPage: page,
    }) => {
      await navigateAndWaitForCubes(page);

      const minimapCube = page.getByTestId("cube-minimap");
      await minimapCube.focus();
      await page.waitForTimeout(100);

      await page.keyboard.press("Enter");
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).toBeVisible();
      await expect(page.getByTestId("expanded-panel")).toHaveAttribute("aria-label", "Mini Map");

      await page.keyboard.press("Escape");
      await page.waitForTimeout(ANIM_WAIT);
      await expect(page.getByTestId("expanded-panel")).not.toBeVisible();
    });
  });
});
