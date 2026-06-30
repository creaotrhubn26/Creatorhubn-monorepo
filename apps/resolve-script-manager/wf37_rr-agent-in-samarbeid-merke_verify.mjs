import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-samarbeid-merke.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  cobrandLabel: 'Co-branding-mulighet',
  youRole: 'Din merkevare',
  youName: 'Studio Nord',
  youIcon: 'verified',
  themRole: 'Foreslått merke',
  themName: 'Fjord Apparel',
  themIcon: 'storefront',
  insight: '<b>Fjord Apparel</b> deler 71 % av målgruppen din og åpner for et co-branded merch-slipp. Et felles merke kan løfte begge identitetene før høstkampanjen.',
  tall: '128 000 kr',
  tallLabel: 'Estimert merch-omsetning',
  metricIcon: 'redeem',
  trendTxt: '+ inntekt',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-samarbeid-merke_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-samarbeid-merke_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
