import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf10_callout-arrow.html', 'utf8');

const CFG = {
  label: 'Start nytt prosjekt',
  sub: 'Klikk her for å opprette en ny casting fra bunnen av',
  accent: '#6366f1',
  ink: '#1f2d4a',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// simulate a real product website behind the overlay to judge legibility
await page.setContent(
  '<div style="background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 50%,#ffffff 100%);min-height:100vh;padding:40px">' +
  '<div style="height:80px;background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.06);margin-bottom:24px"></div>' +
  '<div style="display:flex;gap:16px"><div style="flex:1;height:300px;background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.06)"></div>' +
  '<div style="width:280px;height:300px;background:#1e293b;border-radius:14px"></div></div>' +
  html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf10_callout-arrow_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf10_callout-arrow_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
