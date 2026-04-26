import asyncio
from playwright.async_api import async_playwright
import json
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # Mocking Zustand stores in localStorage to bypass setup/login
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
                }
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

        # Injecting localStorage before navigation
        await page.add_init_script(f"""
            localStorage.setItem('pos-auth-storage-v3', '{json.dumps(auth_state)}');
            localStorage.setItem('dealio-pos-storage-v1', '{json.dumps(pos_state)}');
            window.localStorage.setItem('DEVICE_ROLE', 'MAIN_HUB');
        """)

        print("Navigating to app...")
        try:
            await page.goto("http://localhost:1420", wait_until="networkidle", timeout=30000)
        except Exception as e:
            print(f"Navigation timed out or failed: {e}")

        # Wait for splash screen to disappear and POS to render
        await asyncio.sleep(5)

        # Take a screenshot
        await page.screenshot(path="/home/jules/verification/pos_final_v4.png", full_page=True)

        # Check for specific elements
        has_exact_cash = await page.get_by_text("Exact Cash").is_visible()
        has_held_sales = await page.get_by_text("Held Sales").is_visible()

        print(f"Has Exact Cash button: {has_exact_cash}")
        print(f"Has Held Sales button: {has_held_sales}")

        # Log console errors
        page.on("console", lambda msg: print(f"PAGE CONSOLE: {msg.text}"))

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
