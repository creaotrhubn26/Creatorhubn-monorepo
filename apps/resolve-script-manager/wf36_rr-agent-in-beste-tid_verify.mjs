import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-in-beste-tid.html', 'utf8');

const CFG = {
  tall: '+38&nbsp;%',
  tallLabel: 'høyere rekkevidde i nytt tidsvindu',
  cta: 'Utfør',
  foer: '12:00',
  naa: '19:30',
  tittel: 'Optimal <span class="hi">publiseringstid</span> har endret seg',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-beste-tid_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(200);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-beste-tid_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
