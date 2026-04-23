import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));

  for (const path of ['/email-designer', '/showcase-amazon-demo', '/meta-page-inspector']) {
    await page.goto(`https://theroleroom.com${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      url: location.pathname,
      h1: document.querySelector('h1,h2,h3')?.textContent?.slice(0, 80) || null,
      bodyStart: document.body.innerText.slice(0, 150).replace(/\s+/g, ' '),
    }));
    console.log(`\n${path} ->`);
    console.log(' ', JSON.stringify(info));
  }
  await browser.close();
})();
