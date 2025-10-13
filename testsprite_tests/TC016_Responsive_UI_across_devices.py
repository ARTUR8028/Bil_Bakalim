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
        # Test UI layout and glassmorphism style on tablet screen size
        await page.goto('http://localhost:5173/', timeout=10000)
        

        # Simulate tablet screen size and verify UI layout and glassmorphism style
        await page.goto('http://localhost:5173/', timeout=10000)
        

        await page.mouse.wheel(0, window.innerHeight)
        

        # Simulate tablet screen size and verify UI layout and glassmorphism style
        await page.goto('http://localhost:5173/', timeout=10000)
        

        # Simulate tablet screen size and verify UI layout and glassmorphism style
        await page.goto('http://localhost:5173/', timeout=10000)
        

        # Simulate tablet screen size and verify UI layout and glassmorphism style
        await page.goto('http://localhost:5173/', timeout=10000)
        

        # Simulate tablet screen size and verify UI layout and glassmorphism style
        await page.goto('http://localhost:5173/', timeout=10000)
        

        # Simulate tablet screen size and verify UI layout and glassmorphism style
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Assert UI adapts responsively on desktop, tablet, and mobile screen sizes
        for width, height in [(1280, 800), (768, 1024), (375, 667)]:  # desktop, tablet, mobile
            await page.set_viewport_size({'width': width, 'height': height})
            await page.wait_for_timeout(1000)  # wait for layout to adjust
            # Check that main container is visible and not broken
            main_container = page.locator('div.main-container')
            assert await main_container.is_visible()
            # Check for no horizontal scroll indicating no layout breakage
            scroll_width = await page.evaluate('document.documentElement.scrollWidth')
            client_width = await page.evaluate('document.documentElement.clientWidth')
            assert scroll_width <= client_width
            # Verify glassmorphism style by checking backdrop-filter and background opacity
            glass_elements = page.locator('.glassmorphism')
            count = await glass_elements.count()
            assert count > 0  # there should be elements with glassmorphism style
            for i in range(count):
                style = await glass_elements.nth(i).evaluate('(el) => window.getComputedStyle(el)')
                assert 'blur' in style.backdropFilter or 'blur' in style['-webkit-backdrop-filter']
                bg_color = style.backgroundColor
                assert 'rgba' in bg_color and '0.' in bg_color  # semi-transparent background
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    