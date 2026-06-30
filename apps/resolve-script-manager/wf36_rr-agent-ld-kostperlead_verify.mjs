import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-ld-kostperlead';
const htmlPath = `/tmp/wf36_${id}.html`;
let html = readFileSync(htmlPath, 'utf8');

const CFG = {
  label: 'Snittkostnad denne måneden',
  cpl: '142',
  goal: '120',
  trend: '–18 % mot forrige måned',
  leads: '168',
  spend: '23 900',
  channel: 'Instagram',
  channelCpl: 'kr 118',
  accent: '#a78bfa', ink: '#f5f3ff', logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.load("24px 'Material Icons Outlined'");
  await document.fonts.ready;
});
await page.waitForTimeout(1100);

async function shot(p, suffix) {
  await page.evaluate((pp) => window.setProgress(pp), p);
  await page.waitForTimeout(250);
  const el = await page.$('#wrap');
  await el.screenshot({ path: `/tmp/wf36_${id}_${suffix}.png`, omitBackground: true });
}

await shot(1, 'end');
await shot(0.5, 'mid');
await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
