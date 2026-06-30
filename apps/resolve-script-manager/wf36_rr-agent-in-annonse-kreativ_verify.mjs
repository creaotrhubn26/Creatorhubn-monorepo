import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-annonse-kreativ.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Agent',
  eyebrow: 'Agent-anbefaling',
  insight: 'Annonsen din er sliten — <span class="grad">test en ny kreativ nå</span>',
  reason: 'Den aktive annonse-kreativen har vært i lufta i 18 dager, og frekvensen har passert 3,4. Jeg har en frisk variant klar med sterkere åpningsbilde og tydeligere CTA — la oss teste den mot den nåværende.',
  tall: '34', tallSuffiks: '%',
  tallLabel: 'Forventet løft i klikkrate',
  statIkon: 'ads_click',
  trend: 'Anbefalt',
  cta: 'Utfør',
  skip: 'Eller forhåndsvis varianten først'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-annonse-kreativ_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-annonse-kreativ_mid.png', omitBackground: true });

await browser.close();
console.log('done');
