import { defineConfig, devices } from "@playwright/test";

// Configurable timeouts - CI environments may need longer timeouts
const authTimeout = parseInt(process.env.E2E_AUTH_TIMEOUT || "15000", 10);

// The e2e suite must run against a Vite DEV server (dev-only routes like
// /dev/design-system are tree-shaken from production builds). When the
// docker-compose stack is up, the vie-web container serves a PRODUCTION
// nginx build on :5173 — with reuseExistingServer, Playwright would silently
// reuse that nginx build and fail every dev-route spec. Defaulting to 5273
// keeps the e2e vite dev server off the container's port entirely.
const port = parseInt(process.env.E2E_PORT || "5273", 10);
const baseURL = `http://localhost:${port}`;

// Specs verified permanently failing on 2026-07-08 (project-score-9 task 2.5):
// they mock pre-overhaul API contracts ({video, summary, output.triage} /
// article-section detail page) or assert selectors removed from src (e.g.
// data-testid="right-panel-tabs"). Quarantined out of the default run pending
// a delete-or-rewrite decision. Run them deliberately with:
//   E2E_LEGACY=1 npx playwright test --project=legacy-stale
const LEGACY_STALE_SPECS = [
  "all-domains.spec.ts",
  "conditional-tooltip.spec.ts",
  "cooking-mode.spec.ts",
  "domain-videos.spec.ts",
  "frontend-ux-plan.spec.ts",
  "hero-output-redesign.spec.ts",
  "music-video-support.spec.ts",
  "output-layout.spec.ts",
  "per-chapter-views.spec.ts",
  "perf-layout-audit.spec.ts",
  "right-panel-layout-audit.spec.ts",
  "right-panel-tabs.spec.ts",
  "sidebar-header-redesign.spec.ts",
  "v1.5-layout-audit.spec.ts",
  "video-detail-ux.spec.ts",
  "video-playback.spec.ts",
];

const legacyStaleMatch = new RegExp(
  `(${LEGACY_STALE_SPECS.map((s) => s.replace(/\./g, "\\.")).join("|")})$`,
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "html",
  // Increase timeout in CI where cold starts are common
  timeout: process.env.CI ? 60000 : 30000,
  expect: {
    timeout: process.env.CI ? 10000 : 5000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Expose timeout for fixtures to use
    actionTimeout: authTimeout,
  },
  projects: [
    // Smoke subset — real api + seeded MongoDB, zero LLM spend. The setup
    // project seeds ONCE per run (login is IP-rate-limited to 10/15min, and
    // per-worker beforeAll seeding would burn the window in two runs).
    {
      name: "smoke-setup",
      testMatch: /smoke\.setup\.ts/,
    },
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      dependencies: ["smoke-setup"],
      use: { ...devices["Desktop Chrome"] },
      // One worker, in-file order: parallel browsers against a cold Vite
      // dev server flake on transform storms, and serial keeps login calls
      // to one per run (IP-keyed rate limit on /auth/login).
      fullyParallel: false,
    },
    // Everything else: self-contained specs that mock the api via page.route.
    {
      name: "chromium",
      testIgnore: [/smoke\.(spec|setup)\.ts/, legacyStaleMatch],
      use: { ...devices["Desktop Chrome"] },
    },
    // Quarantined stale specs — opt-in only, never part of the default run.
    ...(process.env.E2E_LEGACY
      ? [
          {
            name: "legacy-stale",
            testMatch: legacyStaleMatch,
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
  ],
  webServer: {
    command: `pnpm dev --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
