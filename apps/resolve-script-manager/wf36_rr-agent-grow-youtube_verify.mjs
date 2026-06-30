import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-grow-youtube.html', 'utf8');

const CFG = {
  title: 'YouTube-vekst',
  total: '18 460',
  goal: 'mål 25 000',
  nye: '1 920',
  rate: '+11,6 %',
  months: ['Jan','Feb','Mar','Apr','Mai','Jun'],
  series: [9.2, 10.8, 12.7, 14.6, 16.5, 18.5],
  benchmark: [9.2, 10.4, 11.6, 12.9, 14.1, 15.4],
  chartTitle: 'Abonnenter siste 6 måneder',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-grow-youtube_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-grow-youtube_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
