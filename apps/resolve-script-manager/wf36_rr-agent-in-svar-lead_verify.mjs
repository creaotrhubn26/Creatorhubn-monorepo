import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-svar-lead.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  title: 'Varm lead venter på svar',
  head: 'Ny henvendelse på Instagram',
  chip: 'Varm lead',
  sub: 'Sandra Bråthen spurte om <b>pris på bryllupsfilm i august</b> for 17 minutter siden – svar nå for høyest konvertering.',
  tall: '24 500',
  tallLabel: 'Estimert verdi',
  kanal: 'Instagram',
  cta: 'Utfør'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-svar-lead_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-svar-lead_mid.png', omitBackground: true });

await browser.close();
console.log('done');
