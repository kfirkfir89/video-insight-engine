import { test, expect } from './fixtures';

test.describe('Health Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.click('nav a:has-text("Health")');
    await adminPage.waitForURL('**/health');
  });

  test('service health cards show all services', async ({ adminPage }) => {
    const health = adminPage.locator('[data-testid="service-health"]');
    await expect(health).toBeVisible();

    await expect(health.getByText('api')).toBeVisible();
    await expect(health.getByText('summarizer')).toBeVisible();
    await expect(health.getByText('explainer')).toBeVisible();
    await expect(health.getByText('mongodb')).toBeVisible();
  });

  test('status indicator dots have correct colors', async ({ adminPage }) => {
    const health = adminPage.locator('[data-testid="service-health"]');
    const dots = health.locator('.rounded-full');
    const count = await dots.count();
    expect(count).toBe(4);
  });

  test('response times are shown', async ({ adminPage }) => {
    const health = adminPage.locator('[data-testid="service-health"]');
    await expect(health.getByText('45ms', { exact: false })).toBeVisible();
    await expect(health.getByText('120ms', { exact: false })).toBeVisible();
    await expect(health.getByText('3200ms', { exact: false })).toBeVisible();
  });

  test('7-Day Uptime section renders', async ({ adminPage }) => {
    await expect(adminPage.getByText('7-Day Uptime')).toBeVisible();
  });

  test('uptime percentages display with service labels', async ({ adminPage }) => {
    await expect(adminPage.getByText('99.85%')).toBeVisible();
    await expect(adminPage.getByText('98.21%')).toBeVisible();
    await expect(adminPage.getByText('95.5%')).toBeVisible();
    await expect(adminPage.getByText('100%')).toBeVisible();

    // Service labels under percentages
    const uptimeSection = adminPage.locator('text=7-Day Uptime').locator('..');
    await expect(uptimeSection.getByText('api')).toBeVisible();
    await expect(uptimeSection.getByText('summarizer')).toBeVisible();
    await expect(uptimeSection.getByText('explainer')).toBeVisible();
    await expect(uptimeSection.getByText('mongodb')).toBeVisible();
  });

  test('uptime color coding is correct', async ({ adminPage }) => {
    // Wait for the uptime section to render
    await expect(adminPage.getByText('7-Day Uptime')).toBeVisible();

    // Find percentage elements by their content pattern (N%)
    const el9985 = adminPage.getByText('99.85%');
    const el9821 = adminPage.getByText('98.21%');
    const el955 = adminPage.getByText('95.5%');
    const el100 = adminPage.getByText('100%');

    // >=99 uses success color
    await expect(el9985).toBeVisible();
    const color9985 = await el9985.evaluate((e) => e.style.color);
    expect(color9985).toContain('var(--color-success)');

    await expect(el100).toBeVisible();
    const color100 = await el100.evaluate((e) => e.style.color);
    expect(color100).toContain('var(--color-success)');

    // >=95 but <99 uses warning color
    await expect(el9821).toBeVisible();
    const color9821 = await el9821.evaluate((e) => e.style.color);
    expect(color9821).toContain('var(--color-warning)');

    await expect(el955).toBeVisible();
    const color955 = await el955.evaluate((e) => e.style.color);
    expect(color955).toContain('var(--color-warning)');
  });
});
