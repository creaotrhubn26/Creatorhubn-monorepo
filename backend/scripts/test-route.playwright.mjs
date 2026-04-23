import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  page.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 200)));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
  await page.goto('https://theroleroom.com/meta-page-inspector', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    hasInspector: !!document.querySelector('[data-testid="meta-page-inspector-root"]'),
    hasLogin: !!document.querySelector('button[type="submit"], input[type="password"]'),
    h1: Array.from(document.querySelectorAll('h1,h2')).slice(0, 3).map((e) => e.textContent?.slice(0, 60)),
    bodyStart: document.body.innerText.slice(0, 300),
  }));
  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
