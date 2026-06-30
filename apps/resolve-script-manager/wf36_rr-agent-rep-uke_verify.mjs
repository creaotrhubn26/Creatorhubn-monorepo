import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-rep-uke.html', 'utf8');

const CFG = {
  eyebrow: 'Ukerapport · uke 24',
  title: 'Uken oppsummert',
  period: '9.–15. juni',
  k0: 'Visninger',   v0: '184 200', s0: '',
  k1: 'Engasjement', v1: '14,6',    s1: '%',  d1: '+3,1 pp',
  k2: 'Nye følgere', v2: '1 280',   s2: '',
  k3: 'Lenkeklikk',  v3: '3 420',   s3: '',
  d0: '+22 %', d2: '+18 %', d3: '+41 %',
  toplabel: 'Ukens beste innlegg',
  platform: 'instagram',
  postIcon: 'slideshow',
  postTitle: 'Reels: bak kulissene fra opptaket på Grünerløkka',
  postLikes: '8 240',
  postComments: '312',
  postShares: '1 140',
  postReach: '96 400',
  reachLabel: 'Rekkevidde',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(200);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-rep-uke_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(200);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-rep-uke_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
