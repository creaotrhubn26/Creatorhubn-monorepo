import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf25_rr-project-brief.html', 'utf8');

const CFG = {
  prosjekt: 'Vårkampanje – Fjellheim',
  maal: 'Skape en filmatisk merkevarefortelling som løfter høstkolleksjonen og treffer et yngre publikum.',
  leveranse: 'Hovedfilm 60s + 3 sosiale klipp (9:16) + stillbildeserie',
  frist: '14. august 2026',
  budsjett: '480 000 kr',
  ansvarlig: 'Ingrid Bjørnå',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf25_rr-project-brief_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf25_rr-project-brief_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
