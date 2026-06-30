import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-rs-handle.html', 'utf8');

const CFG = {
  handle: 'fjordlysfilm',
  avail: 'Ledig på 3 av 4 plattformer',
  reason: 'Kort, søkbart og konsistent med firmanavnet Fjordlys Film — lett å huske, uttale og dele. Samme håndtak på tvers av kanaler gjør merkevaren gjenkjennelig overalt.',
  igStat: 'Ledig',
  ttStat: 'Ledig',
  ytStat: 'Ledig',
  liStat: 'Opptatt',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-handle_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-handle_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
