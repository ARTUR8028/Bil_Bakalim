import asyncio
from playwright import async_api

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5173", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # Click on 'Admin Paneli' to go to admin login page.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Enter invalid username and password, then click login button.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[3]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('invalidUser')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[3]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('invalidPass')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        frame = context.pages[-1]
        error_message_locator = frame.locator('xpath=html/body/div/div/div/div[4]/div')
        await page.wait_for_timeout(3000)
        assert await error_message_locator.is_visible(), 'Error message is not visible after invalid login attempt'
        error_text = await error_message_locator.text_content()
        assert 'invalid' in error_text.lower() or 'hata' in error_text.lower() or 'geçersiz' in error_text.lower(), f'Unexpected error message text: {error_text}'
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    