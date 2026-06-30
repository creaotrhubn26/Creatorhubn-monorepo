import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf23_ch-audio-review.html', 'utf8');

const CFG = {
  projekt: 'Nordlys (Single)',
  artist: 'Maja Solheim & Bånd',
  versjon: 'v2.0',
  bpm: '124',
  toneart: 'A-moll',
  specs: '48 kHz · 24-bit',
  kommentarer: '14',
  accent: '#ffba6c',
  ink: '#fff5e8',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf23_ch-audio-review_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf23_ch-audio-review_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
