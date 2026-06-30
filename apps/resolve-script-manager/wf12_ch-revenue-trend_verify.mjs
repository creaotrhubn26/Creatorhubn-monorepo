import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf12_ch-revenue-trend.html', 'utf8');

const CFG = {
  title: 'Omsetning',
  total: '486 200',
  vekst: '+34%',
  m1:'Jan', v1:'52000',
  m2:'Feb', v2:'61000',
  m3:'Mar', v3:'58000',
  m4:'Apr', v4:'74000',
  m5:'Mai', v5:'89000',
  m6:'Jun', v6:'112000',
  accent:'#ffba6c', ink:'#fff5e8', logo:''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf12_ch-revenue-trend_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf12_ch-revenue-trend_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
