import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-trend.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  head: 'En <em>trend du bør hoppe på</em> — før vinduet lukkes',
  chips: [
    { p: 'tiktok', label: 'Lydtrend: «stille øyeblikk»', heat: 'Glohet' },
    { p: 'instagram', label: 'Reels-format', heat: 'Stigende' }
  ],
  insightLabel: 'Hvorfor akkurat nå',
  insightIcon: 'trending_up',
  insightVal: 'Lydsporet vokser <b>raskt i din nisje</b> — bransjen din er knapt på det ennå, så du rekker å bli tidlig ute',
  recoIcon: 'whatshot',
  tall: '+212 %', tallLabel: 'vekst i trenden siste 7 dager',
  cta: 'Utfør · Lag innlegg på trenden',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-trend_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-trend_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
