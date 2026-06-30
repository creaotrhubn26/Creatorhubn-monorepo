import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf10_callout-tooltip.html', 'utf8');
const CFG = { title: 'Eksporter prosjektet ditt', desc: 'Klikk her for å rendre i 4K og dele filmen direkte til klienten.', accent: '#6366f1', ink: '#1f2d4a', logo: '' };
const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent('<div style="background:#e8edf4;min-height:100vh">' + html + '</div>', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
for (const p of [0.10, 0.30, 0.70]) {
  await page.evaluate((v) => window.setProgress(v), p);
  await page.waitForTimeout(120);
  await page.locator('#wrap').screenshot({ path: `/tmp/wf10_callout-tooltip_p${Math.round(p*100)}.png`, omitBackground: true });
}
await browser.close();
console.log('done');
