import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-mp-budsjett';
const htmlPath = `/tmp/wf33_${id}.html`;
let html = readFileSync(htmlPath, 'utf8');

const CFG = {
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: '',
  title: 'Markedsføringsbudsjett',
  sub: '30-dagers fordeling foreslått av Agent',
  context: 'Markedsplan',
  total: 48000,
  spent: 18500,
  p1: 'Annonser (Meta + LinkedIn)', b1: 24000,
  p2: 'Innholdsproduksjon', b2: 15000,
  p3: 'Verktøy & lisenser', b3: 9000
};

html = html.replace('__CFG__', JSON.stringify(CFG));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

async function shot(p, suffix) {
  await page.evaluate((pp) => window.setProgress(pp), p);
  await page.waitForTimeout(300);
  const el = await page.$('#wrap');
  await el.screenshot({ path: `/tmp/wf33_${id}_${suffix}.png`, omitBackground: true });
}

await shot(1, 'end');
await shot(0.5, 'mid');
await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
