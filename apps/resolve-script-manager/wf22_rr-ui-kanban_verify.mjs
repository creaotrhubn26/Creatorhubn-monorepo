import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf22_rr-ui-kanban.html', 'utf8');

const CFG = {
  kolonne: 'Til vurdering',
  k1: 'Finn skuespiller til hovedrollen|Casting|MJ',
  k2: 'Send tilbakemelding på selvtape-opptak|Gjennomgang|SÅ',
  k3: 'Bekreft innspillingsdager i mars|Planlegging|TØ',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// dark demo backdrop to judge legibility of a dark overlay
await page.setContent(
  '<div style="background:radial-gradient(circle at 30% 20%,#231435 0%,#0d0816 60%,#070410 100%);min-height:100vh;padding:30px"></div>' +
  html,
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf22_rr-ui-kanban_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf22_rr-ui-kanban_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
