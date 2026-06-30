import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-konkurrent.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  eyebrow: 'AGENT-ANBEFALING',
  head: 'Konkurrent gjorde et nytt trekk',
  sub: '<b>Nordlys Studio</b> la nettopp om strategien sin — jeg fant et tydelig mønster du bør svare på nå.',
  konkurrent: 'Nordlys Studio',
  innsikt: 'De byttet til daglige <span class="comp">bak-kulissene-Reels</span> og tredoblet publiseringen på <span class="comp">Instagram</span> de siste to ukene.',
  tall: '+38%',
  tallLabel: 'økning i engasjement hos dem',
  trendLabel: 'Ny taktikk',
  cta: 'Utfør',
  ctaNote: 'Jeg lager <b>3 motsvar-Reels</b> og en publiseringsplan på 60 sek.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate((cfg) => window.applyConfig(cfg), CFG);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-konkurrent_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-konkurrent_mid.png', omitBackground: true });

await browser.close();
console.log('done');
