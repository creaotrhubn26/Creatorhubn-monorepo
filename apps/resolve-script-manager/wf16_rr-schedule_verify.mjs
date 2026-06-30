import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf16_rr-schedule.html', 'utf8');

const CFG = {
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: '',
  prosjekt: 'Nordlys – kortfilm',
  fase: 'Opptak · 3 dager',
  d1: 'Man. 16. juni', l1: 'Akershus festning, Oslo', t1: '07:00',
  d2: 'Tir. 17. juni', l2: 'Studio Nydalen, Oslo', t2: '08:30',
  d3: 'Ons. 18. juni', l3: 'Sørenga brygge', t3: '06:30'
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:linear-gradient(135deg,#2b2b33,#141418 60%,#0c0c10);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf16_rr-schedule_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf16_rr-schedule_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
