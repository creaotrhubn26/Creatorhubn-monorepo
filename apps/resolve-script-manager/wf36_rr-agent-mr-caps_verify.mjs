import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-mr-caps.html', 'utf8');

const CFG = {
  kicker: 'Merch · Mockup',
  title: 'Brodert caps med <span class="grad">teamets logo</span>',
  l0: 'Produkt', v0: 'Strukturert 6-panel caps',
  l1: 'Trykk',   v1: 'Brodert logo, 3 farger',
  l2: 'Farge',   v2: 'Mørk lilla / svart',
  l3: 'Opplag',  v3: '50 stk · klar til sett',
  priceLabel: 'Stykkpris fra',
  price: '249',
  priceUnit: 'kr',
  note: 'Klar til <b>premiere</b> og crew — Agenten genererte mockup og ordreutkast',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-caps_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-caps_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
