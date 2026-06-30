import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf33_rr-agent-mp-pillar1.html', 'utf8');

const CFG = {
  pillar: 'Bak kulissene',
  andel: '30',
  beskrivelse: 'Vis frem håndverket og menneskene bak produksjonen — fra rigging på lokasjon til klipperommet. Bygger tillit, nærhet og gjør byrået gjenkjennelig for både kunder og talenter.',
  i1: 'Reel fra opptaksdagen med teamet i full aksjon på sett',
  i2: 'Karusell: slik rigger vi lys og kamera før første take',
  i3: 'Story-takeover med fotografen gjennom en hel produksjonsdag',
  frekvens: '2 innlegg / uke',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-pillar1_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-pillar1_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
