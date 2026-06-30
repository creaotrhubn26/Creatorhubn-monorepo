import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-eng-omtale.html', 'utf8');

const CFG = {
  side: 'studionordfilm',
  plat: 'instagram',
  from: 'Marte Lund',
  handle: '@marte.lund',
  action: 'tagget deg i en story',
  mention: 'Helt magisk bryllupsfilm fra gjengen hos ',
  mhandle: '@studionordfilm',
  mention2: ' — beste valget vi kunne tatt for bryllupet vårt!',
  status: 'Besvart',
  likes: 248,
  reach: 3120,
  time: '12 min siden',
  aimsg: 'Tusen takk, Marte! Det varmer å høre — vi gleder oss til neste prosjekt sammen.',
  verified: true,
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-omtale_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-omtale_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
