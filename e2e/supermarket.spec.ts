import { test, expect } from '@playwright/test';

test.describe('Supermarket POS Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up local storage for authentication and configuration
    // and mock Tauri APIs
    await page.addInitScript(() => {
      const now = Date.now();
      const authState = {
        state: {
          isConfigured: true,
          currentLocation: { id: 'test-loc', name: 'Test Store' },
          currentMember: {
            id: 'test-mem',
            name: 'Test User',
            organizationId: 'test-org',
            userId: 'test-user',
            isActive: true,
            isCheckedIn: true,
            image: '',
            role: 'admin'
          },
          isRestoredSession: true,
          sessionUpdatedAt: now,
          isInitialized: true,
          deviceType: 'MAIN_HUB'
        },
        version: 3
      };

      const posState = {
        state: {
          settings: {
            businessType: 'supermarket',
            enableBarcodeScanner: true,
            enableHoldSale: true,
            sidebarItems: []
          },
          products: [
            {
              productId: 'p1',
              productName: 'Milk',
              category: 'Dairy',
              variants: [{ variantId: 'v1', variantName: 'Whole Milk', barcode: '123' }],
              sellableUnits: [{ unitId: 'u1', unitName: '1L', price: 100, isBaseUnit: true }],
              stock: 50
            }
          ]
        },
        version: 1
      };

      localStorage.setItem('pos-auth-storage-v3', JSON.stringify(authState));
      localStorage.setItem('dealio-pos-storage-v1', JSON.stringify(posState));
      localStorage.setItem('DEVICE_ID', 'test-device');
      localStorage.setItem('DEVICE_ROLE', 'MAIN_HUB');

      // Mock Tauri
      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string) => {
            if (cmd === 'get_device_config') return { location_id: 'test-loc', allow_negative_stock: false };
            if (cmd === 'get_locations_command') return { locations: [{ id: 'test-loc', name: 'Test Store' }] };
            if (cmd === 'resolve_price_batch_command') return [100];
            if (cmd === 'get_tables_command') return [];
            return null;
          }
        },
        event: {
          listen: () => Promise.resolve(() => {}),
          emit: () => Promise.resolve()
        }
      };
    });

    // Navigate to the app
    await page.goto('/');

    // Wait for splash screen to disappear and app to load
    // The placeholder should be a good indicator. SupermarketPOS uses "Search products manually..."
    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 15000 });
  });

  test('should allow searching and adding a product to cart', async ({ page }) => {
    // Inject a mock product into the store if needed, but for now we'll assume the search works
    const searchInput = page.locator('input[placeholder*="Search"]').first();
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
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('Milk');

    const productItem = page.getByText('Milk').first();
    await expect(productItem).toBeVisible();
    await productItem.click();

    // Click Hold (the text might vary depending on the view, so use a more robust locator)
    // In POS.tsx it's an icon or text inside a button
    const holdButton = page.getByRole('button', { name: /Hold/i });
    await expect(holdButton).toBeVisible();
    await holdButton.click();

    // Verify cart is cleared. Cart header usually shows item count.
    // In AppLayout it might be different, but let's check for 0 items text
    await expect(page.getByText(/0 Items/i).or(page.getByText(/empty/i))).toBeVisible();
  });
});
