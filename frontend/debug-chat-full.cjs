const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', err => errs.push('[page] ' + err.message.slice(0, 300)));
  
  // Step 1: Load photographer dashboard
  await p.goto('http://localhost:5001/photographer-dashboard-material', { 
    waitUntil: 'domcontentloaded', 
    timeout: 30000 
  });
  await p.waitForTimeout(6000);
  console.log('Step 1: Page loaded');
  
  // Step 2: Click FAB to open chat drawer
  const fabClicked = await p.evaluate(() => {
    const fabs = document.querySelectorAll('.MuiFab-root, [aria-label*="chat" i], [aria-label*="Chat" i]');
    for (const fab of fabs) {
      if (fab.offsetWidth > 0) {
        fab.click();
        return true;
      }
    }
    // Try any floating button
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      const style = window.getComputedStyle(btn);
      if (style.position === 'fixed' && parseInt(style.bottom) < 100) {
        btn.click();
        return 'fixed-button';
      }
    }
    return false;
  });
  console.log('Step 2: FAB clicked:', fabClicked);
  await p.waitForTimeout(2000);
  
  // Step 3: Check for "Åpne full chat" button
  const hasFullChatBtn = await p.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if ((btn.textContent || '').includes('Åpne full chat')) {
        return { found: true, text: btn.textContent.trim() };
      }
    }
    return { found: false };
  });
  console.log('Step 3: Full chat button:', hasFullChatBtn);
  
  if (hasFullChatBtn.found) {
    // Step 4: Click "Åpne full chat"
    const fullChatClicked = await p.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if ((btn.textContent || '').includes('Åpne full chat')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    console.log('Step 4: Full chat clicked:', fullChatClicked);
    await p.waitForTimeout(3000);
    
    // Step 5: Check for dialog
    const dialogs = await p.evaluate(() => {
      const ds = document.querySelectorAll('[role="dialog"]');
      return Array.from(ds).map(d => ({
        w: d.offsetWidth,
        h: d.offsetHeight,
        visible: d.offsetWidth > 0,
        text: (d.textContent || '').slice(0, 200)
      }));
    });
    console.log('Step 5: Dialogs:', dialogs.length);
    dialogs.forEach((d, i) => console.log(`  Dialog ${i}: ${d.w}x${d.h} visible=${d.visible}`));
    
    // Check for conversations
    const convs = await p.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { inDialog: false };
      const listItems = dialog.querySelectorAll('.MuiListItem-root, .MuiListItemButton-root, li');
      return {
        inDialog: true,
        listItemCount: listItems.length,
        items: Array.from(listItems).slice(0, 5).map(li => (li.textContent || '').slice(0, 80))
      };
    });
    console.log('Step 5b: Conversations:', JSON.stringify(convs, null, 2));
  }
  
  console.log('\nErrors:', errs.length);
  errs.forEach((e, i) => console.log(`  ${i}: ${e}`));
  
  await b.close();
})().catch(e => console.error(e));
