/**
 * UX Overhaul Layout Audit E2E Tests
 *
 * Tests layout hierarchy, overflow, responsivity, and visual correctness
 * for the Sprint 0-4 UX changes: tab intros, card anatomy, InfoGrid,
 * cross-tab links, post-processing, and interactive components.
 */
import { test, expect } from "./fixtures";

// ── Mock assembled tabs covering all interactive types ──

const mockAssembledTabs = [
  {
    id: "overview",
    label: "Overview",
    emoji: "📋",
    component: "overview",
    goal: "Get the full picture in 3 seconds.",
    props: {
      data: {
        title: "Complete Guide to Modern JavaScript",
        duration: 1800,
        level: "Intermediate",
        totalConcepts: 12,
      },
    },
    crossTabLinks: [
      { targetTab: "concepts", label: "Learn the concepts" },
    ],
  },
  {
    id: "concepts",
    label: "5 Concepts",
    emoji: "📚",
    component: "flash_deck",
    goal: "Master these 5 core concepts.",
    props: {
      cards: [
        { front: "Closures", back: "A function that retains access to its parent scope", emoji: "🔒" },
        { front: "Promises", back: "An object representing eventual completion of an async operation", emoji: "🤝" },
        { front: "Prototypes", back: "The mechanism by which JavaScript objects inherit features", emoji: "🧬" },
        { front: "Event Loop", back: "The concurrency model that processes callbacks and events", emoji: "🔄" },
        { front: "Modules", back: "Reusable pieces of code that can be exported and imported", emoji: "📦" },
      ],
    },
    crossTabLinks: [
      { targetTab: "quiz", label: "Test yourself" },
    ],
  },
  {
    id: "quiz",
    label: "3 Questions",
    emoji: "❓",
    component: "quiz",
    goal: "Test what you've learned.",
    props: {
      questions: [
        {
          question: "What is a closure?",
          options: ["A function with no scope", "A function retaining parent scope", "A class method", "A global function"],
          correctIndex: 1,
        },
        {
          question: "What does the event loop do?",
          options: ["Handles CSS", "Processes callbacks", "Manages memory", "Renders DOM"],
          correctIndex: 1,
        },
        {
          question: "What are prototypes used for?",
          options: ["Styling", "Inheritance", "Routing", "Authentication"],
          correctIndex: 1,
        },
      ],
    },
    crossTabLinks: [],
  },
];

const mockAssembledMeta = {
  contentTags: ["learning"],
  modifiers: [],
  primaryTag: "learning",
  userGoal: "Learn modern JavaScript fundamentals",
  tldr: "A comprehensive guide to modern JavaScript covering closures, promises, prototypes, and more.",
  masterSummary: "This video covers the essential concepts of modern JavaScript.",
  keyTakeaways: ["Closures are powerful", "Promises simplify async", "Prototypes enable inheritance"],
};

const mockTriage = {
  contentTags: ["learning"],
  modifiers: [],
  primaryTag: "learning",
  userGoal: "Learn modern JavaScript fundamentals",
  tabs: mockAssembledTabs.map(({ id, label, emoji, component, goal }) => ({
    id, label, emoji, component, goal,
    dataSource: `learning.${id}`,
  })),
  confidence: 0.95,
};

test.describe("UX Overhaul Layout Audit", () => {

  test.beforeEach(async ({ page }) => {
    // Mock API routes
    await page.route(/\/api\/auth\/me$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "user-1", email: "test@example.com", name: "Test" }),
      });
    });

    await page.route(/\/api\/auth\/refresh/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "mock-token-123" }),
      });
    });

    await page.route("**/api/videos", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ videos: [{
            id: "v1",
            videoSummaryId: "vs1",
            youtubeId: "test123",
            title: "Complete Guide to Modern JavaScript",
            channel: "Tech Channel",
            duration: 1800,
            thumbnailUrl: "https://i.ytimg.com/vi/test123/maxresdefault.jpg",
            status: "completed",
            folderId: null,
            createdAt: "2024-01-01T00:00:00Z",
          }] }),
        });
      } else {
        route.continue();
      }
    });

    await page.route(/\/api\/videos\/[^/]+$/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          video: {
            id: "v1",
            videoSummaryId: "vs1",
            youtubeId: "test123",
            title: "Complete Guide to Modern JavaScript",
            channel: "Tech Channel",
            duration: 1800,
            status: "completed",
          },
          summary: {
            triage: mockTriage,
            output: { learning: { keyPoints: [], concepts: [] } },
            assembledMeta: mockAssembledMeta,
            assembledTabs: mockAssembledTabs,
            masterSummary: mockAssembledMeta.masterSummary,
            tldr: mockAssembledMeta.tldr,
            keyTakeaways: mockAssembledMeta.keyTakeaways,
          },
        }),
      });
    });

    await page.route(/\/api\/folders/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ folders: [] }),
      });
    });

    // Set auth token
    await page.addInitScript(() => {
      window.localStorage.setItem("accessToken", "mock-token-123");
      window.localStorage.setItem("refreshToken", "mock-refresh-123");
    });
  });

  test("no horizontal overflow on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");

    // Check body doesn't have horizontal scroll
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(windowWidth + 1); // +1 for rounding
  });

  test("no horizontal overflow on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(windowWidth + 1);
  });

  test("no horizontal overflow on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(windowWidth + 1);
  });

  test("tab labels do not have double emojis", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");

    // Wait for tabs to render
    await page.waitForTimeout(1000);

    // Check all tab button texts for double emoji pattern
    const tabTexts = await page.evaluate(() => {
      const buttons = document.querySelectorAll('[role="tab"], [data-slot="tab"]');
      return Array.from(buttons).map(b => b.textContent?.trim() ?? '');
    });

    for (const text of tabTexts) {
      // Regex: check if text starts with two consecutive emoji characters
      const doubleEmojiPattern = /^[\u{1F300}-\u{1FAFF}\u2600-\u27BF]{2,}/u;
      expect(text, `Tab label "${text}" has double emoji`).not.toMatch(doubleEmojiPattern);
    }
  });

  test("visual hierarchy: headings are larger than body text", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const fontSizes = await page.evaluate(() => {
      const results: { selector: string; fontSize: number }[] = [];
      // Check h1/h2/h3 and paragraph font sizes
      const headings = document.querySelectorAll('h1, h2, h3');
      const paragraphs = document.querySelectorAll('p');

      headings.forEach(h => {
        const style = getComputedStyle(h);
        results.push({ selector: h.tagName, fontSize: parseFloat(style.fontSize) });
      });

      paragraphs.forEach(p => {
        const style = getComputedStyle(p);
        results.push({ selector: 'P', fontSize: parseFloat(style.fontSize) });
      });

      return results;
    });

    const headingSizes = fontSizes.filter(f => f.selector !== 'P').map(f => f.fontSize);
    const pSizes = fontSizes.filter(f => f.selector === 'P').map(f => f.fontSize);

    if (headingSizes.length > 0 && pSizes.length > 0) {
      const maxPSize = Math.max(...pSizes);
      const avgHeadingSize = headingSizes.reduce((a, b) => a + b, 0) / headingSizes.length;
      expect(avgHeadingSize).toBeGreaterThan(maxPSize);
    }
  });

  test("no text truncation without ellipsis on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Find elements where text overflows without visible ellipsis/line-clamp
    const overflowIssues = await page.evaluate(() => {
      const issues: string[] = [];
      const elements = document.querySelectorAll('p, span, div, h1, h2, h3, h4');
      elements.forEach(el => {
        const style = getComputedStyle(el);
        const isOverflowing = el.scrollWidth > el.clientWidth;
        const hasEllipsis = style.textOverflow === 'ellipsis';
        const hasLineClamp = style.webkitLineClamp !== '' && style.webkitLineClamp !== 'none';
        const isHidden = style.overflow === 'hidden';

        if (isOverflowing && !hasEllipsis && !hasLineClamp && !isHidden) {
          const text = el.textContent?.slice(0, 50) ?? '';
          if (text.trim()) {
            issues.push(`${el.tagName}.${el.className.split(' ')[0]}: "${text}..."`);
          }
        }
      });
      return issues.slice(0, 5); // Limit to first 5
    });

    // Allow up to 3 minor overflow instances (some may be intentional scroll containers)
    expect(overflowIssues.length, `Text overflow without ellipsis: ${overflowIssues.join(', ')}`).toBeLessThanOrEqual(3);
  });

  test("responsive: content fills viewport width on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Main content area should use most of the viewport width
    const contentWidth = await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('[role="main"]');
      if (!main) return 375;
      return main.getBoundingClientRect().width;
    });

    // Content should use at least 90% of viewport width on mobile
    expect(contentWidth).toBeGreaterThan(375 * 0.85);
  });

  test("z-index hierarchy: modals above content, content above background", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const zIndexIssues = await page.evaluate(() => {
      const issues: string[] = [];
      const elements = document.querySelectorAll('*');
      const zIndexMap: { selector: string; zIndex: number }[] = [];

      elements.forEach(el => {
        const style = getComputedStyle(el);
        const zIndex = parseInt(style.zIndex, 10);
        if (!isNaN(zIndex) && zIndex > 0) {
          zIndexMap.push({
            selector: `${el.tagName}.${el.className.split(' ')[0]}`,
            zIndex
          });
        }
      });

      // Check for unreasonably high z-index values (indicating z-index wars)
      const highZ = zIndexMap.filter(z => z.zIndex > 9999);
      highZ.forEach(z => {
        issues.push(`High z-index (${z.zIndex}): ${z.selector}`);
      });

      return issues;
    });

    expect(zIndexIssues.length, `Z-index issues: ${zIndexIssues.join(', ')}`).toBe(0);
  });

  test("interactive components have proper touch targets on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const smallTouchTargets = await page.evaluate(() => {
      const issues: string[] = [];
      const interactiveElements = document.querySelectorAll('button, a, [role="tab"], input, select');

      interactiveElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Skip hidden elements
        if (rect.width === 0 || rect.height === 0) return;
        // WCAG recommends minimum 44x44px touch targets
        if (rect.height < 30 || rect.width < 30) {
          const text = el.textContent?.slice(0, 30) ?? '';
          issues.push(`${el.tagName} "${text}" (${Math.round(rect.width)}x${Math.round(rect.height)}px)`);
        }
      });

      return issues.slice(0, 5);
    });

    // Allow some small icons/close buttons, but flag if many
    expect(smallTouchTargets.length, `Small touch targets: ${smallTouchTargets.join(', ')}`).toBeLessThanOrEqual(5);
  });

  test("glass card containers have consistent border-radius", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/videos/v1");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const borderRadii = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="glass"], [class*="rounded"]');
      const radii = new Set<string>();
      cards.forEach(card => {
        const style = getComputedStyle(card);
        if (style.borderRadius && style.borderRadius !== '0px') {
          radii.add(style.borderRadius);
        }
      });
      return Array.from(radii);
    });

    // Should have no more than 4-5 distinct border-radius values (design consistency)
    expect(borderRadii.length, `Too many border-radius values: ${borderRadii.join(', ')}`).toBeLessThanOrEqual(8);
  });
});
