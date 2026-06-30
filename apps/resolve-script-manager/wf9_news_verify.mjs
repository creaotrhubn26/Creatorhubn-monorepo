import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf9_news-ticker.html', 'utf8');

const CFG = {
  tag: 'DIREKTE',
  headline: 'Regjeringen legger frem nytt statsbudsjett i dag',
  ticker: 'Børsen stiger 1,4 % etter rentebeslutning · Værvarsel: sol i hele landet · Mer nyheter kl. 21',
  accent: '#c9a24b',
  ink: '#10141c',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 1400, height: 800 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf9_news-ticker_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf9_news-ticker_mid.png', omitBackground: true });

await browser.close();
console.log('done');
