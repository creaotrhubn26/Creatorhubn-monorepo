import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-in-optimal-frekvens.html', 'utf8');

const CFG = {
  tall: '+27&nbsp;%',
  tallLabel: 'forventet vekst i rekkevidde per måned',
  cta: 'Utfør',
  foer: '3',
  naa: '5',
  enhet: '/uke',
  kicker: 'Innsikt oppdaget',
  tittel: 'Øk til <span class="hi">optimal publiseringsfrekvens</span>',
  hint: 'Agent setter opp ny publiseringsplan',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(200);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-optimal-frekvens_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(200);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-optimal-frekvens_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
