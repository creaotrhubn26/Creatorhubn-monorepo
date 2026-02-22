const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.goto('http://localhost:5001/e2e-casting-test.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  // Dismiss project dialog
  const projItem = page.locator('text=/TROLL/i').first();
  if (await projItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await projItem.click({ force: true });
    await page.waitForTimeout(1000);
  }
  
  const tabIds = ['tab-roller', 'tab-kandidater', 'tab-auditions', 'tab-team', 
    'tab-lokasjoner', 'tab-rekvisitter', 'tab-produksjonsplan', 
    'tab-shot-lists', 'tab-story-arc-studio'];
    
  for (const tabId of tabIds) {
    const tab = page.locator(`#${tabId}`);
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.scrollIntoViewIfNeeded().catch(() => {});
      await tab.click({ force: true });
      await page.waitForTimeout(500);
      
      console.log(`\n--- TAB: ${tabId} ---`);
      
      // Get all buttons
      const buttons = page.locator('button:visible');
      const btnCount = await buttons.count();
      const btnTexts = [];
      for (let i = 0; i < Math.min(btnCount, 20); i++) {
        const t = await buttons.nth(i).textContent().catch(() => '');
        if (t && t.trim()) btnTexts.push(t.trim().substring(0, 60));
      }
      console.log('Buttons:', JSON.stringify(btnTexts.filter(t => t.length > 0)));
      
      // Get all inputs
      const inputs = page.locator('input:visible');
      const inputCount = await inputs.count();
      for (let i = 0; i < Math.min(inputCount, 10); i++) {
        const ph = await inputs.nth(i).getAttribute('placeholder').catch(() => '');
        const type = await inputs.nth(i).getAttribute('type').catch(() => '');
        const ariaLabel = await inputs.nth(i).getAttribute('aria-label').catch(() => '');
        console.log(`Input ${i}: placeholder="${ph}" type="${type}" aria-label="${ariaLabel}"`);
      }
      
      // Check for tabpanel
      const tabpanel = page.locator('[role="tabpanel"]');
      const tpCount = await tabpanel.count();
      console.log('tabpanel count:', tpCount);
      
      // Get fab / aria-label buttons
      const ariaButtons = page.locator('[aria-label]:visible');
      const ariaCount = await ariaButtons.count();
      const ariaLabels = [];
      for (let i = 0; i < Math.min(ariaCount, 15); i++) {
        const al = await ariaButtons.nth(i).getAttribute('aria-label').catch(() => '');
        if (al) ariaLabels.push(al);
      }
      console.log('aria-labels:', JSON.stringify(ariaLabels));
      
      // Get visible text (condensed)
      const bodyText = await page.locator('#root').textContent().catch(() => '');
      console.log('Text (200):', bodyText?.substring(bodyText.indexOf(tabId.replace('tab-', '')) || 0, 300));
    }
  }
  
  await browser.close();
})();
