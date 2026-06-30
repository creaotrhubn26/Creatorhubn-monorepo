import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-rep-aar';
const htmlPath = `/tmp/wf36_${id}.html`;

const CFG = {
  year: '2025',
  eyebrow: 'Årsrapport',
  title: 'Året i tall',
  subtitle: 'Oppsummert av Agenten for <b>@theroleroom</b>',
  heroValue: '2 940 000',
  heroSuffix: 'visninger',
  heroDelta: '+64 %',
  heroCap: 'Totale visninger på tvers av alle kanaler',
  k1: 'Nye følgere',    v1: '34 200',  d1: '+58 %', i1: 'group',
  k2: 'Engasjement',    v2: '486 000', d2: '+41 %', i2: 'favorite_border',
  k3: 'Innlegg publisert', v3: '624',  d3: '52 uker', i3: 'campaign',
  k4: 'Leads generert', v4: '1 870',   d4: '+92 %', i4: 'savings',
  strip: 'Beste måned: <b>november</b> med <b>312&nbsp;000</b> visninger og <b>48</b> nye kunder.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

let html = readFileSync(htmlPath, 'utf8');
html = html.replace('__CFG__', JSON.stringify(CFG));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 900, height: 700 });
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

await browser.close();
console.log('rendered');
