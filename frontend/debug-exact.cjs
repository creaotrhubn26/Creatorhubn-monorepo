const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', err => errs.push(err.message.slice(0, 300)));
  
  await p.goto('http://localhost:5001/photographer-dashboard-material', { 
    waitUntil: 'domcontentloaded', 
    timeout: 30000 
  });
  await p.waitForTimeout(6000);
  
  // Use exact same selector as the test
  const fabVisible = await p.locator('button[aria-label="chat"]').isVisible().catch(() => false);
  console.log('Chat FAB visible:', fabVisible);
  
  if (fabVisible) {
    await p.locator('button[aria-label="chat"]').click();
    await p.waitForTimeout(3000);
    
    // Check for tabs (like test 3)
    const tabs = await p.evaluate(() => {
      const allTabs = document.querySelectorAll('[role="tab"]');
      return Array.from(allTabs).map(t => (t.textContent || '').trim()).slice(0, 10);
    });
    console.log('Tabs after click:', tabs);
    
    // Check buttons
    const buttons = await p.evaluate(() => {
      return Array.from(document.querySelectorAll('button'))
        .map(b => b.textContent?.trim())
        .filter(t => t && t.length > 0 && t.length < 50);
    });
    console.log('Buttons:', buttons);
    
    // Check if "Åpne full chat" is there
    const fullChatBtn = buttons.find(b => b.includes('Åpne full chat'));
    console.log('Full chat button:', fullChatBtn ? 'FOUND' : 'NOT FOUND');
    
    if (fullChatBtn) {
      await p.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if ((btn.textContent || '').includes('Åpne full chat')) { btn.click(); break; }
        }
      });
      await p.waitForTimeout(3000);
      
      const dialogs = await p.evaluate(() => {
        const ds = document.querySelectorAll('[role="dialog"]');
        return Array.from(ds).map(d => ({
          w: d.offsetWidth, h: d.offsetHeight,
          text: (d.textContent || '').slice(0, 200)
        }));
      });
      console.log('Dialogs:', dialogs);
    }
  }
  
  console.log('Errors:', errs);
  await b.close();
})().catch(e => console.error(e));
