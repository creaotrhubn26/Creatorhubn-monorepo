import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-eng-svar.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  navn: 'Mariann Eikrem', handle: '@marianneik', kanal: 'Instagram',
  melding: 'Elsker den nye serien deres! Hvordan booker jeg dere til bryllupet vårt i august? 😍',
  svar: 'Så hyggelig, Mariann! Vi har faktisk to ledige helger i august. Jeg sender deg en DM med pakker og priser nå – gleder oss til å høre mer om dagen deres!',
  sentiment: 'Svært positiv', score: 94,
  tag1: 'Kjøpsintensjon', tag2: 'Varm lead', tag3: 'Svar < 5 min'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-svar_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-svar_mid.png', omitBackground: true });

await browser.close();
console.log('done');
