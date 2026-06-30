import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-mr-dtg.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brand: 'Merch-produksjon',
  kode: 'Trykketeknikk · DTG',
  tittel: 'Direct-to-Garment',
  undertekst: 'Digitalt fototrykk rett på stoffet — best for fargerike motiver i små opplag og print-on-demand.',
  ikon: 'print',
  metrics: [
    { k: 'Minste opplag', target: 1, unit: 'stk', note: 'Ingen oppstartskostnad' },
    { k: 'Farger', target: 16, unit: '+ mill.', note: 'Full fotokvalitet' },
    { k: 'Leveringstid', target: 4, unit: 'dager', note: 'Produksjon på forespørsel' }
  ],
  farger: [
    { nm: 'Scene-lilla', hex: '#a855f7' },
    { nm: 'Magenta', hex: '#d946ef' },
    { nm: 'Dyp natt', hex: '#100923' },
    { nm: 'Pergament', hex: '#f5f3ff' }
  ],
  sjekkliste: [
    'Last opp motiv i <b>300 DPI PNG</b> med gjennomsiktig bakgrunn',
    'Hold trykkflaten innenfor <b>30 × 40 cm</b> A3-rammen',
    'Velg <b>lyst bomullsplagg</b> for skarpeste fargegjengivelse'
  ],
  tips: 'DTG gir skarpe foto-detaljer på lyse bomullsplagg. For store opplag eller mørke tekstiler anbefaler vi heller silketrykk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-dtg_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-dtg_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
