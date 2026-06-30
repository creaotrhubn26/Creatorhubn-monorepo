import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf15_rr-equipment.html', 'utf8');

const CFG = {
  tittel: 'Utstyrsliste',
  kamera: 'Sony FX6 (hovedkamera) | Sony A7S III (B-kam) | DJI RS 4 Pro gimbal',
  optikk: 'Sony 24-70mm f/2.8 GM | Sigma 35mm f/1.4 Art | Sony 70-200mm f/2.8',
  lys: 'Aputure 600x Pro | 2x Amaran 100d | Softbox 90cm + grid | Refleksskjerm',
  lyd: 'Sennheiser MKH 416 boom | 2x RØDE Wireless GO II | Zoom F6 opptaker',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf15_rr-equipment_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf15_rr-equipment_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
