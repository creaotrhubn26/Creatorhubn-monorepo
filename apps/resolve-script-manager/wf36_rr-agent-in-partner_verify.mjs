import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-partner.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  partnerLabel: 'Foreslått samarbeidspartner',
  partnerName: 'Nordisk Filmfestival',
  partnerIcon: 'diversity_3',
  partnerMeta1: 'Kultur & arrangement',
  partnerMeta2: 'Oslo',
  matchVal: '94%',
  matchLbl: 'Match',
  insight: '<b>Nordisk Filmfestival</b> deler 68 % av målgruppen din og leter etter kreative innholdspartnere før høstsesongen. Et samarbeid kan løfte rekkevidden din betraktelig.',
  tall: '42 800',
  tallLabel: 'Felles målgruppe',
  metricIcon: 'groups',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-partner_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-partner_mid.png', omitBackground: true });

await browser.close();
console.log('done');
