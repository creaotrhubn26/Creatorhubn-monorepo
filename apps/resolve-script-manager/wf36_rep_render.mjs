import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-rep-maaned';
const htmlPath = `/tmp/wf36_${id}.html`;

const CFG = {
  kicker: 'Månedsrapport',
  title: 'Din måned i <span class="grad">tall og trend</span>',
  month: 'Mai 2026',
  scorePill: 'Vekst på alle kanaler',
  kpis: [
    { name: 'Visninger',   value: '184 200', unit: '',  delta: '+27 %', dir: 'up',   icon: 'visibility' },
    { name: 'Engasjement', value: '12 480',  unit: '',  delta: '+34 %', dir: 'up',   icon: 'favorite' },
    { name: 'Nye følgere', value: '1 920',   unit: '',  delta: '+18 %', dir: 'up',   icon: 'group_add' },
    { name: 'Leads',       value: '146',     unit: '',  delta: '-4 %',  dir: 'down', icon: 'handshake' }
  ],
  trendLabel: 'Rekkevidde per uke',
  trendSub: 'Topp: <b>uke 24</b>',
  series: [38, 52, 47, 64, 81, 73, 96, 88],
  xlabels: ['U18', 'U19', 'U20', 'U21', 'U22', 'U23', 'U24', 'U25'],
  highlightLabel: 'Månedens høydepunkt',
  highlightBody: 'Reel om bak kulissene fra innspillingen gikk viralt og sto for <b>41 %</b> av månedens totale rekkevidde.',
  highlightStatValue: '74 300',
  highlightStatSuffix: '',
  highlightStatCap: 'Visninger',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

let html = readFileSync(htmlPath, 'utf8');
html = html.replace('__CFG__ || {}', JSON.stringify(CFG) + ' || {}');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 1000, height: 760 });
await page.setContent(html, { waitUntil: 'networkidle' });
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
