import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-rs-malgruppe.html', 'utf8');

const CFG = {
  navn: 'Ingrid Solheim',
  alder: '31 år',
  sted: 'Bergen',
  rolle: 'Småbarnsmor & lærer',
  int1: 'Velvære',
  int2: 'Kortreist mat',
  int3: 'Friluftsliv',
  int4: 'Kafékultur',
  k1n: 'Instagram',
  k1v: 88,
  k2n: 'TikTok',
  k2v: 71,
  k3n: 'Facebook',
  k3v: 46,
  innsikt: 'Reels og kortform-video tidlig kveld treffer best. Snakk hverdag, varme og ekte håndverk — unngå polert reklame.',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-malgruppe_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-malgruppe_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
