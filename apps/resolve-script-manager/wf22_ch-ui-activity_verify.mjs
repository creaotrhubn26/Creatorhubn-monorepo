import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf22_ch-ui-activity.html', 'utf8');

const CFG = {
  a1: '<b>Astrid Bjørnø</b> lastet opp 48 nye bilder',
  t1: 'Nå nettopp',
  a2: '<b>Kunde</b> kommenterte på «Bryllup på Solstrand»',
  t2: '12 min siden',
  a3: '<b>Levering</b> godkjent og publisert',
  t3: '1 time siden',
  a4: '<b>Faktura</b> betalt – 14 500 kr',
  t4: 'I går kl. 16:42',
  accent: '#ffba6c',
  ink: '#fff5e8',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:radial-gradient(120% 120% at 30% 20%,#171210,#06070b 70%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf22_ch-ui-activity_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf22_ch-ui-activity_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
