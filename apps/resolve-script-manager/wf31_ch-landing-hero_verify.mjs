import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf31_ch-landing-hero.html', 'utf8');

const CFG = {
  eyebrow: 'Bygget av kreative, for kreative.',
  headline: 'Plattformen for kreativt arbeid',
  prop: 'Administrer prosjekter, samarbeid med team og gjennomfør produksjon i ett system.',
  cta1: 'Se planer og priser',
  cta2: 'Se produktene',
  accent: '#ffba6c',
  ink: '#f6f2ea',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf31_ch-landing-hero_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf31_ch-landing-hero_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
