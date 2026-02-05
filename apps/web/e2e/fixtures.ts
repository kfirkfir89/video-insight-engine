import { test as base, Page } from "@playwright/test";

// Auth timeout configurable via environment variable (default 15s)
const AUTH_TIMEOUT = parseInt(process.env.E2E_AUTH_TIMEOUT || "15000", 10);

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

// Factory function for creating mock chapters
// Uses content blocks as the source of truth (summary/bullets are deprecated)
const createMockChapter = (
  id: string,
  title: string,
  startSeconds: number,
  endSeconds: number,
  summaryText: string,
  bulletItems: string[]
) => ({
  id,
  timestamp: `${Math.floor(startSeconds / 60)}:${String(startSeconds % 60).padStart(2, "0")}`,
  startSeconds,
  endSeconds,
  title,
  isCreatorChapter: true,
  content: [
    { blockId: `${id}-paragraph`, type: "paragraph", text: summaryText },
    { blockId: `${id}-bullets`, type: "bullets", items: bulletItems },
  ],
});

export const mockVideoSummary = {
  tldr: "This is a summary of the video content.",
  keyTakeaways: ["Key point 1", "Key point 2", "Key point 3"],
  masterSummary:
    "This is the complete master summary of the video. It provides a comprehensive overview of all the key points discussed, including the introduction, main content, and conclusion. The video covers important concepts and provides actionable takeaways for the viewer.",
  chapters: [
    createMockChapter(
      "chapter-1",
      "Introduction",
      0,
      30,
      "The video starts with an introduction.",
      ["Opening remarks", "Setting the scene"]
    ),
    createMockChapter(
      "chapter-2",
      "Main Content",
      30,
      90,
      "The main content of the video.",
      ["First point", "Second point"]
    ),
    createMockChapter(
      "chapter-3",
      "Conclusion",
      90,
      180,
      "The video concludes with final thoughts.",
      ["Summary", "Call to action"]
    ),
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

// Summary without masterSummary for testing null case
export const mockVideoSummaryNoMaster = {
  ...mockVideoSummary,
  masterSummary: null,
};

// Setup API mocks
async function setupApiMocks(page: Page) {
  // Use regex pattern to reliably match the auth/me endpoint
  await page.route(/\/api\/auth\/me$/, (route) => {
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
        // Use different summaries based on video ID
        // video-1: full summary with masterSummary
        // video-2: summary without masterSummary (for testing Quick Read hidden)
        // video-3: no summary (processing)
        const summary =
          video.status === "completed"
            ? videoId === "video-2"
              ? mockVideoSummaryNoMaster
              : mockVideoSummary
            : null;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ video, summary }),
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

/**
 * Extended test fixture with authentication.
 * Sets up API mocks and injects auth state for all tests.
 *
 * SECURITY NOTE (Test Environment Only):
 * --------------------------------------
 * This fixture stores mock tokens in localStorage for e2e testing purposes.
 * In production, tokens are stored in httpOnly cookies and managed by the
 * auth service. The localStorage approach here is safe because:
 * 1. These are mock tokens that don't grant any real access
 * 2. The backend is completely mocked via route handlers
 * 3. No real API calls are made during tests
 *
 * DO NOT copy this pattern for production code. See docs/SECURITY.md for
 * the actual auth token storage implementation.
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Set up API mocks FIRST, before any navigation
    await setupApiMocks(page);

    // Mock auth refresh endpoint
    await page.route(/\/api\/auth\/refresh/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "mock-token-123" }),
      });
    });

    // Inject auth state and mock WebSocket BEFORE any page script runs
    // SECURITY: Mock tokens for testing only - see note above
    await page.addInitScript(() => {
      // Zustand persist format for auth store (only accessToken and user are hydrated)
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
      localStorage.setItem("accessToken", "mock-token-123");

      // Mock WebSocket to prevent real connection attempts
      // The real backend would reject our mock token and trigger forceLogout()
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
          // Simulate successful connection after a tick
          setTimeout(() => {
            if (this.onopen) {
              this.onopen(new Event("open"));
            }
          }, 10);
        }

        send(_data: string) {
          // No-op for tests
        }

        close() {
          this.readyState = MockWebSocket.CLOSED;
        }
      }

      // Replace WebSocket globally
      (window as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
    });

    // Navigate directly to home page
    // The app will hydrate auth from localStorage, then checkAuth() validates via mocked /api/auth/me
    await page.goto("/");

    // Wait for auth check to complete and dashboard to render
    // The sidebar (complementary) or main content should appear once authenticated
    await page.waitForSelector('[role="complementary"], main', { timeout: AUTH_TIMEOUT });

    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture API, not React hook
    await use(page);
  },
});

export { expect } from "@playwright/test";
