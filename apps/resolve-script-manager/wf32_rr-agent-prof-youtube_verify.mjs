import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-prof-youtube.html', 'utf8');

const CFG = {
  bio: 'Ny video hver torsdag. Abonnér så du ikke går glipp av neste skytedag bak kamera – og last ned gratis LUT-pakken i beskrivelsen.',
  h1: 'Bryllupsfilm & Behind the Scenes',
  h2: 'Filmskaper fra Oslo · ekte øyeblikk, varmt lys',
  h3: 'Tutorials, kamera-tips og fulle bryllupsfilmer',
  h1tag: 'bryllupsfilm',
  h2tag: 'filmskaper',
  h3tag: 'videografioslo',
  cta: 'Abonnér for nye filmer →',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1600);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-prof-youtube_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-prof-youtube_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
