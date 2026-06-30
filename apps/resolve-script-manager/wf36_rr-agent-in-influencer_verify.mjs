import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-influencer.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  platform: 'instagram',
  subjLabel: 'Foreslått influencer',
  subjName: 'Maja Lindqvist',
  subjHandle: '@majacreates',
  subjNiche: 'Mote & livsstil',
  subjIcon: 'person_pin',
  insight: '<b>Maja Lindqvist</b> treffer kjernepublikummet ditt i Oslo og Bergen, og har 3× høyere lagringsrate enn bransjesnittet. Et samarbeid nå kan gi merkevaren din varig rekkevidde før høstsesongen.',
  tall: '78%',
  tallLabel: 'Engasjementsrate',
  metricIcon: 'favorite',
  trendTxt: '+ relevans',
  cta: 'Utfør',
  ctaIcon: 'bolt'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
// Inject CFG inline as well so it is available regardless of init-script timing on setContent
const injected = html.replace('<script>', '<script>window.__CFG__=' + JSON.stringify(CFG) + ';</script>\n<script>');
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-influencer_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-influencer_mid.png', omitBackground: true });

await browser.close();
console.log('done');
