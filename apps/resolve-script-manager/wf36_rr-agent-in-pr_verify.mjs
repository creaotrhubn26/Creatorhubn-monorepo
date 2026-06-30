import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-pr.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  subjLabel: 'Journalist å kontakte',
  subjName: 'Ingrid Solheim',
  subjOutlet: 'Kampanje',
  subjBeat: 'Kultur & kreativ næring',
  subjIcon: 'newspaper',
  angle: '«Slik bruker norske produsenter AI i kreativt arbeid»',
  insight: '<b>Ingrid Solheim</b> i Kampanje skrev nylig om AI i mediebransjen og svarer ofte på pitcher om kreativ teknologi. Vinkelen din passer redaksjonen perfekt akkurat nå.',
  tall: '180 000',
  tallLabel: 'Potensiell rekkevidde',
  metricIcon: 'visibility',
  trendTxt: '+ omtale',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-pr_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-pr_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
