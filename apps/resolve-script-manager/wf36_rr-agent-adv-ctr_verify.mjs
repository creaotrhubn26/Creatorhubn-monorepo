import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-adv-ctr.html', 'utf8');

const CFG = {
  section: 'Klikkrate · siste 30 dager',
  visninger: '48 200',
  klikk: '1 010',
  ctr: '2,1',
  delta: '0,6',
  igCtr: '2,1',
  ttCtr: '2,8',
  fbCtr: '1,4',
  liCtr: '0,9',
  insight: 'Agenten flyttet 30 % av budsjettet til <b>TikTok</b> — høyest klikkrate ga 1,8× flere profilbesøk.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-ctr_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-ctr_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
