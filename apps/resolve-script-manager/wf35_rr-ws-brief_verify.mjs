import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf35_rr-ws-brief.html', 'utf8');

const CFG = {
  prosjekt: 'Vårkampanje – Fjellheim Friluft',
  maal: 'Skape en filmatisk merkevarefortelling som løfter vårkolleksjonen og treffer et yngre, friluftsorientert publikum på sosiale flater.',
  malgruppe: 'Unge voksne 20–35, by, friluftsinteresserte',
  leveranse: 'Hovedfilm 60s + 3 sosiale klipp (9:16) + stillbildeserie',
  tone: 'Varm, filmatisk og ærlig – aldri pågående',
  frist: '14. august 2026',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-brief_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-brief_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
