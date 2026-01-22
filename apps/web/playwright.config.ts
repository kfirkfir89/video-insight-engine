import { defineConfig, devices } from "@playwright/test";

// Configurable timeouts - CI environments may need longer timeouts
const authTimeout = parseInt(process.env.E2E_AUTH_TIMEOUT || "15000", 10);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  // Increase timeout in CI where cold starts are common
  timeout: process.env.CI ? 60000 : 30000,
  expect: {
    timeout: process.env.CI ? 10000 : 5000,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Expose timeout for fixtures to use
    actionTimeout: authTimeout,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
