import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-mp-crosspost.html', 'utf8');

const CFG = {
  tittel: 'Distribuer på tvers',
  kilde: 'Reel fra settet',
  bildetekst: 'Bak kulissene fra castingdagen på Grünerløkka. Ett opptak, tilpasset hver kanal – fra idé til ferdig publisert film.',
  masterformat: 'Master 9:16',
  kanal1: 'Instagram · Reel · Lør 09:00',
  kanal2: 'TikTok · Video · Lør 12:30',
  kanal3: 'Facebook · Reel · Lør 17:00',
  kanal4: 'LinkedIn · Video · Søn 08:00',
  kanal5: '',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-mp-crosspost_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-mp-crosspost_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
