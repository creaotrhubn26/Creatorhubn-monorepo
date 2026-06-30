import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf18_ui-button-press.html', 'utf8');

const CFG = {
  label: 'Kom i gang gratis',
  accent: '#6366f1',
  ink: '#1f2d4a',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:linear-gradient(120deg,#f4f6fb,#e7ecf6 55%,#dfe6f3);min-height:100vh;display:flex;align-items:center;padding:60px">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf18_ui-button-press_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf18_ui-button-press_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.68));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf18_ui-button-press_press.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
