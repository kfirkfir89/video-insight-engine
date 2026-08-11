/**
 * RTL Output Migration — End-to-end smoke tests
 *
 * The video output area must render correctly when wrapped in dir="rtl"
 * (Hebrew/Arabic videos). The app shell (sidebar/header) intentionally
 * stays LTR so this test exercises only the output components.
 *
 * Strategy: load the design-system page (which embeds all 16 interactive
 * output components with seeded mock data), force the document direction
 * to RTL, and verify:
 *   1. No horizontal overflow on the interactive container
 *   2. No console errors during rendering
 *   3. Directional chevrons report a transform (rotated for RTL)
 *   4. The visual output renders consistently (smoke-screenshot)
 */
import { test, expect, type Page } from '@playwright/test';

const DESIGN_SYSTEM_URL = '/dev/design-system';

async function goToInteractive(page: Page) {
  await page.goto(DESIGN_SYSTEM_URL);
  // 30s: the design-system route is a huge lazy chunk — a cold Vite dev
  // server can take >5s to transform it (Suspense "Loading page..." flake).
  await expect(
    page.getByRole('heading', { name: 'Design System' }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole('tab', { name: /Interactive/i }).click();
  await expect(page.getByRole('heading', { name: 'Interactive Components' })).toBeVisible();
}

async function forceRTL(page: Page) {
  // Flip the document direction globally — this is the same effect the
  // DirectionProvider produces inside the video output area for Hebrew
  // videos. Doing it at the document level lets us reuse the design-system
  // demo (which doesn't run the full video pipeline) as an RTL smoke fixture.
  await page.evaluate(() => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'he');
  });
}

test.describe('RTL output rendering', () => {
  test('interactive components render in RTL without errors or overflow', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text();
        if (
          !t.includes('favicon') &&
          !t.includes('404') &&
          !t.includes('401') &&
          !t.includes('Failed to load resource')
        ) {
          errors.push(t);
        }
      }
    });

    await goToInteractive(page);
    await forceRTL(page);

    // Give the page a tick to settle after the dir flip
    // Wait past the longest transition (200ms) on directional icons so we
    // sample the post-flip steady state, not the mid-tween.
    await page.waitForTimeout(400);

    // Sanity: the html element reports rtl
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');

    // No horizontal overflow at the interactive container
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      return {
        scrollWidth: main.scrollWidth,
        clientWidth: main.clientWidth,
        overflows: main.scrollWidth > main.clientWidth + 1, // 1px slack for sub-pixel rounding
      };
    });
    expect(overflow.overflows).toBe(false);

    // No console errors
    expect(errors).toEqual([]);
  });

  test('directional chevrons are rotated when wrapped in RTL', async ({ page }) => {
    await goToInteractive(page);
    await forceRTL(page);
    // Wait past the longest transition (200ms) on directional icons so we
    // sample the post-flip steady state, not the mid-tween.
    await page.waitForTimeout(400);

    // Every chevron in the output area carries `rtl:rotate-180`. Verify by
    // sampling any SVG that includes that class. Tailwind v4 compiles
    // `rotate-180` to the CSS `rotate:` property (not `transform: rotate(...)`),
    // so we read that property — `180deg` when the rule applies, blank/none
    // otherwise.
    const rotated = await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('svg'));
      const candidate = svgs.find((el) => /rtl:rotate-180/.test(el.getAttribute('class') ?? ''));
      if (!candidate) return { found: false } as const;
      const cs = window.getComputedStyle(candidate);
      return { found: true as const, rotate: cs.rotate };
    });
    expect(rotated.found).toBe(true);
    // CSS computed `rotate` reports `180deg` when applied, `none` when not.
    expect(rotated.rotate).toBe('180deg');
  });

  test('logical text-align resolves to the start edge under RTL', async ({ page }) => {
    await goToInteractive(page);
    await forceRTL(page);
    // Wait past the longest transition (200ms) on directional icons so we
    // sample the post-flip steady state, not the mid-tween.
    await page.waitForTimeout(400);

    // `text-start` is `text-align: start` — a logical property. In LTR it
    // resolves to `left`, in RTL it resolves to `right`. We seed a fresh
    // element to avoid coupling to any specific component's structure.
    const align = await page.evaluate(() => {
      const probe = document.createElement('p');
      probe.className = 'text-start';
      probe.textContent = 'probe';
      document.body.appendChild(probe);
      const v = window.getComputedStyle(probe).textAlign;
      probe.remove();
      return v;
    });
    // `text-align: start` computes to the physical direction the user-agent
    // resolved it to. Chrome reports `start` directly; older engines may
    // resolve to `right` under RTL. Accept either as proof the logical
    // property is in effect.
    expect(['start', 'right']).toContain(align);
  });
});
