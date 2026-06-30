import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf35_rr-ws-manuscript.html', 'utf8');

const CFG = {
  scene:    'SCENE 1 — INT. KAFÉ — DAG',
  handling: 'Morgenlyset siver inn gjennom de duggete vinduene. EMMA sitter alene ved hjørnebordet med en kald kopp kaffe. Hun ser opp idet døra åpnes — og blir blek.',
  karakter: 'EMMA',
  replikk:  'Jeg visste du ville komme. Jeg har ventet hele vinteren på dette øyeblikket.',
  versjon:  'v3',
  accent:   '#a78bfa',
  ink:      '#f5f3ff',
  logo:     ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-manuscript_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-manuscript_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
