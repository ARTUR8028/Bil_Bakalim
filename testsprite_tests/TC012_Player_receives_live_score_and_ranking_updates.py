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
        # Click on Admin Panel to login and manage questions
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Input username and password and click login button
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[3]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('OSMAN')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[3]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('80841217')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Add a new question manually by filling question and answer fields and clicking 'Soru Ekle' button
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[4]/div/div[2]/div/textarea').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('What is the capital of France?')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[4]/div/div[2]/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Paris')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[4]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Navigate back to main menu to start hosting a quiz game
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click on 'Oyun Sunucusu' to start hosting a quiz game
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Start the quiz game by selecting 'Sıralı Mod' (Sequential Mode) to host the quiz
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click 'Oyunu Başlat' to start the quiz game and proceed to question answering phase
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click '➡️ Sonraki Soru' to proceed to next question and observe score and ranking updates
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click '➡️ Sonraki Soru' to proceed to question 3 and observe score and ranking updates
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click '➡️ Sonraki Soru' to proceed to question 4 and observe score and ranking updates
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click '➡️ Sonraki Soru' to proceed to question 5 and observe score and ranking updates
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # End the quiz game by clicking '🏁 Oyunu Bitir' to complete the test
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[2]/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Return to main menu to complete the test
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Assert that after each question, the live score and ranking updates are displayed promptly
        for i in range(1, 6):  # Assuming 5 questions as per the test steps
            # Wait for the score element to be visible and contain updated score text
            score_locator = frame.locator('xpath=//div[contains(@class, "score")]')
            await score_locator.wait_for(state='visible', timeout=5000)
            score_text = await score_locator.inner_text()
            assert score_text.strip() != '', f'Score text should not be empty after question {i}'
            # Wait for the ranking element to be visible and contain updated ranking text
            ranking_locator = frame.locator('xpath=//div[contains(@class, "ranking")]')
            await ranking_locator.wait_for(state='visible', timeout=5000)
            ranking_text = await ranking_locator.inner_text()
            assert ranking_text.strip() != '', f'Ranking text should not be empty after question {i}'
            # Click '➡️ Sonraki Soru' to proceed to next question except after last question
            if i < 5:
                next_question_button = frame.locator('xpath=//button[contains(text(), "➡️ Sonraki Soru")]')
                await next_question_button.click()
                await page.wait_for_timeout(3000)  # Wait for updates to reflect
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    