import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-adv-attribusjon.html', 'utf8');

const CFG = {
  eyebrow: 'Attribusjon',
  title: 'Reisen til konvertering',
  subtitle: 'Modell: <b>datadrevet</b> &middot; berøringspunkt &rarr; kjøp',
  creditHead: 'Tilskrevet kreditt per kanal',
  path: ['Instagram', 'TikTok', 'Facebook', 'Kjøp'],
  channels: [
    { label: 'Instagram', value: 46 },
    { label: 'TikTok', value: 32 },
    { label: 'Facebook', value: 22 }
  ],
  fk0: 'Berøringspunkter',
  fk1: 'Verdi per kjøp',
  fk2: 'Til konvertering',
  touchpoints: '4',
  value: '890 kr',
  daysToConv: '6 dager',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-attribusjon_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-attribusjon_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
