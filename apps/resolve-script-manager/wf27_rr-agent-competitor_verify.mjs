import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf27_rr-agent-competitor.html', 'utf8');

const CFG = {
  title: 'Konkurransebildet for film- og innholdsproduksjon',
  k1: 'Backstage / Casting Networks', p1: 'Stor, men kun casting — fragmentert flyt',
  k2: 'Generelle prosjektverktøy', p2: 'Notion & Trello — ikke laget for produksjon',
  k3: 'Regneark, e-post & DM-er', p3: 'Status quo hos de fleste byråer',
  konklusjon: 'Konkurrenten er fragmenteringen — ikke ett produkt, men seks løse verktøy.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>\n`;
html = html.replace('<script>\n(function () {', inject + '<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf27_rr-agent-competitor_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf27_rr-agent-competitor_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
