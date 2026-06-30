import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf33_rr-agent-mp-goals.html', 'utf8');

const CFG = {
  maal: 'Etablere The Role Room som førstevalget for film- og innholdsproduksjon i Norge',
  d1: 'Øke kvalifiserte byrå-henvendelser med <b>30 %</b>',
  d2: 'Publisere <b>12 case-historier</b> fra ekte produksjoner',
  d3: 'Bygge <b>500 nye følgere</b> på tvers av plattformene',
  tema: 'Bak kulissene på settet',
  malgruppe: 'Reklamebyråer & produsenter',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-goals_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-goals_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
