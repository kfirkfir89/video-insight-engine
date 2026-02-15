import { test, expect } from "./fixtures";

test.describe("Sidebar Header Redesign", () => {
  test.describe("Sidebar Structure & Hierarchy", () => {
    test("should render sidebar with new component hierarchy", async ({
      authenticatedPage: page,
    }) => {
      // Wait for sidebar to load
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      // SidebarHeader: logo + branding
      const brandingText = sidebar.getByText("Video Insight");
      await expect(brandingText).toBeVisible();

      // Theme toggle should be in the sidebar footer
      const themeToggle = sidebar.getByRole("button", {
        name: "Toggle theme",
      });
      await expect(themeToggle).toBeVisible();

      // User dropdown should be in sidebar footer
      const userButton = sidebar.locator(
        '[data-slot="dropdown-menu-trigger"]'
      );
      await expect(userButton.first()).toBeVisible();

      // URL input should be present
      const urlInput = sidebar.getByPlaceholder("Paste YouTube URL...");
      await expect(urlInput).toBeVisible();

      // Toolbar controls: search, selection, collapse, sort, text size
      const searchInput = sidebar.getByPlaceholder(
        "Search folders and videos..."
      );
      await expect(searchInput).toBeVisible();

      // SidebarTabs: Summaries and Memorized tabs
      const summariesTab = sidebar.getByText("Summaries");
      await expect(summariesTab).toBeVisible();

      const memorizedTab = sidebar.getByText("Memorized");
      await expect(memorizedTab).toBeVisible();

      // SidebarFooter: video count
      const footer = sidebar.getByText(/video/);
      await expect(footer.last()).toBeVisible();
    });

    test("should have correct visual hierarchy order (top to bottom)", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      // Get bounding boxes of key elements to verify order
      const brandingBox = await sidebar
        .getByText("Video Insight")
        .boundingBox();
      const urlInputBox = await sidebar
        .getByPlaceholder("Paste YouTube URL...")
        .boundingBox();
      const searchBox = await sidebar
        .getByPlaceholder("Search folders and videos...")
        .boundingBox();
      const summariesTabBox = await sidebar
        .getByText("Summaries")
        .boundingBox();

      expect(brandingBox).not.toBeNull();
      expect(urlInputBox).not.toBeNull();
      expect(searchBox).not.toBeNull();
      expect(summariesTabBox).not.toBeNull();

      // Verify top-to-bottom order
      expect(brandingBox!.y).toBeLessThan(urlInputBox!.y);
      expect(urlInputBox!.y).toBeLessThan(searchBox!.y);
      expect(searchBox!.y).toBeLessThan(summariesTabBox!.y);
    });

    test("should show sidebar toggle in sidebar header", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      const toggleButton = sidebar.getByTitle("Hide sidebar");
      await expect(toggleButton).toBeVisible();
    });

    test("should show add folder button in tabs", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      // Find the Plus button (add folder) in the tab bar area
      const newFolderTooltipTrigger = sidebar.locator("button").filter({
        has: page.locator('svg.lucide-plus'),
      });
      await expect(newFolderTooltipTrigger).toBeVisible();
    });
  });

  test.describe("Tab Switching", () => {
    test("should switch between Summaries and Memorized tabs", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");

      // Summaries should be active by default
      const summariesTab = sidebar.getByText("Summaries");
      const memorizedTab = sidebar.getByText("Memorized");

      // Click Memorized tab
      await memorizedTab.click();
      await page.waitForTimeout(300);

      // Click back to Summaries
      await summariesTab.click();
      await page.waitForTimeout(300);

      // Should still be functional
      await expect(summariesTab).toBeVisible();
    });
  });

  test.describe("No Global Header", () => {
    test("should not have a global header element", async ({
      authenticatedPage: page,
    }) => {
      // There should be no <header> element on the page
      const header = page.locator("header");
      await expect(header).not.toBeVisible();
    });

    test("should have app icon linking to home page", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      // The branding link should navigate to home
      const brandingLink = sidebar.locator('a[href="/"]').filter({
        hasText: "Video Insight",
      });
      await expect(brandingLink).toBeVisible();
    });

    test("should show theme toggle and user profile in footer", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      // Footer area should have theme toggle and user dropdown
      const themeToggle = sidebar.getByRole("button", { name: "Toggle theme" });
      const userDropdown = sidebar.locator('[data-slot="dropdown-menu-trigger"]');

      await expect(themeToggle).toBeVisible();
      await expect(userDropdown.first()).toBeVisible();

      // Verify they're at the bottom of the sidebar
      const themeBox = await themeToggle.boundingBox();
      const brandingBox = await sidebar.getByText("Video Insight").boundingBox();
      expect(themeBox).not.toBeNull();
      expect(brandingBox).not.toBeNull();
      expect(themeBox!.y).toBeGreaterThan(brandingBox!.y);
    });
  });

  test.describe("No Horizontal Overflow", () => {
    test("sidebar should not have horizontal overflow", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      const hasOverflow = await sidebar.evaluate((el) => {
        return el.scrollWidth > el.clientWidth;
      });

      expect(hasOverflow).toBe(false);
    });

    test("page body should not have horizontal overflow", async ({
      authenticatedPage: page,
    }) => {
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });

      expect(hasOverflow).toBe(false);
    });
  });

  test.describe("Responsivity & Resize", () => {
    test("sidebar should maintain layout at minimum width (200px)", async ({
      authenticatedPage: page,
    }) => {
      // Set viewport to push sidebar narrow
      await page.setViewportSize({ width: 800, height: 600 });
      await page.waitForTimeout(300);

      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      // Key elements should still be visible
      const branding = sidebar.getByText("Video Insight");
      await expect(branding).toBeVisible();

      const urlInput = sidebar.getByPlaceholder("Paste YouTube URL...");
      await expect(urlInput).toBeVisible();

      const tabs = sidebar.getByText("Summaries");
      await expect(tabs).toBeVisible();
    });

    test("should toggle sidebar visibility", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      // Click toggle button in sidebar header
      const hideButton = sidebar.getByTitle("Hide sidebar");
      await hideButton.click();
      await page.waitForTimeout(300);

      // Sidebar should be hidden
      await expect(sidebar).not.toBeVisible();

      // Floating toggle should appear in main content
      const showButton = page.locator("main").getByTitle("Show sidebar");
      await expect(showButton).toBeVisible();
      await showButton.click();
      await page.waitForTimeout(300);

      // Sidebar should be visible again
      await expect(sidebar).toBeVisible();
    });

    test("should show floating toggle when sidebar is closed", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      // Close sidebar
      const hideButton = sidebar.getByTitle("Hide sidebar");
      await hideButton.click();
      await page.waitForTimeout(300);

      // Floating toggle should be visible in main
      const floatingToggle = page.locator("main").getByTitle("Show sidebar");
      await expect(floatingToggle).toBeVisible();
    });

    test("layout should fill viewport without scrollbars", async ({
      authenticatedPage: page,
    }) => {
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      const bodyHeight = await page.evaluate(
        () => document.body.scrollHeight
      );

      // Body should not exceed viewport (no vertical scrollbar on layout shell)
      expect(bodyHeight).toBeLessThanOrEqual(viewportHeight + 1); // 1px tolerance
    });

    test("sidebar and main content should fill available height", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      const main = page.locator("main");

      const sidebarBox = await sidebar.boundingBox();
      const mainBox = await main.boundingBox();

      expect(sidebarBox).not.toBeNull();
      expect(mainBox).not.toBeNull();

      const viewportHeight = await page.evaluate(() => window.innerHeight);

      // Both sidebar and main should fill the full viewport height (no header)
      expect(sidebarBox!.height).toBeGreaterThan(viewportHeight - 5);
      expect(mainBox!.height).toBeGreaterThan(viewportHeight - 5);
    });
  });

  test.describe("Dropdown Glass Effect", () => {
    test("sort dropdown should have glass styling", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");

      // Click the sort button
      const sortButton = sidebar.getByLabel("Change sort order");
      await sortButton.click();

      // The dropdown content should appear
      const dropdownContent = page.locator(
        '[data-slot="dropdown-menu-content"]'
      );
      await expect(dropdownContent).toBeVisible();

      // Check for backdrop-blur (glass effect)
      const hasBackdropBlur = await dropdownContent.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const backdropFilter = style.getPropertyValue("backdrop-filter");
        return backdropFilter.includes("blur");
      });
      expect(hasBackdropBlur).toBe(true);

      // Check for rounded-lg (border radius)
      const borderRadius = await dropdownContent.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return parseFloat(style.borderRadius);
      });
      expect(borderRadius).toBeGreaterThanOrEqual(8); // rounded-lg = 0.5rem = 8px

      // Should have "Sort by" label
      const sortByLabel = dropdownContent.getByText("Sort by");
      await expect(sortByLabel).toBeVisible();
    });
  });

  test.describe("Visual Polish", () => {
    test("active video should have brand-colored left border", async ({
      authenticatedPage: page,
    }) => {
      // Navigate to video detail page to make a video "active"
      await page.goto("/video/video-1");
      await page.waitForTimeout(500);

      // Use first aside (sidebar) - video detail page has a second aside for sticky chapter nav
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeVisible();

      // Find the active video item
      const activeVideo = sidebar.locator(
        '[data-sidebar-item="video"]',
        {
          has: page.getByText("Never Gonna Give You Up"),
        }
      );
      await expect(activeVideo).toBeVisible();

      // Check the element has the active state classes (border-l-2 border-l-primary)
      const classAttr = await activeVideo.getAttribute("class");
      expect(classAttr).toContain("border-l-2");
      expect(classAttr).toContain("border-l-primary");
      expect(classAttr).toContain("font-medium");
    });

    test("resize handle should be transparent by default", async ({
      authenticatedPage: page,
    }) => {
      // The resize handle is between sidebar and content
      const resizeHandle = page.locator(".cursor-col-resize");
      await expect(resizeHandle).toBeVisible();

      const bgColor = await resizeHandle.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.backgroundColor;
      });

      // Should be transparent (rgba(0,0,0,0))
      expect(bgColor).toMatch(
        /rgba\(0,\s*0,\s*0,\s*0\)|transparent/
      );
    });
  });
});
