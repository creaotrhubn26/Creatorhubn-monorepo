import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-adv-konvertering';
let html = readFileSync(`/tmp/wf36_${id}.html`, 'utf8');

const CFG = {
  eyebrow: 'Annonseytelse',
  title: 'Konverteringer denne måneden',
  platform: 'Instagram',
  conversions: '184',
  cpa: '228',
  cpaUnit: 'kr',
  convDelta: '+41 %',
  cpaDelta: '−17 %',
  impressions: '92 400',
  clicks: '6 180',
  funnelCap: 'Konverteringstrakt',
  f0lbl: 'Visninger',
  f1lbl: 'Klikk',
  f2lbl: 'Konverteringer',
  spend: '42 000 kr',
  convRate: '2,98 %',
  revenue: '318 000 kr',
  k1: 'Annonsebruk',
  k2: 'Konv.rate',
  k3: 'Omsetning',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.load("24px 'Material Icons Outlined'");
  await document.fonts.ready;
});
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(200);
await page.locator('#wrap').screenshot({ path: `/tmp/wf36_${id}_end.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(200);
await page.locator('#wrap').screenshot({ path: `/tmp/wf36_${id}_mid.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
