import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf11_rr-talent-spotlight.html', 'utf8');

const CFG = {
  navn: 'Maja Lindqvist',
  rolle: 'Hovedrolle — «Nordlys»',
  stat1: '24', stat1Label: 'Auditions',
  stat2: '9',  stat2Label: 'Callbacks',
  stat3: '6',  stat3Label: 'Prosjekter',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// simulate video frame behind overlay to judge legibility
await page.setContent(
  '<div style="background:linear-gradient(120deg,#1b1b22,#2a2336 55%,#3a2d4d);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-talent-spotlight_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-talent-spotlight_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
