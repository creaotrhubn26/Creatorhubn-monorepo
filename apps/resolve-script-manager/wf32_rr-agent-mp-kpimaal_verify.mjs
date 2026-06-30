import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-mp-kpimaal.html', 'utf8');

const CFG = {
  tittel: 'Mål for kvartalet',
  kicker: 'Markedsplan · KPI-mål',
  periode: 'Q2 2026',
  sammendrag: '<b>2 av 3 mål</b> er innen rekkevidde &mdash; følgervekst leder an',
  kpi1_navn: 'Nye følgere',
  kpi1_naa: '2 640',
  kpi1_maal: '2 500',
  kpi1_enhet: '',
  kpi2_navn: 'Kvalifiserte leads',
  kpi2_naa: '96',
  kpi2_maal: '120',
  kpi2_enhet: '',
  kpi3_navn: 'Engasjementsrate',
  kpi3_naa: '5,4',
  kpi3_maal: '6,0',
  kpi3_enhet: '%',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-mp-kpimaal_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-mp-kpimaal_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
