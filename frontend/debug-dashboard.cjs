const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', err => errs.push(err.message.slice(0, 200)));
  p.on('console', msg => {
    if (msg.type() === 'error') errs.push('[console.error] ' + msg.text().slice(0, 200));
  });
  
  await p.goto('http://localhost:5001/photographer-dashboard-material', { 
    waitUntil: 'domcontentloaded', 
    timeout: 30000 
  });
  await p.waitForTimeout(8000);
  
  const rootHTML = await p.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.length : 0;
  });
  
  const hasLabel = await p.evaluate(() => {
    return !!document.querySelector('[aria-label="CreatorHub Norge Dashboard"]');
  });
  
  const bodyText = await p.evaluate(() => {
    return document.body.innerText.slice(0, 500);
  });
  
  const allAriaLabels = await p.evaluate(() => {
    const els = document.querySelectorAll('[aria-label]');
    return Array.from(els).map(el => el.getAttribute('aria-label')).slice(0, 20);
  });
  
  console.log('Root HTML length:', rootHTML);
  console.log('Has dashboard label:', hasLabel);
  console.log('Body text:', bodyText);
  console.log('Aria labels found:', JSON.stringify(allAriaLabels, null, 2));
  console.log('Errors count:', errs.length);
  errs.forEach((e, i) => console.log(`Error ${i}:`, e));
  
  await b.close();
})().catch(e => console.error(e));
