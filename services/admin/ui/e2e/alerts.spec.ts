import { test, expect, setupAdminApiMocks } from './fixtures';

test.describe('Alerts Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.click('nav a:has-text("Alerts")');
    await adminPage.waitForURL('**/alerts');
  });

  test('alert thresholds config renders', async ({ adminPage }) => {
    await expect(adminPage.getByText('Alert Thresholds')).toBeVisible();
    await expect(adminPage.getByText('$0.5')).toBeVisible();
    await expect(adminPage.getByText('2x avg')).toBeVisible();
    await expect(adminPage.getByText('20%')).toBeVisible();
  });

  test('recent alerts table has correct columns', async ({ adminPage }) => {
    await expect(adminPage.getByText('Recent Alerts')).toBeVisible();
    // Wait for the table to render with data
    await expect(adminPage.locator('table')).toBeVisible();

    const headers = adminPage.locator('table thead th');
    const headerTexts = await headers.allTextContents();
    expect(headerTexts).toContain('Type');
    expect(headerTexts).toContain('Model');
    expect(headerTexts).toContain('Feature');
    expect(headerTexts).toContain('Cost');
    expect(headerTexts).toContain('Time');
  });

  test('alert data renders in table rows', async ({ adminPage }) => {
    const tbody = adminPage.locator('table tbody');

    // Alert types
    await expect(tbody.getByText('high_cost')).toBeVisible();
    await expect(tbody.getByText('spike')).toBeVisible();
    await expect(tbody.getByText('failure')).toBeVisible();

    // Model names
    await expect(tbody.getByText('claude-sonnet-4-20250514')).toBeVisible();
    await expect(tbody.getByText('gpt-4o')).toBeVisible();

    // Cost values
    await expect(tbody.getByText('$0.8923')).toBeVisible();
    await expect(tbody.getByText('$0.4512')).toBeVisible();
  });

  test('empty state shows when no alerts', async ({ page }) => {
    // Set up all API mocks first, then override alerts to return empty
    await setupAdminApiMocks(page);

    // Override alerts mock with empty response (registered after setupAdminApiMocks,
    // so it takes priority for matching requests)
    await page.route('**/alerts/recent*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('admin_api_key', 'test-admin-key');
    });

    // Navigate to / first (SPA entry point), then to alerts via client-side routing
    await page.goto('/');
    await page.waitForSelector('header nav', { timeout: 10_000 });
    await page.click('nav a:has-text("Alerts")');
    await page.waitForURL('**/alerts');

    await expect(page.getByText('No alerts')).toBeVisible();
  });

  test('table is in overflow container', async ({ adminPage }) => {
    // Wait for the alerts table to render with data
    await expect(adminPage.getByText('Recent Alerts')).toBeVisible();
    await expect(adminPage.locator('table')).toBeVisible();

    const tables = adminPage.locator('table');
    const count = await tables.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const parent = tables.nth(i).locator('..');
      const overflowX = await parent.evaluate((el) => getComputedStyle(el).overflowX);
      expect(['auto', 'scroll', 'hidden']).toContain(overflowX);
    }
  });
});
