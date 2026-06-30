import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf17_rr-cast-list.html', 'utf8');

const CFG = {
  tittel: 'Hovedrolleliste',
  produksjon: 'Nordlys — sesong 1',
  r1: 'Hovedrolle — Åsne', a1: 'Ingrid Sæther',
  r2: 'Birolle — Håkon', a2: 'Bjørn Aune',
  r3: 'Antagonist — Øyvind', a3: 'Maria Bråthen',
  r4: 'Ung Åsne', a4: 'Tuva Lillebø',
  r5: 'Politietterforsker', a5: 'Jørgen Mæland',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf17_rr-cast-list_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf17_rr-cast-list_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
