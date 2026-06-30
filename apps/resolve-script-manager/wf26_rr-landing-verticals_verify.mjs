import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf26_rr-landing-verticals.html', 'utf8');

const CFG = {
  title: 'Bygget for hvordan dere faktisk jobber',
  v1: 'Produksjon-OS', p1: '795 kr/sete',
  v2: 'Innholdsprodusent', p2: '495 kr/sete',
  v3: 'Dans', p3: '149–2 490 kr/mnd',
  v4: 'Talents', p4: 'NY',
  accent: '#a855f7',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf26_rr-landing-verticals_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf26_rr-landing-verticals_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
