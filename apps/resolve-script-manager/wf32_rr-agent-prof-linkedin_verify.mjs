import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-prof-linkedin.html', 'utf8');

const CFG = {
  bio: 'Eva Lund · Innholdsprodusent',
  h1: 'Hjelper byråer og merkevarer med film- og innholdsproduksjon i hele Norge.',
  h2: 'Spesialist på visuell historiefortelling – fra idé til ferdig levering.',
  h3: 'Ledig for nye oppdrag fra høsten 2026 – ta gjerne en uforpliktende prat.',
  h1tag: 'Innholdsproduksjon',
  h2tag: 'Visuell historiefortelling',
  h3tag: 'Merkevarefilm',
  cta: 'Ta kontakt for samarbeid →',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-prof-linkedin_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-prof-linkedin_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
