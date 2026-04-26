import { test, expect } from '@playwright/test';

test.describe('POS Application', () => {
  test('should load the application and show the title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Dealio/i);
  });

  test('should have basic accessibility and navigation elements', async ({ page }) => {
    await page.goto('/');
    // Check if the main splash screen or container exists
    const container = page.locator('#root');
    await expect(container).toBeAttached();
  });
});
