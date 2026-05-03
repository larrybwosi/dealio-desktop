import asyncio
import os
from playwright.async_api import async_playwright

async def run_verification():
    async with async_playwright() as p:
        # Use a persistent context to handle localStorage better
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Inject state and mock Tauri invoke before any script runs
        await page.add_init_script("""
            // Mock Tauri window objects
            window.__TAURI_INTERNALS__ = {
                invoke: async (cmd, args) => {
                    console.log('Tauri invoke called:', cmd, args);
                    if (cmd === 'get_device_config') {
                        return { location_id: 'loc_1', allow_negative_stock: false };
                    }
                    if (cmd === 'get_locations_command') {
                        return { locations: [{ id: 'loc_1', name: 'Main Store' }] };
                    }
                    if (cmd === 'get_active_shift') {
                        return null; // Start with no active shift
                    }
                    if (cmd === 'get_all_members_command') {
                        return [{ id: 'mem_1', name: 'Admin', role: 'admin' }];
                    }
                    if (cmd === 'restore_member_session') {
                        return null;
                    }
                    return null;
                },
                metadata: {
                   version: '0.1.0'
                }
            };

            // Inject localStorage
            const authState = {
                state: {
                    isConfigured: true,
                    isInitialized: true,
                    currentLocation: { id: "loc_1", name: "Main Store" },
                    currentMember: {
                        id: "mem_1",
                        name: "Admin",
                        organizationId: "org_1",
                        userId: "user_1",
                        isActive: true,
                        isCheckedIn: true
                    },
                    sessionUpdatedAt: Date.now(),
                    deviceType: 'MAIN_HUB'
                },
                version: 3
            };
            localStorage.setItem('pos-auth-storage-v3', JSON.stringify(authState));

            const posState = {
                state: {
                    settings: {
                        businessName: 'Skryme POS',
                        currency: 'USD',
                        taxRate: 0,
                        businessType: 'retail'
                    }
                },
                version: 1
            };
            localStorage.setItem('dealio-pos-storage-v1', JSON.stringify(posState));
        """)

        print("Navigating to Shift Manager...")
        await page.goto("http://localhost:1420/shift-manager")

        try:
            # Wait for the heading
            heading = page.locator("h1:has-text('Shift Management')")
            await heading.wait_for(timeout=10000)
            print("Successfully reached Shift Management page.")

            # Take a screenshot
            await page.screenshot(path="shift_manager_initial.png")

            # Check if "Open New Shift" button is visible
            open_btn = page.locator("button:has-text('Open New Shift')")
            if await open_btn.is_visible():
                print("Found 'Open New Shift' button. Clicking it...")
                await open_btn.click()

                # Wait for the opening cash counter
                await page.locator("text=Opening Cash Details").wait_for(timeout=5000)
                print("Opening Cash Details dialog appeared.")
                await page.screenshot(path="shift_manager_open_dialog.png")

                # Type some opening cash
                # Find input for denomination 100 (if exists) or just any input
                # The CashDenominationCounter uses inputs
                inputs = page.locator("input[type='number']")
                await inputs.first.fill("5") # 5 of the first denomination
                print("Filled some cash details.")

                await page.screenshot(path="shift_manager_filled.png")

            else:
                print("'Open New Shift' button not found. Maybe a shift is already active?")

        except Exception as e:
            print(f"Verification failed: {e}")
            await page.screenshot(path="verification_error_v3.png")
            content = await page.content()
            with open("page_content_v3.html", "w") as f:
                f.write(content)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
