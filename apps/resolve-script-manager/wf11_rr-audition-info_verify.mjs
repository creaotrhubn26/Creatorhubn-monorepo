import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf11_rr-audition-info.html', 'utf8');

const CFG = {
  rolle: 'Hovedrolle — Astrid Berg',
  dato: 'Torsdag 26. juni 2026',
  tid: '14:30',
  lokasjon: 'Studio B, Nydalen, Oslo',
  forbered: 'Lær scene 12 utenat. Ta med headshot og oppdatert CV. Vær klar 15 min før kalltid.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// simulate video frame behind transparent overlay
await page.setContent(
  '<div style="background:linear-gradient(120deg,#1c1c22,#2a2230 55%,#0e0e16);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-audition-info_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-audition-info_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
