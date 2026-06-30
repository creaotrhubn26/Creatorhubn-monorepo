import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-reels.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'smart_display',
  head: 'Lag en <em>Reel</em> om dette nå — øyeblikket er ferskt',
  phTag: 'Reel',
  insightLabel: 'Agentens innsikt',
  insightIcon: 'lightbulb',
  insightVal: 'Følgerne dine ser <b>tre ganger lengre</b> på Reels enn på vanlige innlegg. Et bak-kulissene-klipp fra forrige opptak treffer akkurat denne målgruppen.',
  tall: '3,4×', tallLabel: 'mer rekkevidde enn et vanlig innlegg',
  cta: 'Utfør · Lag Reel-utkast',
  foot: 'Du godkjenner før noe publiseres — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-reels_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-reels_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
