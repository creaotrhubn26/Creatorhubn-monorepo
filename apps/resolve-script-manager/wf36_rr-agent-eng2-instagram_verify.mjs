import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-eng2-instagram.html', 'utf8');

const CFG = {
  eyebrow: 'Instagram-engasjement',
  title: 'Engasjement denne uken',
  handle: '@studio.nord',
  periode: 'Siste 7 dager',
  likes: '3 420',
  kommentarer: '286',
  delinger: '142',
  likesDelta: '+18%',
  kommentarerDelta: '+24%',
  delingerDelta: '+31%',
  rate: '6,4',
  ratePct: 64,
  note: 'Over bransjesnittet — beste resultat på fire uker',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng2-instagram_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng2-instagram_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
