import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-dsc-fbside.html', 'utf8');

const CFG = {
  eyebrow: 'Sideoversikt',
  h1: 'Bryggeloftet Brød & Kaffe',
  h2: 'Håndverksbakeri',
  h3: 'Lokal kafé',
  cta: '@bryggeloftet · Lokal bedrift i Bergen',
  s1sub: '+312 siste 28 dager',
  s2sub: '95 % av følgerne',
  s3sub: '214 anmeldelser',
  followers: 18640,
  likes: 17710,
  rating: 49,
  quality: 88,
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-fbside_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-fbside_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
