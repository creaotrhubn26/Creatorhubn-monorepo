import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-rs-kandidater.html', 'utf8');

const CFG = {
  tittel: 'Funne kontoer',
  query: '«Studio Nordlys» film & foto',
  hint: '3 verifiserte treff klare for tilkobling',
  ig_konto: '@studio.nordlys', ig_folgere: '24,8t', ig_status: 'Tilkoblet',
  li_konto: 'Studio Nordlys AS', li_folgere: '3 410', li_status: 'Treff',
  tt_konto: '@studionordlys', tt_folgere: '11,2t', tt_status: 'Vurderes',
  accent: '#a78bfa', ink: '#f5f3ff', logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-kandidater_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-kandidater_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
