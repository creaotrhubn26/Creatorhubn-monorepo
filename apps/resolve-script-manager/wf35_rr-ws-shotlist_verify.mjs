import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf35_rr-ws-shotlist.html', 'utf8');

const CFG = {
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: '',
  scene: 'Scene 12 — Audition i gangen',
  s1: 'Vidvinkel — etablering av rommet',
  d1: 'Statisk | 24mm',
  s2: 'Halvtotal — to skuespillere på gulvet',
  d2: 'Dolly inn | 35mm',
  s3: 'Nær — reaksjon på replikk',
  d3: 'Håndholdt | 85mm',
  s4: 'Insert — manus i hånd',
  d4: 'Macro | 100mm'
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:linear-gradient(135deg,#2b2b33,#141418 60%,#0c0c10);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-shotlist_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-shotlist_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
