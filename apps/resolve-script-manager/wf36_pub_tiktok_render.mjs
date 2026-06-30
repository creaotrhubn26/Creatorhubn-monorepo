import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-pub-tiktok';
const htmlPath = `/tmp/wf36_${id}.html`;

const CFG = {
  handle: '@theroleroom',
  caption: 'Bak kulissene fra castingdagen på Grünerløkka — slik finner vi de rette ansiktene før innspilling #theroleroom #casting #bakkulissene #skuespiller',
  dur: '0:24',
  tid: 'Tor 19. juni · 17:30',
  visibility: 'Offentlig',
  hashtags: '4 emneknagger',
  sound: 'Originallyd',
  likes: '2 480',
  comments: '186',
  saves: '94',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

let html = readFileSync(htmlPath, 'utf8');
const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 760, height: 560 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

const wrap = await page.$('#wrap');

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(250);
await wrap.screenshot({ path: `/tmp/wf36_${id}_end.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(250);
await wrap.screenshot({ path: `/tmp/wf36_${id}_mid.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('rendered');
