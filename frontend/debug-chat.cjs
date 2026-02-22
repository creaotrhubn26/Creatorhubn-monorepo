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
  
  // Click open full chat
  const clicked = await p.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if ((btn.textContent || '').trim() === 'Åpne full chat') {
        btn.click();
        return true;
      }
    }
    return false;
  });
  console.log('Clicked Åpne full chat:', clicked);
  
  await p.waitForTimeout(3000);
  
  // Check dialogs
  const dialogs = await p.evaluate(() => {
    const ds = document.querySelectorAll('[role="dialog"]');
    return Array.from(ds).map(d => ({
      w: d.offsetWidth,
      h: d.offsetHeight,
      text: (d.textContent || '').slice(0, 200)
    }));
  });
  console.log('Dialogs found:', dialogs.length);
  dialogs.forEach((d, i) => console.log(`  Dialog ${i}: ${d.w}x${d.h}, text: ${d.text}`));
  
  // Check console errors
  console.log('\nErrors:', errs.length);
  errs.forEach((e, i) => console.log(`  Error ${i}: ${e}`));
  
  await b.close();
})().catch(e => console.error(e));
