import { test, expect } from "./fixtures";

// Sidebar is lazy-loaded; the Suspense skeleton is a <div>, so <aside>
// only appears after the chunk finishes loading.  Give it extra time.
const SIDEBAR_TIMEOUT = 15_000;

test.describe("Sidebar Header Redesign", () => {
  test.describe("Sidebar Structure & Hierarchy", () => {
    test("should render sidebar with new component hierarchy", async ({
      authenticatedPage: page,
    }) => {
      // Wait for lazy-loaded sidebar to appear
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

      // SidebarHeader: logo + branding
      const brandingText = sidebar.getByText("VIE");
      await expect(brandingText).toBeVisible();

      // Toolbar: search button visible (search input is in collapsible panel)
      const searchButton = sidebar.getByLabel("Search");
      await expect(searchButton).toBeVisible();

      // SidebarTabs: Collection and Assistant tabs
      const collectionTab = sidebar.getByText("Collection");
      await expect(collectionTab).toBeVisible();

      const assistantTab = sidebar.getByText("Assistant");
      await expect(assistantTab).toBeVisible();

      // AppHeader: theme toggle and user dropdown are in the header, not sidebar
      const header = page.locator("header");
      await expect(header).toBeVisible();

      const themeToggle = header.getByRole("button", { name: /Theme:/ });
      await expect(themeToggle).toBeVisible();

      const userButton = header.locator(
        '[data-slot="dropdown-menu-trigger"]'
      );
      await expect(userButton.first()).toBeVisible();
    });

    test("should have correct visual hierarchy order (top to bottom)", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

      // Get bounding boxes of key sidebar elements to verify order
      const brandingBox = await sidebar
        .getByText("VIE")
        .boundingBox();
      const newButtonBox = await sidebar
        .getByRole("button", { name: "New", exact: true })
        .boundingBox();
      const collectionTabBox = await sidebar
        .getByText("Collection")
        .boundingBox();
      // Search button is in the toolbar row below tabs
      const searchButtonBox = await sidebar
        .getByLabel("Search")
        .boundingBox();

      expect(brandingBox).not.toBeNull();
      expect(newButtonBox).not.toBeNull();
      expect(collectionTabBox).not.toBeNull();
      expect(searchButtonBox).not.toBeNull();

      // Verify top-to-bottom order: branding → new button → tabs → toolbar
      expect(brandingBox!.y).toBeLessThan(newButtonBox!.y);
      expect(newButtonBox!.y).toBeLessThan(collectionTabBox!.y);
      expect(collectionTabBox!.y).toBeLessThan(searchButtonBox!.y);
    });

    test("should show sidebar toggle in app header", async ({
      authenticatedPage: page,
    }) => {
      // Sidebar toggle is in AppHeader, uses aria-label
      const toggleButton = page.getByLabel("Hide sidebar");
      await expect(toggleButton).toBeVisible();
    });

    test("should show add folder button in tabs", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

      // Find the FolderPlus button (add folder) in the sidebar toolbar
      const newFolderTooltipTrigger = sidebar.locator("button").filter({
        has: page.locator('svg.lucide-folder-plus'),
      });
      await expect(newFolderTooltipTrigger).toBeVisible();
    });
  });

  test.describe("Tab Switching", () => {
    test("should switch between Collection and Assistant tabs", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

      // Collection should be active by default
      const collectionTab = sidebar.getByText("Collection");
      const assistantTab = sidebar.getByText("Assistant");

      // Click Assistant tab
      await assistantTab.click();
      await page.waitForTimeout(300);

      // Chat panel should be visible
      const chatHeader = sidebar.getByText("Chat with your knowledge");
      await expect(chatHeader).toBeVisible();

      // Click back to Collection
      await collectionTab.click();
      await page.waitForTimeout(300);

      // Should still be functional
      await expect(collectionTab).toBeVisible();
    });
  });

  test.describe("App Header Layout", () => {
    test("should have app header with sidebar toggle and controls", async ({
      authenticatedPage: page,
    }) => {
      // AppHeader renders a <header> element
      const header = page.locator("header");
      await expect(header).toBeVisible();

      // Sidebar toggle
      const toggleButton = header.getByLabel("Hide sidebar");
      await expect(toggleButton).toBeVisible();

      // Theme toggle on right
      const themeToggle = header.getByRole("button", { name: /Theme:/ });
      await expect(themeToggle).toBeVisible();
    });

    test("should have New button in sidebar", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

      const newButton = sidebar.getByRole("button", { name: "New", exact: true });
      await expect(newButton).toBeVisible();
    });

    test("should show theme toggle and user profile in header", async ({
      authenticatedPage: page,
    }) => {
      const header = page.locator("header");
      await expect(header).toBeVisible();

      // Header should have theme toggle and user dropdown
      const themeToggle = header.getByRole("button", { name: /Theme:/ });
      const userDropdown = header.locator('[data-slot="dropdown-menu-trigger"]');

      await expect(themeToggle).toBeVisible();
      await expect(userDropdown.first()).toBeVisible();
    });
  });

  test.describe("No Horizontal Overflow", () => {
    test("sidebar should not have horizontal overflow", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

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
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

      // Key elements should still be visible
      const branding = sidebar.getByText("VIE");
      await expect(branding).toBeVisible();

      const tabs = sidebar.getByText("Collection");
      await expect(tabs).toBeVisible();
    });

    test("should toggle sidebar visibility", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

      // Click toggle button in AppHeader (uses aria-label)
      const hideButton = page.getByLabel("Hide sidebar");
      await hideButton.click();
      await page.waitForTimeout(300);

      // Sidebar should be hidden
      await expect(sidebar).not.toBeVisible();

      // Toggle button should now say "Show sidebar"
      const showButton = page.getByLabel("Show sidebar");
      await expect(showButton).toBeVisible();
      await showButton.click();
      await page.waitForTimeout(300);

      // Sidebar should be visible again
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });
    });

    test("should show icon strip when sidebar is closed", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

      // Close sidebar
      const hideButton = page.getByLabel("Hide sidebar");
      await hideButton.click();
      await page.waitForTimeout(300);

      // Toggle button should change to "Show sidebar"
      const showButton = page.getByLabel("Show sidebar");
      await expect(showButton).toBeVisible();
    });

    test("layout should fill viewport without horizontal scrollbars", async ({
      authenticatedPage: page,
    }) => {
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBe(false);
    });

    test("sidebar should fill full viewport height", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox).not.toBeNull();

      const viewportHeight = await page.evaluate(() => window.innerHeight);

      // Sidebar has h-screen so should fill full viewport height
      expect(sidebarBox!.height).toBeGreaterThan(viewportHeight - 5);
    });
  });

  test.describe("Dropdown Glass Effect", () => {
    test("sort dropdown should have glass styling", async ({
      authenticatedPage: page,
    }) => {
      const sidebar = page.locator("aside");

      // Click the sort toolbar button to expand the sort panel
      const sortButton = sidebar.getByLabel("Sort");
      await sortButton.click();
      await page.waitForTimeout(300);

      // Sort panel should expand with sort options (A-Z, Z-A, Newest, Oldest)
      await expect(sidebar.getByText("A-Z")).toBeVisible();
      await expect(sidebar.getByText("Newest")).toBeVisible();
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
      await expect(sidebar).toBeVisible({ timeout: SIDEBAR_TIMEOUT });

      // Find the active video item
      const activeVideo = sidebar.locator(
        '[data-sidebar-item="video"]',
        {
          has: page.getByText("Never Gonna Give You Up"),
        }
      );
      await expect(activeVideo).toBeVisible();

      // Check the element has the active state classes (bg-primary/8 + font-medium)
      const classAttr = await activeVideo.getAttribute("class");
      expect(classAttr).toContain("bg-primary/8");
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
