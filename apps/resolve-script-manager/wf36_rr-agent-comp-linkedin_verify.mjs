import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-comp-linkedin.html', 'utf8');

const CFG = {
  eyebrow: 'LinkedIn-konkurranse',
  title: 'Du mot konkurrentene',
  metric: 'Følgere',
  periode: 'Siste 30 dager',
  name0: 'Studio Nord',
  ava0: 'SN',
  name1: 'Lumen Media',
  ava1: 'LM',
  tag1: 'Konkurrent',
  name2: 'Frame Studio',
  ava2: 'FS',
  tag2: 'Konkurrent',
  you: '9 820',
  comp1: '6 940',
  comp2: '4 310',
  verdict: 'Du leder bransjen med <b>+41 % flere følgere</b> enn nærmeste konkurrent på LinkedIn.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-comp-linkedin_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-comp-linkedin_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
