import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-grow-linkedin.html', 'utf8');

const CFG = {
  platform: 'LinkedIn',
  kicker: 'FØLGERVEKST · SISTE 30 DAGER',
  title: 'LinkedIn-veksten akselererer',
  subtitle: 'Agenten publiserte fagposter og engasjerte beslutningstakere — følgerkurven peker bratt oppover for byrået.',
  gainLabel: 'Nye følgere',
  newFollowers: '842',
  totalFollowers: '3180',
  trend: '+38 %',
  posts: '14',
  postsSub: 'av Agenten',
  engagement: '6,4 %',
  xStart: 'Uke 1',
  xEnd: 'Uke 4',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-grow-linkedin_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-grow-linkedin_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
