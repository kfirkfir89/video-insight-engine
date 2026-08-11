import { test, expect } from "./fixtures";

test.describe("Conditional Tooltip — Only When Truncated", () => {
  test("should NOT show title tooltip when video name is fully visible", async ({
    authenticatedPage: page,
  }) => {
    // Use a wide viewport so sidebar titles don't truncate
    await page.setViewportSize({ width: 1600, height: 800 });

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Find a video item (short titles like "Me at the zoo" won't truncate at wide width)
    const videoItem = sidebar.locator('[data-sidebar-item="video"]', {
      hasText: "Me at the zoo",
    });
    await expect(videoItem).toBeVisible();

    // Verify the title text is NOT truncated
    const isTruncated = await videoItem.locator("a.truncate").evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    expect(isTruncated).toBe(false);

    // Hover over the video item and wait longer than tooltip delay (400ms)
    await videoItem.hover();
    await page.waitForTimeout(600);

    // Title tooltip should NOT appear
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).not.toBeVisible();
  });

  test("should show title tooltip when video name is truncated", async ({
    authenticatedPage: page,
  }) => {
    const longTitle = "This Is An Extremely Long Video Title That Should Definitely Get Truncated In The Sidebar";

    // Override videos mock with a long title
    await page.route("**/api/videos", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            videos: [
              {
                id: "video-long",
                videoSummaryId: "summary-long",
                youtubeId: "abc123",
                title: longTitle,
                channel: "Test",
                duration: 100,
                thumbnailUrl: "",
                status: "completed",
                folderId: null,
                createdAt: "2024-01-01T00:00:00Z",
              },
            ],
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.reload();
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    const videoItem = sidebar.locator('[data-sidebar-item="video"]', {
      hasText: longTitle,
    });
    await expect(videoItem).toBeVisible();

    // Verify the title text IS truncated
    const isTruncated = await videoItem.locator("a.truncate").evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    expect(isTruncated).toBe(true);

    // Hover over the video item and wait for tooltip delay
    await videoItem.hover();
    await page.waitForTimeout(600);

    // Title tooltip SHOULD appear
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(longTitle);
  });

  test("should NOT show folder tooltip when folder name is fully visible", async ({
    authenticatedPage: page,
  }) => {
    // This test needs folders — mock a folder with a short name
    // The default fixtures return empty folders, so we override
    await page.route(/\/api\/folders(\?.*)?$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          folders: [
            { id: "folder-1", name: "Short", parentId: null, type: "summary", color: null, sortOrder: 0 },
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 1600, height: 800 });
    await page.reload();
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    const folderItem = sidebar.locator('[data-sidebar-item="folder"]', {
      hasText: "Short",
    });
    await expect(folderItem).toBeVisible();

    // Verify NOT truncated
    const isTruncated = await folderItem.locator("span.truncate").evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    expect(isTruncated).toBe(false);

    // Hover and wait
    await folderItem.hover();
    await page.waitForTimeout(600);

    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).not.toBeVisible();
  });

  test("should show folder tooltip when folder name is truncated", async ({
    authenticatedPage: page,
  }) => {
    // Mock a folder with a very long name that will truncate
    await page.route(/\/api\/folders(\?.*)?$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          folders: [
            {
              id: "folder-1",
              name: "This Is A Very Long Folder Name That Should Definitely Be Truncated In The Sidebar",
              parentId: null,
              type: "summary",
              color: null,
              sortOrder: 0,
            },
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 700, height: 800 });
    await page.reload();
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    const folderItem = sidebar.locator('[data-sidebar-item="folder"]', {
      hasText: "This Is A Very Long Folder Name",
    });
    await expect(folderItem).toBeVisible();

    // Verify IS truncated
    const isTruncated = await folderItem.locator("span.truncate").evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    expect(isTruncated).toBe(true);

    // Hover and wait
    await folderItem.hover();
    await page.waitForTimeout(600);

    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
  });
});
