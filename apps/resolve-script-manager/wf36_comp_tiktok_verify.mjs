import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-comp-tiktok';
const htmlPath = `/tmp/wf36_${id}.html`;

const CFG = {
  eyebrow: 'TikTok-konkurranse',
  title: 'Du mot konkurrentene',
  metric: 'Visninger',
  periode: 'Siste 30 dager',
  name0: '@studio.nord',
  name1: '@lumen.media',
  name2: '@frame.studio',
  ava0: 'SN', ava1: 'LM', ava2: 'FS',
  you: 412800, comp1: 271500, comp2: 158400,
  verdict: 'Du leder feltet med <b>+52 % flere visninger</b> enn nærmeste konkurrent.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

let html = readFileSync(htmlPath, 'utf8');
const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 900, height: 700 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

const wrap = await page.$('#wrap');

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(250);
await wrap.screenshot({ path: `/tmp/wf36_${id}_end.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(250);
await wrap.screenshot({ path: `/tmp/wf36_${id}_mid.png`, omitBackground: true });

await browser.close();
console.log('rendered');
