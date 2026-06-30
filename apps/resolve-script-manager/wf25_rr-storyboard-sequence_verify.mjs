import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf25_rr-storyboard-sequence.html', 'utf8');

const CFG = {
  scene: '12',
  s1: '12A', b1: 'Vidvinkel: helten trer inn i den forlatte fabrikkhallen ved soloppgang.',
  s2: '12B', b2: 'Nærbilde: blikket fester seg på den røde døren i enden av rommet.',
  s3: '12C', b3: 'Over skulder: hånden strekker seg nølende mot det rustne håndtaket.',
  s4: '12D', b4: 'Reaksjon: ansiktet lyser opp idet døren glir opp mot lyset.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf25_rr-storyboard-sequence_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf25_rr-storyboard-sequence_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
