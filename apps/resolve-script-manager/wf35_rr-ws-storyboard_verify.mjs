import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf35_rr-ws-storyboard.html', 'utf8');

const CFG = {
  scene: '14',
  s1: '14A', k1: 'Vidvinkel: kafélokalet i myk morgensol, gjestene strømmer inn.',
  s2: '14B', k2: 'Nærbilde: baristaens hånd løfter den dampende koppen over disken.',
  s3: '14C', k3: 'Over skulder: blikket møter den nye gjesten ved vinduet.',
  s4: '14D', k4: 'Tracking: paret går side om side mot havnekanten i motlys.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-storyboard_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-storyboard_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
