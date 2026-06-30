import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-in-lookalike.html', 'utf8');

const CFG = {
  innsikt: 'Lag en <b>lookalike-målgruppe</b> fra dine 50 beste kunder og nå nye profiler som ligner dem.',
  inslabel: 'Voks målgruppen din',
  tall: '184 000',
  tallLabel: 'Estimert ny rekkevidde i Norge',
  kilde: '<b>1 %-lookalike</b> · basert på 50 kjernekunder',
  match: '87 % match-kvalitet',
  cta: 'Utfør anbefaling',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-lookalike_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-lookalike_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
