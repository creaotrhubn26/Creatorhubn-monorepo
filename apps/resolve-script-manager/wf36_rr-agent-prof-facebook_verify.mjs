import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-prof-facebook.html', 'utf8');

const CFG = {
  pgname: 'Bjørkheim Bakeri',
  pgcat: 'Bakeri · Kafé · Tromsø',
  likes: '3 240',
  bio: 'Vi baker ekte håndverksbrød hver morgen i hjertet av Tromsø. Stikk innom for nybakt surdeig, lun kaffe og en varm prat på vår lille møteplass ved sjøkanten.',
  h1: 'håndverksbakeri',
  h2: 'kortreistTromsø',
  h3: 'nybaktSurdeig',
  cta: 'Besøk oss i dag',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-prof-facebook_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-prof-facebook_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
