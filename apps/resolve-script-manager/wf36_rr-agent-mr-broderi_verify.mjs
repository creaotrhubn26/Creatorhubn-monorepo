import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-mr-broderi.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  eyebrow: 'Teknikk-kort',
  title: 'Broderi & detaljer',
  techName: 'Plattsøm',
  techSub: 'Tett, glansfull fyllsting som dekker flaten helt — perfekt for blomster og blader.',
  diffLabel: 'Middels',
  diffLevel: 3,
  diffMax: 5,
  specs: [
    { label: 'Garn', value: '6 tråder', icon: 'texture' },
    { label: 'Nål', value: 'Str. 7', icon: 'straighten' },
    { label: 'Tid', value: '~45 min', icon: 'schedule' }
  ],
  steps: [
    { html: 'Tegn opp <b>motivet</b> på stoffet' },
    { html: 'Legg <b>parallelle sting</b> tett inntil hverandre' },
    { html: 'Hold <b>jevn spenning</b> for blank overflate' },
    { html: 'Fest tråden bak og <b>klipp rent</b>' }
  ],
  footTxt: 'Agent foreslår å filme <b>nærbilde av stingene</b> for en mettende detalj-reel.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-broderi_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-broderi_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
