import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-mp-kpitrack';
const htmlPath = `/tmp/wf36_${id}.html`;

const CFG = {
  eyebrow: 'Markedsplan · KPI-sporing',
  title: 'Månedens KPI-mål',
  sub: 'Mål mot faktisk for <b>@theroleroom</b> i juni',
  k1: 'Rekkevidde',        m1: '85000', f1: '92400', u1: '',
  k2: 'Engasjementsrate',  m2: '4.5',   f2: '5.2',   u2: '%',
  k3: 'Nye følgere',       m3: '1200',  f3: '980',   u3: '',
  accent: '#a78bfa', ink: '#f5f3ff', logo: ''
};

let html = readFileSync(htmlPath, 'utf8');
html = html.replace('__CFG__', JSON.stringify(CFG));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 900, height: 760 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

const wrap = await page.$('#wrap');

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(250);
await wrap.screenshot({ path: `/tmp/wf36_${id}_end.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(250);
await wrap.screenshot({ path: `/tmp/wf36_${id}_mid.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('rendered');
