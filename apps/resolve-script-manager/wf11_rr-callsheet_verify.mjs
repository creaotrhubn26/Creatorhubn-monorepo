import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf11_rr-callsheet.html', 'utf8');

const CFG = {
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: '',
  dato: 'Torsdag 18. juni 2026',
  kalltid: '07:30',
  lokasjon: 'Studio B, Nydalen',
  scener: 'Sc 12 – Audition i gangen | Sc 13 – Callback, regirom | Sc 14B – Reaksjon, eksteriør',
  crew: 'Regissør: Mariam Holt | Produsent: Jonas Berg | Foto: Selma Ødegård',
  status: 'Casting pågår'
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// dark video-like backdrop to judge legibility over real footage
await page.setContent(
  '<div style="background:linear-gradient(135deg,#2b2b33,#141418 60%,#0c0c10);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-callsheet_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-callsheet_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
