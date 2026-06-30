import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf27_rr-agent-marketing.html', 'utf8');

const CFG = {
  uke: 'Uke 24',
  d1: 'Man', t1: 'Bak kulissene fra castingdagen på Grünerløkka',
  d2: 'Ons', t2: 'Case: hvordan byrået økte bookinger med Role Room',
  d3: 'Fre', t3: 'Reel: danseformasjon i ré-opptak før premiere',
  d4: 'Søn', t4: 'Ukens innsikt + tilbud på sesongpakke',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf27_rr-agent-marketing_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf27_rr-agent-marketing_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
