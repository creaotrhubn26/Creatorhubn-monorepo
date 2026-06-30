import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf25_rr-audition-scorecard.html', 'utf8');

const CFG = {
  kandidat: 'Ingrid Sølvberg',
  rolle: 'Hovedrolle — «Nattåpen»',
  k1: 'Tilstedeværelse', s1: 9,
  k2: 'Tolkning',         s2: 8,
  k3: 'Kjemi',            s3: 7,
  k4: 'Teknikk',          s4: 8.5,
  total: 84,
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf25_rr-audition-scorecard_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf25_rr-audition-scorecard_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
