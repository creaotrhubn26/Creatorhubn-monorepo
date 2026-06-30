import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-mp-dashboard';
let html = readFileSync(`/tmp/wf36_${id}.html`, 'utf8');

const CFG = {
  eyebrow: 'Markedsplan · Q3-oppstart',
  title: 'Strategi for <span class="grad">juni måned</span>',
  period: '1.–30. juni 2026',
  goal: 'Mål: 2 000 nye følgere',
  k0: 'Rekkevidde',  v0: '324 000', s0: '',  d0: '+24 %',
  k1: 'Engasjement', v1: '6,4',     s1: '%', d1: '+1,8 pp',
  k2: 'Nye følgere', v2: '2 040',   s2: '',  d2: '+31 %',
  k3: 'Leads',       v3: '184',     s3: '',  d3: '+22 %',
  pillarsLabel: 'Innholdspillarer',
  pillars: [
    { name: 'Bak kulissene',     pct: 35, icon: 'movie' },
    { name: 'Kundehistorier',    pct: 25, icon: 'record_voice_over' },
    { name: 'Fagtips & innsikt', pct: 25, icon: 'lightbulb' },
    { name: 'Tilbud & kampanje', pct: 15, icon: 'campaign' }
  ],
  calLabel: 'Publiseringskalender',
  calStartDay: 1,
  schedule: {
    '1': ['instagram'], '2': ['linkedin'], '4': ['instagram', 'facebook'],
    '6': ['tiktok'], '8': ['instagram'], '9': ['youtube'], '11': ['linkedin'],
    '13': ['instagram', 'tiktok'], '15': ['facebook'], '16': ['instagram'],
    '18': ['linkedin', 'youtube'], '20': ['instagram'], '22': ['tiktok'],
    '23': ['instagram', 'facebook'], '25': ['linkedin'], '27': ['instagram', 'youtube']
  },
  legend: ['instagram', 'linkedin', 'facebook', 'tiktok', 'youtube'],
  calFoot: '<b>18 innlegg</b> planlagt denne måneden · beste tid <b>kl. 19</b>',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

html = html.replace('__CFG__ || {}', JSON.stringify(CFG) + ' || {}');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

const wrap = page.locator('#wrap');

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(250);
await wrap.screenshot({ path: `/tmp/wf36_${id}_end.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(250);
await wrap.screenshot({ path: `/tmp/wf36_${id}_mid.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
