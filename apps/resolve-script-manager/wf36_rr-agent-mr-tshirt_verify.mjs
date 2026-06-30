import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-mr-tshirt.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brand: 'Merch-produksjon',
  kode: 'Produktforslag · T-skjorte',
  tittel: 'Premium fan-tee',
  undertekst: 'Agenten har satt opp et merkevare-plagg klart for nettbutikken — design, plassering og pris.',
  ikon: 'checkroom',
  designtittel: 'THE ROLE ROOM',
  designundertekst: 'Behind the scenes',
  designikon: 'auto_awesome',
  plaggfarge: '#fbfaff',
  plaggnavn: 'Hvit · 100% økologisk bomull',
  spesifikasjoner: [
    { ikon: 'palette', k: 'Trykk', v: 'Silketrykk, 2 farger' },
    { ikon: 'straighten', k: 'Størrelser', v: 'XS – 3XL · unisex' },
    { ikon: 'local_shipping', k: 'Levering', v: '5–7 virkedager' }
  ],
  prisetikett: 'Utsalgspris',
  pris: 349,
  forpris: 449,
  valuta: 'kr',
  prisnote: 'Inkl. mva · frakt fra 49 kr',
  margin: 38,
  marginnote: '≈ 133 kr per solgt plagg',
  tips: 'Lanser plagget som limited drop til fansen — knapphet driver 2× høyere konvertering enn åpent lager.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-tshirt_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-tshirt_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
