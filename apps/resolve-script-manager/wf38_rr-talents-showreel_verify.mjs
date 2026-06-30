import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf38_rr-talents-showreel.html', 'utf8');

const CFG = {
  navn: 'Ingrid Bjørnøy',
  agentur: 'Nord Talent Agentur',
  visninger: 2847,
  k1: 'Drama | Konfrontasjon ved kjøkkenbordet | 0:42',
  k2: 'Komedie | Lett dialog på fortauskafé | 0:28',
  k3: 'Spenning | Monolog i øsende regn | 0:35',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-talents-showreel_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-talents-showreel_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
