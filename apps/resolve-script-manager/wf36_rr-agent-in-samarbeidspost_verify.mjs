import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-samarbeidspost.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  igTag: 'Collab-innlegg',
  meName: '@bergenfilmstudio',
  partnerName: '@nordlysfoto',
  meIcon: 'movie_creation',
  partnerIcon: 'photo_camera',
  pairSub: 'Delt feed · begge følgerskarer',
  insight: '<b>@nordlysfoto</b> overlapper målgruppen din med 61 %. Et <b>collab-innlegg</b> vises i begge feedene samtidig og kan doble den organiske rekkevidden på lanseringen av høstkampanjen.',
  tall: '38 500',
  tallLabel: 'Anslått rekkevidde',
  metricIcon: 'groups_2',
  trendTxt: '+ rekkevidde',
  cta: 'Utfør',
  ctaIcon: 'bolt'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-samarbeidspost_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-samarbeidspost_mid.png', omitBackground: true });

await browser.close();
console.log('done');
