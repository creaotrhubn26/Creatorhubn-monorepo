import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-rs-bransje.html', 'utf8');

const CFG = {
  firma: 'Fjordlys Studio AS',
  orgnr: '923 884 102',
  sted: 'Bergen',
  bransje: 'Produksjon av film, video og fjernsynsprogram',
  nace: '59.110',
  pos: 'Spesialisert produksjonshus for nordiske livsstils- og reiselivsmerker — kjent for kinematisk håndverk og rask leveranse på sosiale flater.',
  kw1: 'Innholdsproduksjon',
  kw2: 'Merkevarefilm',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-bransje_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-bransje_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
