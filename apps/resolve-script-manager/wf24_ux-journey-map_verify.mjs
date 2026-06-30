import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf24_ux-journey-map.html', 'utf8');

const CFG = {
  eyebrow: 'Kundereise',
  title: 'Fra forespørsel til ferdig film',
  f1: 'Oppdager',
  f2: 'Vurderer',
  f3: 'Bestiller',
  f4: 'Opptak',
  f5: 'Anbefaler',
  smerte: 'Uklart tilbud',
  accent: '#6366f1',
  ink: '#1f2d4a',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf24_ux-journey-map_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf24_ux-journey-map_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
