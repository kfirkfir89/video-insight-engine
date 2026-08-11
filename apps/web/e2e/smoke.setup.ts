/**
 * Smoke-suite setup project — runs exactly once per Playwright run, before
 * the `smoke` project (see playwright.config.ts `dependencies`).
 *
 * Seeds the real backend (e2e user + completed fixture video straight into
 * MongoDB, zero LLM spend) and writes the resulting token/user to the
 * gitignored handoff file that smoke.spec.ts workers read in beforeAll.
 * Centralizing the login here keeps us inside the api's IP-keyed
 * /auth/login rate limit (10/15min) across repeated local runs.
 */
import { test as setup } from "@playwright/test";
import { seedSmokeData, writeSeedFile } from "./helpers/smoke-seed";

setup("seed smoke user + fixture video", async () => {
  const seed = await seedSmokeData();
  writeSeedFile(seed);
});
