import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf28_rr-landing-blog.html', 'utf8');

const CFG = {
  a1: '12-punkts GDPR-sjekkliste for skuespillerbyråer',
  tag1: 'Personvern',
  a2: 'Self-tape-praksis: hva castere ser etter i 2026',
  tag2: 'Casting',
  a3: 'Hvorfor regnearket koster byrået 250.000 kr i året',
  tag3: 'Drift',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('var CFG = __CFG__;', 'var CFG = window.__CFG__;');
html = html.replace('<script>\n  var CFG', inject + '\n<script>\n  var CFG');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf28_rr-landing-blog_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf28_rr-landing-blog_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
