import asyncio
from playwright.async_api import async_playwright
import json

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # Mocking Zustand stores in localStorage
        auth_state = {
            "state": {
                "isConfigured": True,
                "isInitialized": True,
                "currentMember": {
                    "id": "test-member",
                    "name": "Test Cashier",
                    "role": "admin"
                },
                "currentLocation": {
                    "id": "test-loc",
                    "name": "Test Store"
                },
                "deviceType": "MAIN_HUB"
            },
            "version": 3
        }

        pos_state = {
            "state": {
                "settings": {
                    "businessType": "supermarket",
                    "taxRate": 16,
                    "enableHoldSale": True,
                    "maxHeldOrders": 20
                },
                "currentOrder": {
                    "items": []
                },
                "heldOrders": []
            },
            "version": 1
        }

        # Injecting localStorage AND mocking Tauri invoke
        await page.add_init_script(f"""
            localStorage.setItem('pos-auth-storage-v3', '{json.dumps(auth_state)}');
            localStorage.setItem('dealio-pos-storage-v1', '{json.dumps(pos_state)}');

            window.__TAURI_INTERNALS__ = {{
                invoke: async (cmd, args) => {{
                    console.log('MOCK INVOKE:', cmd, args);
                    if (cmd === 'get_device_config') return {{ location_id: 'test-loc', allow_negative_stock: false }};
                    if (cmd === 'get_locations_command') return {{ locations: [{{ id: 'test-loc', name: 'Test Store' }}] }};
                    if (cmd === 'get_tables_command') return [];
                    return null;
                }}
            }};
        """)

        print("Navigating to app...")
        await page.goto("http://localhost:1420", wait_until="networkidle")

        # Wait for potential hydration and rendering
        await asyncio.sleep(5)

        # Take a screenshot
        await page.screenshot(path="/home/jules/verification/pos_final_v5.png", full_page=True)

        # Check for specific elements
        # The buttons might be in lowercase or have icons, so let's use more flexible selectors
        has_exact_cash = await page.locator("button:has-text('Exact Cash')").count() > 0
        has_held_sales = await page.locator("button:has-text('Held Sales')").count() > 0

        print(f"Has Exact Cash button: {has_exact_cash}")
        print(f"Has Held Sales button: {has_held_sales}")

        # Log console for debugging
        # page.on("console", lambda msg: print(f"PAGE CONSOLE: {msg.text}"))

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
