import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-dsc-embed.html', 'utf8');

const CFG = {
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: '',
  platName: 'Instagram',
  handle: '@roleroom.studio',
  kind: 'Reel',
  posted: 'Reel · 2 t siden',
  likes: '2 418',
  comments: '137',
  caption: 'Bak kulissene fra helgens innspilling i Bergen — full pakke levert på 48 timer.',
  url: 'theroleroom.com/p/aBc12X'
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-embed_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-embed_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
