import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-rep-kampanje.html', 'utf8');

const CFG = {
  label: 'Kampanje-rapport',
  period: '1.–30. juni 2026',
  platforms: '4 plattformer · fullført',
  title: 'Sommerlansering 2026',
  subtitle: 'Resultater før og etter, drevet av Agentens budsjettstyring, målgruppe-innsikt og automatiske oppfølginger.',
  verdict: 'Kampanjen leverte over mål – skalér budsjettet på Instagram og Reels.',
  roas: '4.8',
  c1b: '25 000', c1a: '23 400', c1d: '−6 %',
  c2b: '112 K', c2a: '418 K', c2d: '+273 %',
  c3b: '2 140', c3a: '9 860', c3d: '+361 %',
  c4b: '38', c4a: '214', c4d: '+463 %',
  foot: 'Agenten flyttet <b>4 200 kr</b> fra LinkedIn til Reels midtveis og senket kostnad per lead til <b>109 kr</b> – ned fra 658 kr.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-rep-kampanje_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-rep-kampanje_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
