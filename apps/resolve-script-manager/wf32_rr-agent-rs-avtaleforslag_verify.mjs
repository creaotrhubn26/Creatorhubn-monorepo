import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-rs-avtaleforslag.html', 'utf8');

const CFG = {
  firma: 'Nordlys Bakeri',
  overskrift: 'Kritiske handlinger denne uka',
  antall: '3 forslag',
  treff: '92',
  handling1: 'Send tilbud til Tromsø Idrettslag',
  prioritet1: 'Kritisk',
  beskrivelse1: 'Varm lead som åpnet siste tre e-poster. Foreslår sponsorpakke for sesongstart før konkurrenten rekker det.',
  effekt1: 'Høy',
  innsats1: '15 min',
  verdi1: '28 000 kr',
  handling2: 'Følg opp ubesvart DM på Instagram',
  prioritet2: 'Høy',
  beskrivelse2: 'En kafégjest spurte om catering for 40 personer. Svar innen 24 t doblet bookingsjansen i forrige kvartal.',
  effekt2: 'Middels',
  innsats2: '5 min',
  verdi2: '9 500 kr',
  handling3: 'Planlegg reels-serie om brøddagen',
  prioritet3: 'Medium',
  beskrivelse3: 'Publikum engasjerer mest med håndverk bak disken. Tre reels nå bygger rekkevidde foran helgesalget.',
  effekt3: 'Middels',
  innsats3: '30 min',
  verdi3: '+3 200',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-avtaleforslag_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-avtaleforslag_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
