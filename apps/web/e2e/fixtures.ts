import { test as base, Page } from "@playwright/test";

// Mock data for tests
export const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
};

export const mockVideos = [
  {
    id: "video-1",
    videoSummaryId: "summary-1",
    youtubeId: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    channel: "Rick Astley",
    duration: 213,
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    status: "completed" as const,
    folderId: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "video-2",
    videoSummaryId: "summary-2",
    youtubeId: "9bZkp7q19f0",
    title: "PSY - GANGNAM STYLE",
    channel: "officialpsy",
    duration: 252,
    thumbnailUrl: "https://i.ytimg.com/vi/9bZkp7q19f0/maxresdefault.jpg",
    status: "completed" as const,
    folderId: null,
    createdAt: "2024-01-02T00:00:00Z",
  },
  {
    id: "video-3",
    videoSummaryId: "summary-3",
    youtubeId: "jNQXAC9IVRw",
    title: "Me at the zoo",
    channel: "jawed",
    duration: 19,
    thumbnailUrl: "https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
    status: "processing" as const,
    folderId: null,
    createdAt: "2024-01-03T00:00:00Z",
  },
];

export const mockVideoSummary = {
  tldr: "This is a summary of the video content.",
  keyTakeaways: ["Key point 1", "Key point 2", "Key point 3"],
  sections: [
    {
      id: "section-1",
      timestamp: "0:00",
      startSeconds: 0,
      endSeconds: 30,
      title: "Introduction",
      summary: "The video starts with an introduction.",
      bullets: ["Opening remarks", "Setting the scene"],
    },
    {
      id: "section-2",
      timestamp: "0:30",
      startSeconds: 30,
      endSeconds: 90,
      title: "Main Content",
      summary: "The main content of the video.",
      bullets: ["First point", "Second point"],
    },
    {
      id: "section-3",
      timestamp: "1:30",
      startSeconds: 90,
      endSeconds: 180,
      title: "Conclusion",
      summary: "The video concludes with final thoughts.",
      bullets: ["Summary", "Call to action"],
    },
  ],
  concepts: [
    {
      id: "concept-1",
      name: "Main Concept",
      definition: "Definition of the main concept.",
      timestamp: "0:45",
    },
  ],
};

// Setup API mocks
async function setupApiMocks(page: Page) {
  await page.route("**/api/auth/me", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockUser),
    });
  });

  await page.route("**/api/videos", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ videos: mockVideos }),
      });
    } else {
      route.continue();
    }
  });

  await page.route(/\/api\/videos\/[^/]+$/, (route) => {
    const url = route.request().url();
    const videoId = url.split("/").pop()?.split("?")[0];
    const video = mockVideos.find((v) => v.id === videoId);

    if (route.request().method() === "GET") {
      if (video) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            video,
            summary: video.status === "completed" ? mockVideoSummary : null,
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            video: mockVideos[0],
            summary: mockVideoSummary,
          }),
        });
      }
    } else {
      route.continue();
    }
  });

  // Use regex to avoid matching JS module requests
  await page.route(/\/api\/folders(\?.*)?$/, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ folders: [] }),
    });
  });
}

// Extended test fixture with authentication
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Set up API mocks first
    await setupApiMocks(page);

    // Navigate to login to establish origin for localStorage
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Set localStorage with auth state (Zustand persist format)
    await page.evaluate(() => {
      const authState = {
        state: {
          accessToken: "mock-token-123",
          user: {
            id: "user-123",
            email: "test@example.com",
            name: "Test User",
          },
        },
        version: 0,
      };
      localStorage.setItem("vie-auth", JSON.stringify(authState));
    });

    // Navigate to dashboard - this picks up the localStorage state
    await page.goto("/", { waitUntil: "networkidle" });

    await use(page);
  },
});

export { expect } from "@playwright/test";
