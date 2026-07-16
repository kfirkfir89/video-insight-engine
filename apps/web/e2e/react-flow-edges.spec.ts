/**
 * React Flow edge-render smoke — the RF error #008 regression class.
 *
 * ConceptCanvas uses floating edges with hidden handles. When the hidden
 * handles are missing (or handle ids drift), React Flow logs error #008
 * ("couldn't create edge...") and silently renders ZERO edges — jsdom unit
 * tests cannot catch this because edge paths are only materialized in a real
 * layout engine. This spec loads the design-system Interactive tab (which
 * embeds ConceptCanvas + StepFlowCanvas with seeded mock data, including
 * concept connections) and asserts actual `.react-flow__edge-path` elements
 * exist in the DOM.
 *
 * Runs in the default local `chromium` project; CI's smoke workflow does not
 * include it (runs `--project=smoke` only).
 */
import { test, expect, type Page } from "@playwright/test";

const DESIGN_SYSTEM_URL = "/dev/design-system";

async function goToInteractive(page: Page) {
  await page.goto(DESIGN_SYSTEM_URL);
  // 30s: the design-system route is a huge lazy chunk — a cold Vite dev
  // server can take >5s to transform it (Suspense "Loading page..." flake).
  await expect(
    page.getByRole("heading", { name: "Design System" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("tab", { name: /Interactive/i }).click();
  await expect(
    page.getByRole("heading", { name: "Interactive Components" }),
  ).toBeVisible();
}

test.describe("React Flow edge rendering", () => {
  test("ConceptCanvas renders nodes AND edge paths (floating edges, RF #008 class)", async ({
    page,
  }) => {
    const rfErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      // RF #008 logs "Couldn't create edge for source/target handle id ..."
      // with a link to .../error#008 — either fragment identifies it.
      if (/error#0*8\b|couldn.t create edge/i.test(text)) {
        rfErrors.push(text);
      }
    });

    await goToInteractive(page);

    const canvas = page.getByTestId("showcase-concept-canvas");
    await canvas.scrollIntoViewIfNeeded();

    // Nodes render even when edges silently fail — assert them first so a
    // failure below is unambiguously about EDGES, not the canvas itself.
    const nodes = canvas.locator(".react-flow__node");
    await expect(nodes.first()).toBeVisible({ timeout: 15000 });

    // The regression assertion: real SVG edge paths must exist. When RF #008
    // fires, this count is 0 while everything else looks healthy.
    const edgePaths = canvas.locator(".react-flow__edge-path");
    await expect(edgePaths.first()).toBeAttached({ timeout: 15000 });
    expect(await edgePaths.count()).toBeGreaterThan(0);

    expect(rfErrors, `React Flow edge errors: ${rfErrors.join("\n")}`).toEqual(
      [],
    );
  });

  test("StepFlowCanvas renders its linear step edges", async ({ page }) => {
    await goToInteractive(page);

    const canvas = page.getByTestId("showcase-step-flow-canvas");
    await canvas.scrollIntoViewIfNeeded();

    await expect(
      canvas.locator(".react-flow__node").first(),
    ).toBeVisible({ timeout: 15000 });

    const edgePaths = canvas.locator(".react-flow__edge-path");
    await expect(edgePaths.first()).toBeAttached({ timeout: 15000 });
    // 6 linear steps → at least 5 connecting edges.
    expect(await edgePaths.count()).toBeGreaterThanOrEqual(5);
  });
});
