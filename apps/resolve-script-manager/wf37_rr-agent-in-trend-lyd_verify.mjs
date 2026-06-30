import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-trend-lyd.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'graphic_eq',
  head: 'En <em>lyd trender akkurat nå</em> — bruk den før vinduet lukkes',
  trackName: '«Stille øyeblikk» — Original lyd',
  trackSub: '<b>TikTok</b> · brukt i 48 200 reels · matcher din nisje',
  insightLabel: 'Hvorfor akkurat nå',
  insightIcon: 'trending_up',
  insightVal: 'Lyden vokser <b>raskt i din nisje</b> — bransjen din er knapt på den ennå, så du rekker å bli tidlig ute',
  tall: '+212 %', tallLabel: 'vekst i bruk siste 7 dager',
  cta: 'Utfør · Lag innlegg med lyden',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-trend-lyd_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-trend-lyd_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
