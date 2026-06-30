import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-grow-tiktok.html', 'utf8');

const CFG = {
  title: 'TikTok-vekst',
  total: '24 820',
  goal: 'mål 30 000',
  nye: '2 640',
  rate: '+11,9 %',
  months: ['Jan','Feb','Mar','Apr','Mai','Jun'],
  series: [12.4, 14.1, 16.8, 19.3, 22.0, 24.8],
  benchmark: [12.4, 13.9, 15.6, 17.4, 19.1, 20.9],
  chartTitle: 'Følgere siste 6 måneder',
  chartSub: 'jan – jun · i tusen',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-grow-tiktok_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-grow-tiktok_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
