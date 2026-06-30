import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-adv-roas.html', 'utf8');

const CFG = {
  eyebrow: 'Annonseytelse',
  title: 'Avkastning på annonsekroner',
  roas: '6,4',
  goal: '8,0',
  delta: '+38 %',
  returnPerKr: '6,40 kr',
  spend: '42 000 kr',
  revenue: '269 000 kr',
  cpa: '186 kr',
  k1: 'Annonsebruk',
  k2: 'Omsetning',
  k3: 'Kostnad / kjøp',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-roas_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-roas_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
