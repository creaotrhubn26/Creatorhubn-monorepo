import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf38_rr-talents-soknad.html', 'utf8');

const CFG = {
  rolle: 'Maria — kvinnelig birolle',
  produksjon: '«Når snøen smelter» · Dramaserie · NRK',
  status: 'Shortlist',
  agentur: 'Nord Talent Agentur',
  talent: 'Ingrid Bjørnøy',
  dato: '12. juni 2026',
  appId: 'SØK-2026-0148',
  takes: '3 takes · 00:47 · showreel-lenke',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-talents-soknad_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-talents-soknad_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
