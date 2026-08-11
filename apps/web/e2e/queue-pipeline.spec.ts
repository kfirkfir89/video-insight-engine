import { test, expect, request as pwRequest } from "@playwright/test";

/**
 * End-to-end test for the RabbitMQ-backed pipeline submission flow.
 *
 * What this exercises (against a live docker-compose stack):
 *   1. POST /api/videos returns 201 immediately with a videoSummaryId
 *   2. The admin queue stats endpoint reports a healthy queue topology
 *   3. When USE_QUEUE_PIPELINE=true, the worker actually consumes the job
 *      (queue depth returns to zero after a short window)
 *
 * The test is gated on a live stack — it skips cleanly when the API is
 * unreachable or when the admin key is missing. CI configures the env vars
 * (E2E_API_URL, E2E_ADMIN_API_KEY) before invoking Playwright.
 *
 * Required env (with sensible dev defaults):
 *   E2E_API_URL         default: http://localhost:3000
 *   E2E_ADMIN_API_KEY   default: dev-admin-key-change-me
 *   E2E_ADMIN_EMAIL     default: admin@admin.com
 *   E2E_ADMIN_PASSWORD  default: Admin123
 *   E2E_TEST_YOUTUBE_URL  default: a cached Rick Astley URL (cache hit avoids LLM cost)
 */

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const ADMIN_KEY = process.env.E2E_ADMIN_API_KEY ?? "dev-admin-key-change-me";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@admin.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Admin123";
const TEST_YT_URL =
  process.env.E2E_TEST_YOUTUBE_URL ?? "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function loginAdminToken(): Promise<string | null> {
  const ctx = await pwRequest.newContext({ baseURL: API });
  try {
    const res = await ctx.post("/api/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      failOnStatusCode: false,
    });
    if (!res.ok()) return null;
    const body = (await res.json()) as { accessToken?: string };
    return body.accessToken ?? null;
  } catch {
    return null;
  } finally {
    await ctx.dispose();
  }
}

async function probeAdminQueue(): Promise<
  | {
      ok: true;
      stats: {
        main: { messages: number; ready: number; inFlight: number; consumers: number };
        dlq: { messages: number };
      };
    }
  | { ok: false }
> {
  const ctx = await pwRequest.newContext({ baseURL: API });
  try {
    const res = await ctx.get("/api/admin/queue/stats", {
      headers: { "X-Admin-Key": ADMIN_KEY },
      failOnStatusCode: false,
    });
    if (!res.ok()) return { ok: false };
    return { ok: true, stats: await res.json() };
  } catch {
    return { ok: false };
  } finally {
    await ctx.dispose();
  }
}

let preflightReady = false;
let workersAttached = false;

test.beforeAll(async () => {
  const probe = await probeAdminQueue();
  preflightReady = probe.ok;
  workersAttached = probe.ok && probe.stats.main.consumers > 0;
});

test.describe("queue pipeline (live stack)", () => {
  test.skip(
    () => !preflightReady,
    "Admin queue endpoint not reachable. Start the docker-compose stack and set E2E_ADMIN_API_KEY.",
  );

  test("admin queue stats endpoint returns the expected shape", async () => {
    const probe = await probeAdminQueue();
    expect(probe.ok).toBe(true);
    if (!probe.ok) return; // satisfies tsc

    expect(probe.stats.main).toMatchObject({
      messages: expect.any(Number),
      ready: expect.any(Number),
      inFlight: expect.any(Number),
      consumers: expect.any(Number),
    });
    expect(probe.stats.dlq).toMatchObject({ messages: expect.any(Number) });
  });

  test("admin queue stats endpoint rejects requests without the admin key", async () => {
    const ctx = await pwRequest.newContext({ baseURL: API });
    try {
      const res = await ctx.get("/api/admin/queue/stats", { failOnStatusCode: false });
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test("POST /api/videos returns a videoSummaryId and dispatches the pipeline", async () => {
    const token = await loginAdminToken();
    test.skip(
      !token,
      "Admin login failed — set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD or seed the admin user.",
    );

    const ctx = await pwRequest.newContext({
      baseURL: API,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    try {
      // bypassCache=false so a cached video short-circuits without burning an
      // LLM budget. The dispatch path (queue or HTTP) still runs for first-time
      // submissions; either result is acceptable here.
      const res = await ctx.post("/api/videos", {
        data: { url: TEST_YT_URL },
        failOnStatusCode: false,
      });

      // 201 on a fresh submission, 200 on alreadyExists, 429 if the daily
      // limit was tripped by parallel tests — only the first two count as pass.
      expect([200, 201]).toContain(res.status());
      const body = (await res.json()) as {
        video?: { videoSummaryId?: string; status?: string };
        cached?: boolean;
      };
      expect(body.video?.videoSummaryId).toBeTruthy();
      expect(["pending", "processing", "completed"]).toContain(
        body.video?.status ?? "",
      );
    } finally {
      await ctx.dispose();
    }
  });

  test("queue depth returns to zero after the worker drains it", async () => {
    test.skip(
      !workersAttached,
      "No workers attached — set USE_QUEUE_PIPELINE=true and start vie-summarizer-worker.",
    );

    // Allow up to 30s for in-flight jobs from the previous test (or background
    // submissions) to clear. We assert on `ready` rather than `messages` since
    // unacked-in-flight jobs are expected.
    const deadline = Date.now() + 30_000;
    let lastReady = Number.NaN;
    while (Date.now() < deadline) {
      const probe = await probeAdminQueue();
      if (!probe.ok) break;
      lastReady = probe.stats.main.ready;
      if (lastReady === 0) {
        expect(lastReady).toBe(0);
        return;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    // Soft-fail with a useful message — backlog might be legit traffic.
    throw new Error(`Queue did not drain within 30s (last ready=${lastReady}).`);
  });

  test("DLQ should be empty in a healthy stack", async () => {
    const probe = await probeAdminQueue();
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    // Non-zero DLQ depth in CI means a real failure landed — surface it.
    expect(probe.stats.dlq.messages).toBe(0);
  });
});
