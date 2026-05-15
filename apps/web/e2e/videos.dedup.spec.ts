import { test, expect } from "./fixtures";
import type { Page, Route } from "@playwright/test";

/**
 * Pipeline dedup verification (P1 / Phase 4).
 *
 * Asserts the contract documented in
 * `apps/web/src/features/video-output/lib/streaming/should-open-stream.ts`:
 *
 *   pending    → opens /stream (kicks off the pipeline)
 *   processing → opens /stream (attaches as additional consumer)
 *   completed  → does NOT open /stream (cached output is the source of truth)
 *   failed     → does NOT open /stream (user must hit Retry)
 *
 * The negative cases are the load-bearing ones — a regression here means
 * every revisit of a finished video re-attaches an SSE consumer for no
 * reason, hurting bandwidth and polluting backend logs with
 * `Attaching as additional consumer` noise.
 */

interface DedupVideo {
  id: string;
  videoSummaryId: string;
  status: "pending" | "processing" | "completed" | "failed";
  title: string;
}

const VIDEOS: Record<string, DedupVideo> = {
  completed: {
    id: "video-completed",
    videoSummaryId: "summary-completed",
    status: "completed",
    title: "Cached completed video",
  },
  failed: {
    id: "video-failed",
    videoSummaryId: "summary-failed",
    status: "failed",
    title: "Failed video",
  },
  processing: {
    id: "video-processing",
    videoSummaryId: "summary-processing",
    status: "processing",
    title: "In-flight video",
  },
  pending: {
    id: "video-pending",
    videoSummaryId: "summary-pending",
    status: "pending",
    title: "Just-queued video",
  },
};

function videoDetailBody(v: DedupVideo) {
  // Returns the VideoDetail shape that videosApi.get() resolves to. Status
  // is the field the dedup gate reads; everything else is enough to stop
  // the page from short-circuiting on missing fields.
  return {
    id: v.id,
    videoSummaryId: v.videoSummaryId,
    youtubeId: "dQw4w9WgXcQ",
    title: v.title,
    creator: "Test creator",
    duration: 120,
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    status: v.status,
    folderId: null,
    meta: v.status === "completed"
      ? {
          domain: "learning",
          contentTags: ["learning"],
          processingTimeMs: 1234,
        }
      : null,
    tabs: v.status === "completed"
      ? [
          {
            id: "key_points",
            label: "Key Points",
            emoji: "🎯",
            component: "info_grid",
            props: { items: [{ key: "Sample", value: "value" }] },
          },
        ]
      : null,
  };
}

async function setupDedupRoutes(page: Page): Promise<{
  hitsFor: (videoSummaryId: string) => string[];
}> {
  // Route handlers register most-recent-first in Playwright, so these win
  // over the broader fixture handlers in fixtures.ts. We also override the
  // videos list endpoint so the global processing manager (which scans the
  // list and may auto-attach to any in-flight stream) doesn't pollute the
  // counter with hits unrelated to the page under test.
  const streamHits: string[] = [];

  await page.route(/\/api\/videos(\?[^/]*)?$/, (route: Route) => {
    if (route.request().method() !== "GET") {
      route.continue();
      return;
    }
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ videos: [] }),
    });
  });

  await page.route(/\/api\/videos\/[^/]+$/, (route: Route) => {
    if (route.request().method() !== "GET") {
      route.continue();
      return;
    }
    const url = route.request().url();
    const id = url.split("/").pop()?.split("?")[0] ?? "";
    const match = Object.values(VIDEOS).find((v) => v.id === id);
    if (!match) {
      route.continue();
      return;
    }
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(videoDetailBody(match)),
    });
  });

  // Track every hit on the SSE stream endpoint without ever responding to
  // it with real events — we only care that the request was (or wasn't)
  // initiated. fulfill() with an empty stream so the fetch resolves and
  // doesn't hang waiting for a real backend.
  await page.route(/\/api\/videos\/[^/]+\/stream$/, (route: Route) => {
    streamHits.push(route.request().url());
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "",
    });
  });

  return {
    hitsFor: (videoSummaryId: string) =>
      streamHits.filter((u) => u.includes(`/videos/${videoSummaryId}/stream`)),
  };
}

test.describe("Pipeline dedup — frontend stream gate", () => {
  test("COMPLETED video does not open /stream", async ({ authenticatedPage: page }) => {
    const tracker = await setupDedupRoutes(page);
    await page.goto(`/video/${VIDEOS.completed.id}`);
    await page.waitForLoadState("networkidle");
    // Anchor the negative assertion to a positive render signal: the page
    // title comes from the cached `videos.get` response, which is the same
    // response that drives the dedup gate. If it's visible, the dedup
    // decision has already been committed.
    await expect(page.getByText(VIDEOS.completed.title)).toBeVisible();

    const hits = tracker.hitsFor(VIDEOS.completed.videoSummaryId);
    expect(hits, `Expected zero /stream hits for completed video, got: ${hits.join(", ")}`).toEqual([]);
  });

  test("FAILED video does not open /stream and shows retry UI", async ({ authenticatedPage: page }) => {
    const tracker = await setupDedupRoutes(page);
    await page.goto(`/video/${VIDEOS.failed.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();

    const hits = tracker.hitsFor(VIDEOS.failed.videoSummaryId);
    expect(hits, `Expected zero /stream hits for failed video, got: ${hits.join(", ")}`).toEqual([]);
  });

  test("PROCESSING video DOES open /stream", async ({ authenticatedPage: page }) => {
    const tracker = await setupDedupRoutes(page);
    await page.goto(`/video/${VIDEOS.processing.id}`);
    // Stream attach is async — poll our route counter directly.
    await expect.poll(() => tracker.hitsFor(VIDEOS.processing.videoSummaryId).length, {
      timeout: 5000,
      message: "Expected ≥1 /stream hit for the processing video",
    }).toBeGreaterThanOrEqual(1);
  });

  test("PENDING video DOES open /stream", async ({ authenticatedPage: page }) => {
    const tracker = await setupDedupRoutes(page);
    await page.goto(`/video/${VIDEOS.pending.id}`);
    await expect.poll(() => tracker.hitsFor(VIDEOS.pending.videoSummaryId).length, {
      timeout: 5000,
      message: "Expected ≥1 /stream hit for the pending video",
    }).toBeGreaterThanOrEqual(1);
  });

  test("revisiting a COMPLETED video after navigating away still opens zero streams", async ({
    authenticatedPage: page,
  }) => {
    const tracker = await setupDedupRoutes(page);

    await page.goto(`/video/${VIDEOS.completed.id}`);
    await expect(page.getByText(VIDEOS.completed.title)).toBeVisible();
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.goto(`/video/${VIDEOS.completed.id}`);
    // Same positive-signal anchor as the single-visit test — guarantees
    // both the first AND second mount have committed before we assert.
    await expect(page.getByText(VIDEOS.completed.title)).toBeVisible();

    const hits = tracker.hitsFor(VIDEOS.completed.videoSummaryId);
    expect(
      hits,
      `Expected zero /stream hits across two visits, got: ${hits.join(", ")}`,
    ).toEqual([]);
  });
});
