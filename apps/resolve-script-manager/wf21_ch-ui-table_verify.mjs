import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf21_ch-ui-table.html', 'utf8');

const CFG = {
  c1: 'Kunde',
  c2: 'Prosjekt',
  c3: 'Beløp',
  r1a: 'Solstrand Hotell', r1b: 'Bryllupsfilm + foto', r1c: '42 500 kr',
  r2a: 'Bergen Kommune',   r2b: 'Omdømmevideo',        r2c: '78 000 kr',
  r3a: 'Nøtterøy Idrett',  r3b: 'Høydepunktsklipp',    r3c: '19 900 kr',
  r4a: 'Æra Studio',       r4b: 'Merkevareløft',       r4c: '64 250 kr',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf21_ch-ui-table_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf21_ch-ui-table_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
