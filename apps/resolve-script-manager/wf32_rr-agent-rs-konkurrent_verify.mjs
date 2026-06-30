import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-rs-konkurrent.html', 'utf8');

const CFG = {
  eyebrow: 'Research · Konkurrentanalyse',
  title: 'Slik scorer du mot konkurrentene i Bergen',
  youLabel: 'Din snitt-rating',
  youRating: '4,8',
  youSub: 'på tvers av plattformer',
  reviewsLabel: 'Snitt anmeldelser',
  avgReviews: '212',
  reviewsSub: 'i bransjen lokalt',
  compHead: 'Konkurrenter i ditt marked',
  comp1Name: 'Lysverk Studio',
  comp1Handle: '@lysverkstudio',
  comp1Platform: 'instagram',
  comp1Rating: '4,6',
  comp1Reviews: '348',
  comp2Name: 'Nordlys Media',
  comp2Handle: '@nordlysmedia',
  comp2Platform: 'youtube',
  comp2Rating: '4,3',
  comp2Reviews: '176',
  footer: 'Analysert av Agent · oppdatert i dag',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-konkurrent_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-rs-konkurrent_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
