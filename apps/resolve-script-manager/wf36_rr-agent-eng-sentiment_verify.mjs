import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-eng-sentiment.html', 'utf8');

const CFG = {
  plat: 'instagram',
  side: '@studionordfilm',
  title: 'Sentiment i samtalen',
  window: 'siste 30 dager',
  pos: 71,
  neu: 21,
  neg: 8,
  total: 486,
  posTrend: '+9',
  negTrend: '-3',
  active: ['pos', 'neu', 'neg'],
  aiText: 'Stemningen er <b>klart positiv</b> — folk fremhever bryllupsfilmene og rask levering. ' +
          'De få negative gjelder ventetid på korrektur; følg opp <b>raskt</b> for å snu dem.',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-sentiment_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-sentiment_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
