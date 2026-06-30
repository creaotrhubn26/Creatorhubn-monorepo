import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf29_rr-agent-research.html', 'utf8');

const CFG = {
  firma: 'Nordlys Bakeri',
  bransje: 'Håndverksbakeri og kafé',
  malgruppe: 'Lokale familier og unge voksne (25–45) i Tromsø som verdsetter kortreist, ekte håndverk og en varm møteplass i hverdagen.',
  tone1: 'Varm',
  tone2: 'Jordnær',
  tone3: 'Fortellende',
  farge: '#C0703A',
  handle: '@nordlysbakeri',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf29_rr-agent-research_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf29_rr-agent-research_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
