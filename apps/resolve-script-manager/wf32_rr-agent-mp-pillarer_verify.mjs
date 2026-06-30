import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-mp-pillarer.html', 'utf8');

const CFG = {
  eyebrow: 'Markedsplan · Content-pillarer',
  tittel: 'Innholdspillarene dine',
  subtittel: 'Slik fordeler Agenten innholdet på Instagram',
  pillar1Navn: 'Bak kulissene',
  pillar1Desc: 'Råopptak fra sett og kreativ prosess',
  pillar1Ikon: 'movie_creation',
  pillar1Andel: 35,
  pillar2Navn: 'Faglig innsikt',
  pillar2Desc: 'Tips og lærdom som bygger tillit',
  pillar2Ikon: 'lightbulb',
  pillar2Andel: 30,
  pillar3Navn: 'Kundehistorier',
  pillar3Desc: 'Resultater, omtaler og før/etter',
  pillar3Ikon: 'favorite',
  pillar3Andel: 20,
  pillar4Navn: 'Kampanje',
  pillar4Desc: 'Tilbud og tydelig call-to-action',
  pillar4Ikon: 'campaign',
  pillar4Andel: 15,
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-mp-pillarer_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-mp-pillarer_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
