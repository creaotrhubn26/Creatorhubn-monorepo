import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-adv-spend.html', 'utf8');

const CFG = {
  eyebrow: 'Annonseforbruk',
  title: 'Forbruk over tid',
  sub: 'Siste 7 dager · betalt distribusjon',
  platform: 'Instagram-annonser',
  platformColor: '#E1306C',
  totLab: 'Totalt forbruk',
  delta: '+19 %',
  labels: ['Man','Tir','Ons','Tor','Fre','Lør','Søn'],
  values: [3200, 4100, 3600, 5200, 6800, 6100, 7400],
  f1l: 'Snitt/dag', f1v: '5 200 kr',
  f2l: 'Topp-dag',  f2v: 'Søndag',
  f3l: 'Kostnad/klikk', f3v: '4,80 kr',
  accent: '#a78bfa', ink: '#f5f3ff', logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-spend_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-spend_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
