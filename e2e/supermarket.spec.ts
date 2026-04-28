import { test, expect } from '@playwright/test';

test.describe('Supermarket POS Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to load
    await page.goto('/');

    // We assume the app is already configured for supermarket mode in this test environment
    // If not, we would need to mock the auth state
  });

  test('should allow searching and adding a product to cart', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search products/);
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill('Milk');

    // Wait for search results
    const productItem = page.getByText('Milk').first();
    await expect(productItem).toBeVisible();

    // Click to add to cart
    await productItem.click();

    // Check if added to cart
    await expect(page.getByText('1 Items')).toBeVisible();
  });

  test('should allow holding a sale', async ({ page }) => {
    // Add an item first
    const productItem = page.getByText('Milk').first();
    if (await productItem.isVisible()) {
        await productItem.click();
    } else {
        await page.getByPlaceholder(/Search products/).fill('Milk');
        await page.getByText('Milk').first().click();
    }

    // Click Hold Sale (F4)
    const holdButton = page.getByText('Hold Sale');
    await holdButton.click();

    // Verify notification or state change
    // Since toast might be hard to catch, check if cart is cleared
    await expect(page.getByText('0 Items')).toBeVisible();
  });
});
