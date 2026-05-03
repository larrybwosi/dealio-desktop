import asyncio
from playwright.async_api import async_playwright
import json
import time

async def run_verification():
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800}
        )
        page = await context.new_page()

        # Mock Tauri internals and storage before navigation
        # We need to set up the storage and the invoke mocks
        now = int(time.time() * 1000)

        auth_state = {
            "state": {
                "isConfigured": True,
                "currentMember": {
                    "id": "mem1",
                    "name": "Admin",
                    "role": "admin",
                    "organizationId": "org1",
                    "userId": "user1",
                    "isActive": True
                },
                "currentLocation": {
                    "id": "loc1",
                    "name": "Main Store"
                },
                "isInitialized": True,
                "sessionUpdatedAt": now,
                "deviceType": "MAIN_HUB"
            },
            "version": 3
        }

        pos_state = {
            "state": {
                "settings": {
                    "businessType": "retail",
                    "sidebarItems": []
                },
                "currentLocationId": "loc1"
            },
            "version": 1
        }

        # Inject script to set localStorage and mock Tauri
        await page.add_init_script(f"""
            window.localStorage.setItem('pos-auth-storage-v3', JSON.stringify({json.dumps(auth_state)}));
            window.localStorage.setItem('dealio-pos-storage-v1', JSON.stringify({json.dumps(pos_state)}));

            window.__TAURI_INTERNALS__ = {{
                invoke: async (cmd, args) => {{
                    console.log('Tauri invoke:', cmd, args);
                    if (cmd === 'get_device_config') {{
                        return {{ location_id: 'loc1', allow_negative_stock: false }};
                    }}
                    if (cmd === 'get_locations_command') {{
                        return {{ locations: [{{ id: 'loc1', name: 'Main Store' }}] }};
                    }}
                    if (cmd === 'get_shift_command') {{
                        return null; // No active shift
                    }}
                    if (cmd === 'get_shift_history_command') {{
                        return [];
                    }}
                    if (cmd === 'open_shift_command') {{
                        return {{ id: 'shift1', status: 'Open', opening_cash: 100 }};
                    }}
                    return null;
                }}
            }};
        """)

        print("Navigating to Shift Manager...")
        await page.goto("http://localhost:1420/shift-manager")

        # Wait for either the Shift Manager or some error
        try:
            # Check for the heading we added: "Shift Management"
            await page.wait_for_selector("h1:has-text('Shift Management')", timeout=15000)
            print("Successfully reached Shift Management page.")

            # Take screenshot of the initial state
            await page.screenshot(path="shift_manager_initial.png")

            # Look for "Open New Shift" button
            open_btn = page.locator("button:has-text('Open New Shift')")
            if await open_btn.is_visible():
                print("Found 'Open New Shift' button. Clicking it.")
                await open_btn.click()

                # Wait for the cash counter
                await page.wait_for_selector("text=Opening Cash Breakdown", timeout=5000)
                print("Opening Cash Breakdown visible.")

                # Check for denominations
                await page.wait_for_selector("text=1000", timeout=2000)
                print("Denominations visible.")

                # Enter some cash
                # Find input for 1000 denomination
                # Based on our component, it should be an input next to "1000"
                # We can find it by looking for the input in the same row as "1000"
                thousand_input = page.locator("div:has-text('1000') + input")
                if await thousand_input.count() == 0:
                     # fallback to finding input by value or placeholder if needed
                     # but let's try to find it by parent
                     thousand_input = page.locator("div:has(span:text-is('1000')) input")

                await thousand_input.fill("5")
                print("Filled 5 x 1000.")

                # Take screenshot of filled denominations
                await page.screenshot(path="shift_manager_opening_filled.png")

                # Submit
                await page.locator("button:has-text('Start Shift')").click()
                print("Clicked Start Shift.")

                # Wait for shift to be open (mock will return success)
                # In real app, it would show active shift UI
                # Our mock 'get_shift_command' still returns null unless we change it
                # But for UI verification, we've seen the counter.

        except Exception as e:
            print(f"Error during verification: {e}")
            await page.screenshot(path="verification_error.png")
            # Log the page content for debugging
            content = await page.content()
            with open("page_content.html", "w") as f:
                f.write(content)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
