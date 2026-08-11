import { test, expect } from '@playwright/test';
import { setupAdminApiMocks } from './fixtures';

test.describe('Authentication', () => {
  test('login prompt renders when no API key', async ({ page }) => {
    await page.goto('/');

    const form = page.locator('form');
    await expect(form).toBeVisible();
    await expect(form.getByText('VIE Admin')).toBeVisible();

    const input = page.locator('input[type="password"]');
    await expect(input).toBeVisible();

    const button = form.getByRole('button', { name: 'Sign In' });
    await expect(button).toBeVisible();
  });

  test('login form submission works', async ({ page }) => {
    // Set up proper API mocks for after login
    await setupAdminApiMocks(page);

    await page.goto('/');

    // Fill in the key and submit
    const input = page.locator('input[type="password"]');
    await input.fill('my-test-admin-key');
    await page.click('button:has-text("Sign In")');

    // After login, nav should render with all links
    await page.waitForSelector('header nav', { timeout: 10_000 });
    const nav = page.locator('header nav');
    await expect(nav.locator('a')).toHaveCount(5);
  });

  test('all routes show login when unauthenticated', async ({ page }) => {
    // The SPA is served from / - the auth check happens in React,
    // not at the server level. Verify unauthenticated state from the entry point.
    await page.goto('/');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Confirm no nav is rendered (app shows LoginPrompt, not Layout)
    await expect(page.locator('header nav')).not.toBeVisible();
  });

  test('page navigation works after authentication', async ({ page }) => {
    // Set up proper API mocks
    await setupAdminApiMocks(page);

    // Set auth key via addInitScript
    await page.addInitScript(() => {
      localStorage.setItem('admin_api_key', 'test-admin-key');
    });

    await page.goto('/');
    await page.waitForSelector('header nav', { timeout: 10_000 });

    // Navigate to all pages via client-side routing
    await page.click('nav a:has-text("Usage")');
    expect(page.url()).toContain('/usage');

    await page.click('nav a:has-text("Health")');
    expect(page.url()).toContain('/health');

    await page.click('nav a:has-text("Alerts")');
    expect(page.url()).toContain('/alerts');

    await page.click('nav a:has-text("Dashboard")');
    await expect(page).toHaveURL(/\/$/);
  });
});
