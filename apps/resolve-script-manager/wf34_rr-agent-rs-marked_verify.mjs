import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf34_rr-agent-rs-marked.html', 'utf8');

const CFG = {
  snitt: '4,1',
  k1: 'Fjordlys Foto & Film',
  r1: '4,6',
  k2: 'Nord Studio Bergen',
  r2: '4,2',
  k3: 'Bryllupsfilm Vestland',
  r3: '3,8',
  partner: 'Blomsterhuset Åsane og Café Brønnøya passer godt for kryssreklame i nærområdet.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<body>', '<body>' + inject);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(200);
await page.locator('#wrap').screenshot({ path: '/tmp/wf34_rr-agent-rs-marked_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(200);
await page.locator('#wrap').screenshot({ path: '/tmp/wf34_rr-agent-rs-marked_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
