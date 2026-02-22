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
  
  // Click FAB
  await p.evaluate(() => {
    const fabs = document.querySelectorAll('.MuiFab-root, [aria-label*="chat" i], [aria-label*="Chat" i]');
    for (const fab of fabs) {
      if (fab.offsetWidth > 0) { fab.click(); return true; }
    }
    return false;
  });
  await p.waitForTimeout(2000);
  
  // Dump visible drawers/panels
  const state = await p.evaluate(() => {
    const root = document.getElementById('root');
    const html = root ? root.innerHTML : '';
    
    // Check for drawer
    const drawers = document.querySelectorAll('.MuiDrawer-root, [role="presentation"]');
    const drawerInfo = Array.from(drawers).map(d => ({
      visible: d.offsetWidth > 0,
      text: (d.textContent || '').slice(0, 200)
    }));
    
    // Check all button text
    const allBtns = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t && t.length > 0 && t.length < 50);
    
    // Check for any chat-related visible content
    const chatRelated = html.includes('Åpne full chat');
    const universalChat = html.includes('UniversalChat') || html.includes('EVENDI') || html.includes('CREATORHUB');
    
    return {
      drawerCount: drawers.length,
      drawers: drawerInfo,
      buttons: allBtns.slice(0, 20),
      hasFullChatInHTML: chatRelated,
      hasUniversalChat: universalChat
    };
  });
  
  console.log('State after FAB click:');
  console.log('  Drawers:', state.drawerCount, state.drawers);
  console.log('  Has full chat in HTML:', state.hasFullChatInHTML);
  console.log('  Has universal chat:', state.hasUniversalChat);
  console.log('  Buttons:', state.buttons);
  console.log('  Errors:', errs);
  
  await b.close();
})().catch(e => console.error(e));
