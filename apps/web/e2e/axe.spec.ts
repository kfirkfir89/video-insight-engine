/**
 * Automated accessibility scans — @axe-core/playwright, WCAG 2.0/2.1 A + AA.
 *
 * Scans four key pages: landing, login, register, and the design-system
 * showcase (which embeds the shared UI primitives, so violations there
 * usually mean a violation everywhere). Authenticated pages (/board,
 * /video/:id) are exercised by the smoke project against the real backend;
 * this spec stays in the mock-free public surface so it runs in the default
 * local project with zero setup.
 *
 * Target: ZERO violations on scanned pages. Any deliberate exception must be
 * excluded via `disableRules`/`exclude` WITH a comment explaining why.
 *
 * Runs in the default local `chromium` project; CI's smoke workflow does not
 * include it (runs `--project=smoke` only).
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}

/** Compact, actionable failure message: rule → impacted selectors. */
function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
): string {
  return violations
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n` +
        v.nodes.map((n) => `  → ${n.target.join(" ")}`).join("\n"),
    )
    .join("\n\n");
}

test.describe("Accessibility (axe-core, WCAG A/AA)", () => {
  test("landing page has no violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 30000 });
    const { violations } = await scan(page);
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  test("login page has no violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 30000 });
    const { violations } = await scan(page);
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  test("register page has no violations", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 30000 });
    const { violations } = await scan(page);
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  test("design-system showcase has no violations", async ({ page }) => {
    await page.goto("/dev/design-system");
    // 30s: the design-system route is a huge lazy chunk — a cold Vite dev
    // server can take >5s to transform it (Suspense "Loading page..." flake).
    await expect(
      page.getByRole("heading", { name: "Design System" }),
    ).toBeVisible({ timeout: 30000 });
    const { violations } = await scan(page);
    expect(violations, formatViolations(violations)).toEqual([]);
  });
});
