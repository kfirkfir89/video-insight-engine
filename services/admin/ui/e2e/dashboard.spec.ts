import { test, expect } from './fixtures';

test.describe('Dashboard Page', () => {
  test('stats cards render with correct values', async ({ adminPage }) => {
    const cards = adminPage.locator('[data-testid="stats-cards"]');
    await expect(cards).toBeVisible();

    // Total Cost
    await expect(cards.getByText('Total Cost')).toBeVisible();
    await expect(cards.getByText('$12.4567')).toBeVisible();

    // Total Calls
    await expect(cards.getByText('Total Calls')).toBeVisible();
    await expect(cards.getByText('1,247')).toBeVisible();

    // Avg Duration
    await expect(cards.getByText('Avg Duration')).toBeVisible();
    await expect(cards.getByText('2,340ms')).toBeVisible();

    // Success Rate
    await expect(cards.getByText('Success Rate')).toBeVisible();
    await expect(cards.getByText('96.2%')).toBeVisible();
  });

  test('alerts banner renders with alert data', async ({ adminPage }) => {
    const banner = adminPage.locator('[data-testid="alerts-banner"]');
    await expect(banner).toBeVisible();

    await expect(banner.getByText('high_cost')).toBeVisible();
    await expect(banner.getByText('$0.8923')).toBeVisible();
    await expect(banner.getByText('claude-sonnet-4-20250514')).toBeVisible();
  });

  test('service health grid renders all services', async ({ adminPage }) => {
    const health = adminPage.locator('[data-testid="service-health"]');
    await expect(health).toBeVisible();

    await expect(health.getByText('api')).toBeVisible();
    await expect(health.getByText('summarizer')).toBeVisible();
    await expect(health.getByText('explainer')).toBeVisible();
    await expect(health.getByText('mongodb')).toBeVisible();

    // Status text with response times
    await expect(health.getByText('healthy (45ms)')).toBeVisible();
    await expect(health.getByText('healthy (120ms)')).toBeVisible();
    await expect(health.getByText('degraded (3200ms)')).toBeVisible();
    await expect(health.getByText('healthy (8ms)')).toBeVisible();
  });

  test('cost chart renders', async ({ adminPage }) => {
    await expect(adminPage.getByText('Daily Cost Trend')).toBeVisible();
    // Recharts renders into SVG
    const chartContainer = adminPage.locator('.recharts-responsive-container');
    await expect(chartContainer.first()).toBeVisible();
  });

  test('feature breakdown renders', async ({ adminPage }) => {
    await expect(adminPage.getByText('Cost by Feature')).toBeVisible();
  });

  test('model breakdown renders', async ({ adminPage }) => {
    await expect(adminPage.getByText('Cost by Model')).toBeVisible();
  });

  test('recent videos strip renders with video data', async ({ adminPage }) => {
    const strip = adminPage.locator('[data-testid="recent-videos"]');
    await expect(strip).toBeVisible();

    // Video titles from mock data
    await expect(strip.getByText('Building a REST API with FastAPI')).toBeVisible();
    await expect(strip.getByText('Understanding React Server Components')).toBeVisible();

    // View all link
    await expect(adminPage.getByRole('link', { name: /View all/ })).toBeVisible();
  });

  test('stats cards show loading skeletons before data loads', async ({ page }) => {
    // No fixtures - set up auth but delay API responses
    await page.addInitScript(() => {
      localStorage.setItem('admin_api_key', 'test-admin-key');
    });

    // Route that never resolves (simulates loading)
    await page.route('**/usage/stats*', () => {
      // intentionally never fulfill - simulates perpetual loading
    });
    // Mock other routes to prevent real requests
    await page.route('**/alerts/recent*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/health/services*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/usage/daily*', () => {});
    await page.route('**/usage/by-feature*', () => {});
    await page.route('**/usage/by-model*', () => {});
    await page.route('**/usage/by-video*', () => {});

    await page.goto('/');
    await page.waitForSelector('header nav', { timeout: 10_000 });

    const pulseElements = page.locator('[data-testid="stats-cards"] .animate-pulse');
    await expect(pulseElements.first()).toBeVisible();
  });

  test('dashboard has charts in grid layout', async ({ adminPage }) => {
    // The dashboard has grid wrappers around charts
    const gridContainers = adminPage.locator('.grid.lg\\:grid-cols-2');
    await expect(gridContainers.first()).toBeVisible();

    // Chart headings should be present
    await expect(adminPage.getByText('Daily Cost Trend')).toBeVisible();
    await expect(adminPage.getByText('Cost by Model')).toBeVisible();
    await expect(adminPage.getByText('Cost by Feature')).toBeVisible();
  });

  test('section dividers render', async ({ adminPage }) => {
    await expect(adminPage.getByText('Analytics')).toBeVisible();
    await expect(adminPage.getByText('Community')).toBeVisible();
    await expect(adminPage.getByText('Services')).toBeVisible();
  });

  test('total tokens card renders in stats cards', async ({ adminPage }) => {
    const cards = adminPage.locator('[data-testid="stats-cards"]');
    await expect(cards.getByText('Total Tokens')).toBeVisible();
  });

  test('output type chart renders with data', async ({ adminPage }) => {
    const chart = adminPage.locator('[data-testid="output-type-chart"]');
    await expect(chart).toBeVisible();
    await expect(chart.getByText('Cost by Output Type')).toBeVisible();
  });

  test('shares table renders with data', async ({ adminPage }) => {
    const table = adminPage.locator('[data-testid="shares-table"]');
    await expect(table).toBeVisible();
    await expect(table.getByText('Top Shared Outputs')).toBeVisible();
    // Table headers
    await expect(table.getByText('Title')).toBeVisible();
    await expect(table.getByText('Type')).toBeVisible();
    await expect(table.getByText('Views')).toBeVisible();
    await expect(table.getByText('Likes')).toBeVisible();
    // Mock data content
    await expect(table.getByText('How to Make Sourdough Bread')).toBeVisible();
    await expect(table.getByText('React Hooks Deep Dive')).toBeVisible();
  });

  test('tier distribution chart renders', async ({ adminPage }) => {
    const chart = adminPage.locator('[data-testid="tier-distribution"]');
    await expect(chart).toBeVisible();
    await expect(chart.getByText('User Tiers')).toBeVisible();
  });
});
