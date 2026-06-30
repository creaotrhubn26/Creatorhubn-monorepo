import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf19_ch-ui-avatar-chip.html', 'utf8');

const CFG = {
  navn: 'Åse Bjørnådal',
  rolle: 'Produsent, Nordlys Studio',
  accent: '#ffba6c',
  ink: '#fff5e8',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:linear-gradient(120deg,#181410,#241b12 55%,#0c0a08);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf19_ch-ui-avatar-chip_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf19_ch-ui-avatar-chip_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
