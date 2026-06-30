import { chromium } from 'playwright';
import fs from 'fs';

const ID = 'rr-ws-meetings';
const htmlPath = `/tmp/wf35_${ID}.html`;
let html = fs.readFileSync(htmlPath, 'utf8');

const CFG = {
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: '',
  dato: '16. juni 2026',
  a1: 'Ingrid Solберg',
  a2: 'Magnus Bjørnæs',
  a3: 'Åse Lønnø',
};
// fix accidental cyrillic
CFG.a1 = 'Ingrid Solberg';

html = html.replace('__CFG__', JSON.stringify(CFG));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);

async function shot(p, file) {
  await page.evaluate((pp) => window.setProgress(pp), p);
  await page.waitForTimeout(400);
  const el = await page.$('#wrap');
  await el.screenshot({ path: file, omitBackground: true });
}

await shot(1, `/tmp/wf35_${ID}_end.png`);
await shot(0.5, `/tmp/wf35_${ID}_mid.png`);

await browser.close();
console.log('done');
