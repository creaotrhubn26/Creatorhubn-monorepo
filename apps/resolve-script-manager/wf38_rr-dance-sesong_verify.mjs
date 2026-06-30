import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf38_rr-dance-sesong.html', 'utf8');

const CFG = {
  sesong: 'Sesong 2026 — Røtter & Røster',
  undertittel: 'Helårsplan for kompani og elevgrupper',
  m1: 'Sesongstart & opptak', d1: '2. september',
  m2: 'Vinterforestilling — Stjernedryss', d2: '14. desember',
  m3: 'Turné Vestlandet', d3: 'Februar',
  m4: 'Skuda-konkurranse', d4: '11. april',
  m5: 'Premiere Hovedscenen', d5: '7. juni',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-dance-sesong_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-dance-sesong_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
