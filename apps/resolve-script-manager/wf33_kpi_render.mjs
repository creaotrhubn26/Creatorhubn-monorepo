import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-mp-kpitrack';
const htmlPath = `/tmp/wf33_${id}.html`;
let html = readFileSync(htmlPath, 'utf8');

const CFG = {
  k1: 'Rekkevidde', m1: '85000', f1: '92400', u1: '',
  k2: 'Engasjementsrate', m2: '4.5', f2: '5.2', u2: '%',
  k3: 'Nye følgere', m3: '1200', f3: '980', u3: '',
  accent: '#a78bfa', ink: '#f5f3ff', logo: ''
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
