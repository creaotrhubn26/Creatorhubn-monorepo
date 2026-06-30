import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf10_callout-tooltip.html', 'utf8');

const CFG = {
  title: 'Eksporter prosjektet ditt',
  desc: 'Klikk her for å rendre i 4K og dele filmen direkte til klienten.',
  accent: '#6366f1',
  ink: '#1f2d4a',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// simulate a real product website behind the overlay to judge legibility/contrast
const bg = '<div style="position:fixed;inset:0;background:linear-gradient(135deg,#eef2f7,#dde7f2 45%,#cfd9e8);padding:40px;font-family:sans-serif">'
  + '<div style="height:60px;background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.06);margin-bottom:24px"></div>'
  + '<div style="display:flex;gap:20px"><div style="flex:2;height:380px;background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.06)"></div>'
  + '<div style="flex:1;height:380px;background:#4338ca;border-radius:12px"></div></div></div>';
await page.setContent(bg + html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf10_callout-tooltip_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf10_callout-tooltip_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
