import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf19_ch-ui-stat-pill.html', 'utf8');

const CFG = {
  l1: 'Månedlig omsetning',
  v1: '184 500 kr',
  l2: 'Aktive prosjekter',
  v2: '12',
  l3: 'Kundevurdering',
  v3: '4,9 ★',
  accent: '#ffba6c',
  ink: '#fff5e8',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:linear-gradient(135deg,#141016,#0c0a10 60%,#08070b);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf19_ch-ui-stat-pill_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf19_ch-ui-stat-pill_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
