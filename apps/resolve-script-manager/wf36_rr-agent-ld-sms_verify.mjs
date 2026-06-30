import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-ld-sms.html', 'utf8');

const CFG = {
  studio: 'Nordlys Studio',
  leadName: 'Kari Nordmann',
  phone: '+47 912 34 567',
  source: 'Instagram-annonse',
  message: 'Hei Kari! Takk for at du tok kontakt om bryllupsfilming på lørdag. Jeg har én ledig dato i juni — vil du ta en kjapp prat? Se pakkene her: nordlys.no/bryllup',
  deliveredLabel: 'Levert',
  timestamp: 'nå',
  speed: '4 sek',
  respPct: 87,
  chip1: 'Fornavn fra lead',
  chip2: 'Bryllupsfilming',
  chip3: 'Beste responstid',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-sms_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-sms_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
