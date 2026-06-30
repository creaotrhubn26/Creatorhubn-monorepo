import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf29_rr-agent-mentions.html', 'utf8');

const CFG = {
  side: 'Studio Nord Film',
  o1f: 'Marte Hansen',
  o1t: 'Helt fantastisk jobb med bryllupsfilmen vår — kan dere ta oppdrag til høsten også?',
  o2f: 'Jonas Berg',
  o2t: 'Vurderer dere til et reklameprosjekt for bedriften. Hva koster en dags opptak?',
  o3f: 'Anonym bruker',
  o3t: 'Spam-lenke i kommentarfeltet, ikke relevant for siden vår.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf29_rr-agent-mentions_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf29_rr-agent-mentions_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
