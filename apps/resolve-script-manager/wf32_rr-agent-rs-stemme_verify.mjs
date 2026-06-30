import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-rs-stemme.html', 'utf8');

const CFG = {
  brand: 'Fjordlys Studio',
  aud: 'Instagram og LinkedIn',
  t1: 'Varm',
  t2: 'Trygg',
  t3: 'Leken',
  do: 'Snakk direkte til kunden og bruk konkrete eksempler fra ekte produksjoner.',
  dont: 'Stivt fagspråk, tomme superlativer og klisjéer som «vi leverer kvalitet».',
  ex: 'Vi gjør historien deres til film folk husker — varmt, ekte og uten omveier.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.load('16px "Material Icons Outlined"');
  await document.fonts.ready;
});
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-stemme_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-stemme_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
