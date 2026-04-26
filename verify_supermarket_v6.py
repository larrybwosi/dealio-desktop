import asyncio
from playwright.async_api import async_playwright
import json
import time

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 720}
        )
        page = await context.new_page()

        # Mock Tauri APIs
        await page.add_init_script("""
            window.__TAURI__ = {
                core: {
                    invoke: async (cmd, args) => {
                        console.log('Mocked invoke:', cmd, args);
                        const mocks = {
                            'get_device_config': { location_id: 'test-loc', allow_negative_stock: false },
                            'get_locations_command': { locations: [{ id: 'test-loc', name: 'Test Store' }] },
                            'get_active_shift': null,
                            'get_products_command': { products: [] },
                            'get_customers_command': { customers: [] },
                            'get_held_sales': [],
                            'restore_member_session': {}
                        };
                        if (cmd in mocks) return mocks[cmd];
                        return null;
                    }
                },
                event: {
                    listen: () => Promise.resolve(() => {}),
                    emit: () => Promise.resolve()
                }
            };
        """)

        # Set localStorage BEFORE navigating
        now = int(time.time() * 1000)
        auth_state = {
            "state": {
                "isConfigured": True,
                "currentLocation": {"id": "test-loc", "name": "Test Store"},
                "currentMember": {
                    "id": "test-mem",
                    "name": "Test User",
                    "organizationId": "test-org",
                    "userId": "test-user",
                    "isActive": True,
                    "isCheckedIn": True
                },
                "isRestoredSession": True,
                "sessionUpdatedAt": now,
                "isInitialized": True,
                "deviceType": "MAIN_HUB"
            },
            "version": 3
        }

        pos_state = {
            "state": {
                "businessType": "retail" # This is overridden by VITE_BUSINESS_MODE anyway
            },
            "version": 1
        }

        # Navigate to a blank page first to allow setting localStorage for the domain
        await page.goto("http://localhost:1420")

        await page.evaluate(f"""(authState, posState) => {{
            localStorage.setItem('pos-auth-storage-v3', JSON.stringify(authState));
            localStorage.setItem('dealio-pos-storage-v1', JSON.stringify(posState));
            localStorage.setItem('DEVICE_ID', 'test-device');
            localStorage.setItem('DEVICE_ROLE', 'MAIN_HUB');
        }}""", auth_state, pos_state)

        # Reload to apply localStorage
        await page.goto("http://localhost:1420")

        # Wait for the page to load
        await asyncio.sleep(5)

        # Check if we are still on Checkin page
        content = await page.content()
        is_checkin = "Check In" in content
        print(f"Is Check In page still showing? {is_checkin}")

        # Take a screenshot
        await page.screenshot(path="/home/jules/verification/pos_final_v6.png")

        # Check for specific buttons
        exact_cash_exists = await page.get_by_role("button", name="Exact Cash").is_visible()
        held_sales_exists = await page.get_by_role("button", name="Held Sales").is_visible()

        print(f"Exact Cash button visible: {exact_cash_exists}")
        print(f"Held Sales button visible: {held_sales_exists}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
