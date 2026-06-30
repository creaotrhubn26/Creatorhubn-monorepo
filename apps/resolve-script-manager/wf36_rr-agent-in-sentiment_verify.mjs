import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-in-sentiment.html', 'utf8');

const CFG = {
  eyebrow: 'Agent-anbefaling',
  insight: 'Negativt sentiment <span class="grad">øker rundt innleggene dine</span>',
  reason: 'Jeg ser en tydelig økning i negative kommentarer på de tre siste innleggene — tonen handler mest om leveringstid på casting-svar. La oss svare før misnøyen sprer seg.',
  tall: '34',
  tallSuffiks: '%',
  tallLabel: 'Negativt sentiment siste 7 dager',
  trend: '+18 % på én uke',
  cta: 'Utfør',
  skip: 'Eller spør meg om detaljene',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-sentiment_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-sentiment_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
