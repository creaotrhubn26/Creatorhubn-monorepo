import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-tone-juster.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  eyebrow: 'Agent-anbefaling',
  insight: 'Juster <span class="grad">tonen</span> for målgruppen din',
  reason: 'Innholdet ditt er mer formelt enn publikummet som faktisk engasjerer seg. En varmere, mer personlig tone treffer 18–34-segmentet ditt langt bedre — uten å miste profesjonaliteten.',
  recoIcon: 'tune',
  slabel: 'Tone-avvik',
  tall: '63',
  tallSuffiks: '%',
  tallLabel: 'av målgruppen foretrekker en varmere tone',
  toneNow: 'I dag',
  toneRec: 'Anbefalt',
  toneNowPct: 78,
  toneRecPct: 42,
  arrowTxt: 'Senk formaliteten 36 poeng',
  cta: 'Utfør · Juster tonen',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-tone-juster_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-tone-juster_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
