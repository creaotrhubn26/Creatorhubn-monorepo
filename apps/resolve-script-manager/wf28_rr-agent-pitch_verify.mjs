import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf28_rr-agent-pitch.html', 'utf8');

const CFG = {
  prosjekt: 'Nordvest Casting',
  posisjonering: 'Vi samler casting, dans og produksjon i ett rom — fra første idé til ferdig sett, uten å bytte verktøy.',
  b1: 'Hele produksjonsflyten i én flate — slutt på fire spredte verktøy.',
  b2: 'Auto-oppfølging av leads via SMS, e-post og selger-varsel innen minutter.',
  b3: 'Målbar ROAS, CTR og lead-scoring på hver eneste kampanje.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf28_rr-agent-pitch_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf28_rr-agent-pitch_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
