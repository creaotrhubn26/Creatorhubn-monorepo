import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf38_rr-dance-elever.html', 'utf8');

const CFG = {
  klasse: 'Moderne — Viderekomne',
  sesong: 'Høst 2026',
  e1: 'Mathea Sørensen', n1: 'Nivå 4 · Sal 2', a1: 96,
  e2: 'Aksel Bjørnstad',  n2: 'Nivå 3 · Sal 1', a2: 88,
  e3: 'Selma Aurdal',     n3: 'Nivå 4 · Sal 2', a3: 91,
  e4: 'Henrik Lødemel',   n4: 'Nivå 2 · Sal 3', a4: 74,
  accent: '#a78bfa', ink: '#f5f3ff', logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-dance-elever_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-dance-elever_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
