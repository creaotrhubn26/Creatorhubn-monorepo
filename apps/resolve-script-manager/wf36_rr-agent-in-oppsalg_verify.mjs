import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-oppsalg.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  custLabel: 'Eksisterende kunde',
  custName: 'Fjord Næringspark AS',
  custInitials: 'FN',
  custMeta1: 'Kunde i 14 mnd',
  custMeta2: 'Pakke: Vekst',
  loyalVal: 'A+',
  loyalLbl: 'Lojalitet',
  rungNow: 'Vekst',
  rungUp: 'Premium + Annonser',
  insight: '<b>Fjord Næringspark</b> har brukt opp rekkevidden på Vekst-pakken tre måneder på rad og spør stadig etter annonsering. Tidspunktet for et oppsalg er optimalt nå.',
  tall: '48 000 kr',
  tallLabel: 'Ekstra årsverdi',
  metricIcon: 'sell',
  trendTxt: '+ MRR',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-oppsalg_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-oppsalg_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await page.waitForTimeout(80);

await browser.close();
console.log('done');
