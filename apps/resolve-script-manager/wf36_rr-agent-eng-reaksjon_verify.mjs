import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-eng-reaksjon.html', 'utf8');

const CFG = {
  plat: 'instagram',
  title: 'Reaksjoner på innlegget',
  subtitle: 'Karusell · «Bak kulissene på opptaket»',
  unit: 'reaksjoner',
  total: 4820,
  delta: 34,
  reactions: [
    { name: 'Liker',   icon: 'thumb_up', count: 2640, color: '#4f9dff' },
    { name: 'Hjerte',  icon: 'favorite', count: 1290, color: '#f0436d' },
    { name: 'Wow',     icon: 'sentiment_very_satisfied', count: 510, color: '#f7b500' },
    { name: 'Applaus', icon: 'celebration', count: 248, color: '#a855f7' },
    { name: 'Rørt',    icon: 'sentiment_dissatisfied', count: 132, color: '#69c9d0' }
  ],
  insightLead: 'Hjerte-reaksjoner opp 41 %',
  insightRest: '— Agent anbefaler å løfte fram personlige sett-øyeblikk i neste karusell.',
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
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-reaksjon_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-reaksjon_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
