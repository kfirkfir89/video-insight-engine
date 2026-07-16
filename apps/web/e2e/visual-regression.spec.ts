/**
 * Visual regression — design-system showcase per theme (light / dark / lagoon).
 *
 * Captures `toHaveScreenshot()` baselines of the /dev/design-system Colors &
 * Tokens section under each of the three themes. The theme is injected via
 * the same localStorage key ("vie-theme") the index.html pre-paint script and
 * ThemeProvider read, so the page loads directly in the target theme with no
 * transition.
 *
 * Baseline PNGs live in visual-regression.spec.ts-snapshots/ and are
 * OS + browser specific (generated on linux + chromium). CI intentionally
 * does NOT run this spec: .github/workflows/e2e.yml runs `--project=smoke`
 * only, and this file matches the default local `chromium` project instead.
 * Regenerating after an intentional design change:
 *   npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 */
import { test, expect, type Page } from "@playwright/test";

const DESIGN_SYSTEM_URL = "/dev/design-system";
const THEMES = ["light", "dark", "lagoon"] as const;

test.use({ viewport: { width: 1440, height: 900 } });

/** Load the design-system page with the given theme applied pre-paint. */
async function gotoWithTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((t) => {
    localStorage.setItem("vie-theme", t);
  }, theme);
  await page.goto(DESIGN_SYSTEM_URL);
  // 30s: the design-system route is a huge lazy chunk — a cold Vite dev
  // server can take >5s to transform it (Suspense "Loading page..." flake).
  await expect(
    page.getByRole("heading", { name: "Design System" }),
  ).toBeVisible({ timeout: 30000 });
  // Screenshot only after webfonts settle — fallback-font frames would
  // otherwise produce one-off diffs on cold runs.
  await page.evaluate(() => document.fonts.ready);
}

test.describe("Design-system visual baselines", () => {
  for (const theme of THEMES) {
    test(`colors & tokens section matches the ${theme} baseline`, async ({
      page,
    }) => {
      await gotoWithTheme(page, theme);

      await expect(page).toHaveScreenshot(`design-system-${theme}.png`, {
        animations: "disabled",
        // Tiny tolerance for GPU/AA nondeterminism between runs on the same
        // machine; real regressions (token/theme drift) move far more pixels.
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
