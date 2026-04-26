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

        # Mock Tauri APIs with more logging
        await page.add_init_script("""
            window.__TAURI__ = {
                core: {
                    invoke: async (cmd, args) => {
                        console.log('Mocked invoke called:', cmd, args);
                        const mocks = {
                            'get_device_config': { location_id: 'test-loc', allow_negative_stock: false },
                            'get_locations_command': { locations: [{ id: 'test-loc', name: 'Test Store' }] },
                            'get_active_shift': { id: 'test-shift', startTime: new Date().toISOString() },
                            'get_products_command': { products: [] },
                            'get_customers_command': { customers: [] },
                            'get_held_sales': [],
                            'restore_member_session': {},
                            'login_member': { member: { id: 'test-mem', name: 'Test User' }, restoredSession: true }
                        };
                        if (cmd in mocks) {
                            console.log('Returning mock for:', cmd);
                            return mocks[cmd];
                        }
                        console.log('No mock for:', cmd);
                        return null;
                    }
                },
                event: {
                    listen: () => Promise.resolve(() => {}),
                    emit: () => Promise.resolve()
                }
            };
        """)

        # Navigate to a blank page first
        await page.goto("http://localhost:1420")

        # Set localStorage with a very explicit state
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
                    "isCheckedIn": True,
                    "image": ""
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
                "businessType": "retail"
            },
            "version": 1
        }

        await page.evaluate("""([authState, posState]) => {
            console.log('Setting localStorage...');
            localStorage.setItem('pos-auth-storage-v3', JSON.stringify(authState));
            localStorage.setItem('dealio-pos-storage-v1', JSON.stringify(posState));
            localStorage.setItem('DEVICE_ID', 'test-device');
            localStorage.setItem('DEVICE_ROLE', 'MAIN_HUB');
            console.log('localStorage set.');
        }""", [auth_state, pos_state])

        # Reload
        await page.goto("http://localhost:1420", wait_until="networkidle")

        # Wait more for any redirects/loading
        await asyncio.sleep(10)

        # Log the current URL and some content
        print(f"Final URL: {page.url}")
        content = await page.content()
        print(f"Page title/heading: {await page.locator('h1, h2').first.text_content() if await page.locator('h1, h2').count() > 0 else 'None'}")

        # Take a screenshot
        await page.screenshot(path="/home/jules/verification/pos_final_v8.png")

        # Check for specific buttons - use broader search
        exact_cash = page.get_by_text("Exact Cash")
        held_sales = page.get_by_text("Held Sales")

        print(f"Exact Cash text visible: {await exact_cash.is_visible()}")
        print(f"Held Sales text visible: {await held_sales.is_visible()}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
