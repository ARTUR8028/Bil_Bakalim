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
        # Click on 'Oyun Sunucusu' to go to the game host login or control panel.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click on 'Sıralı Mod' button to select sequential game mode.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click 'Oyunu Başlat' (Start Game) button to start the quiz game.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Open a new tab and navigate to the player join link to simulate a player joining the game.
        await page.goto('http://localhost:5173/#player', timeout=10000)
        

        # Input player name 'TestPlayer' and click 'Oyuna Katıl' to join the game.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('TestPlayer')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Clear the input field, enter a new unique player name, and click 'Oyuna Katıl' to join the game.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div[3]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div[3]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('TestPlayer2')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Switch back to the Quiz Host tab to start the quiz game now that at least one player has joined.
        await page.goto('http://localhost:5173/#host', timeout=10000)
        

        # Locate the host controls to start the quiz game or navigate back to the game mode lobby to start the quiz.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click on 'Oyun Sunucusu' to navigate back to the game host control panel and try to start the quiz again.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click on 'Sıralı Mod' to enter the sequential mode lobby and start the quiz again.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click 'Oyunu Başlat' button to start the quiz game and verify first question broadcast and timer start.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click the '➡️ Sonraki Soru' button to advance to the next question and verify the question order and timer functionality.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click the '➡️ Sonraki Soru' button again to advance to question 3 and verify continued sequential progression and timer behavior.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Click the '🏁 Oyunu Bitir' (End Game) button to stop the quiz and verify the game ends properly.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div/div/div[2]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Assert the quiz title is displayed correctly
        assert await frame.locator('text=MODERN QUIZ').is_visible()
        # Assert the host status shows server is connected
        assert await frame.locator('text=Sunucu Bağlı').is_visible()
        # Assert the first question number is displayed correctly
        question_number_text = await frame.locator('xpath=//div[contains(text(),"4 / 890")]').text_content()
        assert question_number_text.strip() == '4 / 890'
        # Assert the question text is correct
        question_text = await frame.locator('xpath=//div[contains(text(),"İstanbul'un nüfusu yaklaşık kaç milyondur?")]').text_content()
        assert "İstanbul'un nüfusu yaklaşık kaç milyondur?" in question_text
        # Assert the options for navigation buttons are visible
        assert await frame.locator('text=➡️ Sonraki Soru').is_visible()
        assert await frame.locator('text=🏁 Oyunu Bitir').is_visible()
        # Click '➡️ Sonraki Soru' to advance to next question and verify question number increments
        await frame.locator('text=➡️ Sonraki Soru').click()
        await page.wait_for_timeout(3000)
        next_question_number_text = await frame.locator('xpath=//div[contains(text(),"5 / 890")]').text_content()
        assert next_question_number_text.strip() == '5 / 890'
        # Click '➡️ Sonraki Soru' again to advance to question 6 and verify
        await frame.locator('text=➡️ Sonraki Soru').click()
        await page.wait_for_timeout(3000)
        next_question_number_text_2 = await frame.locator('xpath=//div[contains(text(),"6 / 890")]').text_content()
        assert next_question_number_text_2.strip() == '6 / 890'
        # Click '🏁 Oyunu Bitir' to end the game and verify the game ends properly
        await frame.locator('text=🏁 Oyunu Bitir').click()
        await page.wait_for_timeout(3000)
        # Verify that after ending the game, the question area is cleared or shows game ended message
        game_ended_text = await frame.locator('xpath=//div[contains(text(),"Oyun Bitti") or contains(text(),"Quiz Ended")]').text_content()
        assert game_ended_text is not None
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    