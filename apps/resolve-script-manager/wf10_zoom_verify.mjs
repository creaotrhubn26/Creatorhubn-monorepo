import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf10_callout-zoom-box.html', 'utf8');

const CFG = {
  caption: 'Klikk for å publisere',
  accent: '#6366f1',
  ink: '#1f2d4a',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// busy light-website backdrop to judge legibility/contrast
await page.setContent(
  '<div style="background:linear-gradient(120deg,#f4f6fb,#e7ecf5 50%,#dfe9f7);min-height:100vh;background-image:linear-gradient(90deg,rgba(0,0,0,0.04) 1px,transparent 1px),linear-gradient(rgba(0,0,0,0.04) 1px,transparent 1px);background-size:28px 28px">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf10_callout-zoom-box_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf10_callout-zoom-box_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
