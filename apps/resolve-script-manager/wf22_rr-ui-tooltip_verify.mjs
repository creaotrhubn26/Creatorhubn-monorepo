import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf22_rr-ui-tooltip.html', 'utf8');

const CFG = {
  tittel: 'Last opp selvtape',
  tekst: 'Dra videofilen hit, så sender vi den direkte til regissøren for gjennomgang og tilbakemelding.',
  hurtigtast: '⌘ + U',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// simulate a dark demo-video behind the overlay to judge legibility
const bg = '<div style="position:fixed;inset:0;background:radial-gradient(120% 120% at 30% 20%,#241636,#0d0915 70%);padding:60px"></div>';
await page.setContent(bg + html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf22_rr-ui-tooltip_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf22_rr-ui-tooltip_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
