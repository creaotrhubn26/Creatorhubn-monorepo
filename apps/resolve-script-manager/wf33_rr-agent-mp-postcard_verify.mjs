import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf33_rr-agent-mp-postcard.html', 'utf8');

const CFG = {
  plattform: 'Instagram',
  caption: 'Bak kulissene fra castingdagen på Grünerløkka. Slik finner vi de riktige ansiktene for kampanjen din – i ett rom, fra idé til ferdig opptak.',
  hashtags: '#casting #theroleroom #filmproduksjon #bakkulissene #norskfilm #oslofilm',
  cta: 'Book en uforpliktende visning',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-postcard_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-postcard_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
