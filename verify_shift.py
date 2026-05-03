import asyncio
from playwright.async_api import async_playwright
import json
import os

async def verify_shift_ui():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Set viewport to a common desktop size
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        # Define the state to inject
        auth_state = {
            "state": {
                "isConfigured": True,
                "isInitialized": True,
                "currentLocation": {
                    "id": "loc_1",
                    "name": "Main Store",
                    "organizationId": "org_1"
                },
                "currentMember": {
                    "id": "mem_1",
                    "name": "Test User",
                    "role": "admin",
                    "userId": "user_1",
                    "organizationId": "org_1"
                },
                "deviceType": "MAIN_HUB"
            },
            "version": 3
        }

        pos_state = {
            "state": {
                "settings": {
                    "businessType": "retail",
                    "currency": "KSH",
                    "taxRate": 16,
                    "sidebarItems": [
                        {"id": "pos", "label": "POS", "icon": "LayoutGrid", "enabled": True},
                        {"id": "shift-manager", "label": "Shift Manager", "icon": "Clock", "enabled": True}
                    ]
                }
            },
            "version": 1
        }

        # Mock Tauri invokes and inject localStorage before navigation
        await page.add_init_script(f"""
            window.localStorage.setItem('pos-auth-storage-v3', JSON.stringify({json.dumps(auth_state)}));
            window.localStorage.setItem('dealio-pos-storage-v1', JSON.stringify({json.dumps(pos_state)}));

            // Mock Tauri __TAURI_INTERNALS__
            window.__TAURI_INTERNALS__ = {{
                invoke: async (cmd, args) => {{
                    console.log('Tauri invoke:', cmd, args);
                    if (cmd === 'get_device_config') {{
                        return {{ location_id: 'loc_1', allow_negative_stock: false }};
                    }}
                    if (cmd === 'get_locations_command') {{
                        return {{ locations: [{{ id: 'loc_1', name: 'Main Store' }}] }};
                    }}
                    if (cmd === 'get_active_shift_command') {{
                        return null; // Start with no active shift
                    }}
                    if (cmd === 'get_tables_command') {{
                        return [];
                    }}
                    if (cmd === 'get_printer_config') {{
                        return null;
                    }}
                    return null;
                }},
                metadata: {{
                    platform: 'linux',
                    arch: 'x86_64'
                }}
            }};

            // Also mock the direct invoke if it's imported from @tauri-apps/api
            window.__TAURI__ = {{
                core: {{
                    invoke: window.__TAURI_INTERNALS__.invoke
                }}
            }};
        """)

        print("Navigating to app...")
        await page.goto("http://localhost:1420/shift-manager")

        # Wait for the splash screen to be removed or hidden
        print("Waiting for app to load...")
        try:
            # Wait for either the shift manager content or the setup/checkin if mock failed
            await page.wait_for_selector("text=Shift Management", timeout=15000)
        except Exception as e:
            print(f"Timeout waiting for Shift Management: {e}")
            await page.screenshot(path="verification_timeout_debug.png")

        # Take a screenshot of the initial state (No shift active)
        await page.screenshot(path="verification_shift_manager_initial.png")
        print("Initial screenshot taken.")

        # Try to click "Start New Shift" if it exists
        start_btn = page.get_by_role("button", name="Start New Shift")
        if await start_btn.is_visible():
            print("Clicking Start New Shift...")
            await start_btn.click()
            await asyncio.sleep(1)
            await page.screenshot(path="verification_shift_start_dialog.png")

            # Click "Use Counter"
            use_counter_btn = page.get_by_role("button", name="Use Counter")
            if await use_counter_btn.is_visible():
                print("Switching to counter...")
                await use_counter_btn.click()
                await asyncio.sleep(1)
                await page.screenshot(path="verification_shift_counter_view.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_shift_ui())
