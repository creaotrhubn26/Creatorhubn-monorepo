import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-comp-facebook.html', 'utf8');

const CFG = {
  section: 'Konkurrentanalyse',
  sub: 'Deg mot 2 konkurrenter · siste 30 dager',
  you: 'Bø Mediehus',
  c1: 'Fjord & Film',
  c2: 'Nordlys Studio',
  followersYou: '18 400',
  followersC1: '12 100',
  followersC2: '9 800',
  engagementYou: '4,8',
  engagementC1: '3,1',
  engagementC2: '2,6',
  postsYou: '6',
  postsC1: '4',
  postsC2: '5',
  insight: 'Du leder på <b>følgere</b> og <b>engasjement</b> på Facebook, men <b>Nordlys Studio</b> publiserer nesten like ofte. Agenten foreslår 1 ekstra innlegg per uke for å holde forspranget.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 980 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-comp-facebook_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-comp-facebook_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
