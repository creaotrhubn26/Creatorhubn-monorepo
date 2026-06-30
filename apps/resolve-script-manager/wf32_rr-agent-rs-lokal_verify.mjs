import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-rs-lokal.html', 'utf8');

const CFG = {
  tittel: 'Partnermuligheter i nærområdet',
  omrade: 'Stavanger',
  antall: '3',
  type1: 'Skole', navn1: 'Kannik videregående',
  beskr1: 'Mediefag-linje søker bransjepartner for elevprosjekter og praksis.', match1: '92',
  type2: 'Idrettslag', navn2: 'Viking Fotballklubb',
  beskr2: 'Trenger jevnlig kamp- og høydepunktsinnhold til sosiale kanaler.', match2: '85',
  type3: 'Hotell', navn3: 'Clarion Hotel Energy',
  beskr3: 'Ønsker stemningsfilm til reiseliv- og konferanseprofil på nett.', match3: '78',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-lokal_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-lokal_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
