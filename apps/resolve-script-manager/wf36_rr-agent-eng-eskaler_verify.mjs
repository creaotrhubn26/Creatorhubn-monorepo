import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-eng-eskaler.html', 'utf8');

const CFG = {
  eyebrow: 'Flagget hendelse',
  btitle: 'Krever oppfølging',
  bsub: 'Negativ omtale med høy rekkevidde — bør håndteres personlig før den sprer seg.',
  sev: 'Høy',
  time: '8 min siden',
  plat: 'instagram',
  from: 'Anders Vik',
  handle: '@anders.vik',
  verified: true,
  quote: 'Skuffet over leveransen — ventet i tre uker ekstra og fikk aldri svar på e-postene mine.',
  s1: 8420, s1l: 'Rekkevidde',
  s2: 312, s2l: 'Reaksjoner',
  s3: 47, s3l: 'Kommentarer',
  assignee: 'Daniel Qazi', role: 'Kundeansvarlig',
  due: '2 timer',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-eskaler_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-eskaler_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
