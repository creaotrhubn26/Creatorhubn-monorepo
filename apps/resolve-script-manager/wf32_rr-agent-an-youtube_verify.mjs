import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-an-youtube.html', 'utf8');

const CFG = {
  kanal: 'Studio Nordlys',
  handle: '@studionordlys',
  folgere: '128400',
  engasjement: '7.4',
  vekst: '12.6',
  innlegg: '342',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

html = html.replace('__CFG__', JSON.stringify(CFG));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-an-youtube_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-an-youtube_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
