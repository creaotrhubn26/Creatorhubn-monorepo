import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-eng2-facebook.html', 'utf8');

const CFG = {
  title: 'Engasjement på innlegget',
  subtitle: 'Reels · «Bak kulissene på opptaket»',
  likes: 8420,
  comments: 1260,
  shares: 540,
  likesDelta: 38,
  commentsDelta: 52,
  sharesDelta: 27,
  trend: [40, 55, 48, 70, 66, 88, 100],
  trendTotal: 10220,
  insightLead: 'Delinger opp 27 % — innlegget sprer seg organisk.',
  insightRest: 'Agent anbefaler å løfte fram det samme sett-øyeblikket i et oppfølgings-Reel mens algoritmen er varm.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

await page.setContent(
  '<div style="background:linear-gradient(120deg,#0a0612,#1a0f2e 55%,#241038);min-height:100vh;padding:40px">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng2-facebook_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng2-facebook_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
