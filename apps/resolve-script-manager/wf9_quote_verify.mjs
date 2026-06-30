import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf9_quote-lower-third.html', 'utf8');

const CFG = {
  quote: 'Vi lager ikke filmer for å flykte fra virkeligheten — vi lager dem for å forstå den.',
  attribution: 'Astrid Lindholm, Regissør',
  accent: '#c9a24b',
  ink: '#10141c',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// dark cinematic backdrop to judge contrast/legibility
await page.setContent(
  '<div style="background:linear-gradient(120deg,#11151d,#1c2430 60%,#0a0d14);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf9_quote-lower-third_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf9_quote-lower-third_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
