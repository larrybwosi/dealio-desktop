import asyncio
import json
import time
from playwright.async_api import async_playwright

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Create a context with a standard viewport
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await context.new_page()

        # Mock Tauri's invoke and other globals
        await page.add_init_script("""
            window.__TAURI_INTERNALS__ = {
                invoke: async (method, args) => {
                    console.log('Tauri invoke:', method, args);
                    if (method === 'get_device_config') {
                        return { location_id: 'loc_1', allow_negative_stock: false };
                    }
                    if (method === 'get_locations_command') {
                        return { locations: [{ id: 'loc_1', name: 'Main Store', isActive: true, isDefault: true, locationType: 'RETAIL_SHOP' }] };
                    }
                    if (method === 'start_nfc_listener') {
                        return null;
                    }
                    if (method === 'restore_member_session') {
                        return null;
                    }
                    if (method === 'get_tables_command') {
                        return [];
                    }
                    if (method === 'get_active_shift') {
                        return null; // No active shift
                    }
                    return null;
                },
                metadata: {
                    platform: 'linux',
                    arch: 'x86_64',
                    os: 'Linux',
                    version: '1.0.0'
                }
            };

            // Mock listen for events
            window.__TAURI_INTERNALS__.listen = async (event, handler) => {
                console.log('Tauri listen:', event);
                return () => {};
            };

            // Mock getVersion
            window.__TAURI_INTERNALS__.getVersion = async () => '1.0.0';
        """)

        # Prepare state
        now = int(time.time() * 1000)
        auth_state = {
            "state": {
                "isConfigured": True,
                "currentMember": {
                    "id": "mem_1",
                    "name": "Admin User",
                    "organizationId": "org_1",
                    "userId": "user_1",
                    "isActive": True,
                    "createdAt": "2023-01-01T00:00:00.000Z",
                    "updatedAt": "2023-01-01T00:00:00.000Z",
                    "isCheckedIn": True,
                    "image": "",
                    "role": "admin" # Added for compatibility with any checks
                },
                "currentLocation": {
                    "id": "loc_1",
                    "name": "Main Store",
                    "isActive": True,
                    "isDefault": True,
                    "locationType": "RETAIL_SHOP"
                },
                "isRestoredSession": False,
                "sessionUpdatedAt": now,
                "isInitialized": True,
                "allowNegativeStock": False,
                "deviceType": "MAIN_HUB",
                "hubIp": None
            },
            "version": 0
        }

        pos_state = {
            "state": {
                "settings": {
                    "businessType": "restaurant",
                    "taxRate": 16,
                    "currency": "USD"
                },
                "currentOrder": {"items": []},
                "heldOrders": []
            },
            "version": 0
        }

        # Inject state into localStorage
        await page.add_init_script(f"""
            localStorage.setItem('pos-auth-storage-v3', JSON.stringify({json.dumps(auth_state)}));
            localStorage.setItem('dealio-pos-storage-v1', JSON.stringify({json.dumps(pos_state)}));
            console.log('localStorage injected');
        """)

        # Navigate
        print("Navigating to /shift-manager...")
        await page.goto("http://localhost:1420/shift-manager")

        # Wait for page load and check state
        print("Checking page content...")
        try:
            # Wait for any heading that might appear on Shift Manager page
            await page.wait_for_selector("h1, h2, h3", timeout=10000)

            # Take screenshot
            await page.screenshot(path="verification_shift_manager.png")
            print("Screenshot saved to verification_shift_manager.png")

            # Check if we are on the right page
            content = await page.content()
            with open("page_content_v4.html", "w") as f:
                f.write(content)

            if "Shift Management" in content or "Open New Shift" in content:
                print("SUCCESS: Shift Manager page rendered correctly.")
            else:
                print("FAILURE: Shift Manager page content not found.")
                print(f"URL: {page.url}")

        except Exception as e:
            print(f"Error during verification: {e}")
            await page.screenshot(path="verification_error_v4.png")
            content = await page.content()
            with open("page_content_v4.html", "w") as f:
                f.write(content)
            print(f"Screenshot and HTML saved for debugging. URL: {page.url}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
