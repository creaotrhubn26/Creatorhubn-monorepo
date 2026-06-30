import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf29_rr-agent-feed-planner.html', 'utf8');

const CFG = {
  plattform: 'Instagram',
  p1: 'Bak kulissene fra castingdagen på Grünerløkka',
  p2: 'Møt teamet: vår nye regissør deler tre råd før innspilling',
  p3: 'Reel fra danseformasjonen rett før premieren på Sentralen',
  p4: 'Karusell: før og etter fargegrading av sommerkampanjen',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf29_rr-agent-feed-planner_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf29_rr-agent-feed-planner_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
