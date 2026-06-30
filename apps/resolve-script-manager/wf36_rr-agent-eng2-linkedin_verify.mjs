import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-eng2-linkedin.html', 'utf8');

const CFG = {
  plat: 'linkedin',
  title: 'Engasjement på innlegget',
  subtitle: 'Fagartikkel · «Slik bygger byråer skalerbar filmproduksjon»',
  unit: 'interaksjoner',
  total: 1840,
  delta: 47,
  rate: 6.8,
  metrics: [
    { name: 'Likerklikk',  icon: 'thumb_up',     count: 1240, delta: 38, color: '#0a66c2' },
    { name: 'Kommentarer', icon: 'mode_comment', count: 372,  delta: 61, color: '#7c5cff' },
    { name: 'Delinger',    icon: 'repeat',       count: 228,  delta: 54, color: '#d946ef' }
  ],
  spark: [38, 52, 44, 70, 61, 88, 76, 100],
  insightLead: 'Kommentarer opp 61 % på fagartikler.',
  insightRest: 'Agent anbefaler å avslutte neste innlegg med et åpent bransjespørsmål for å løfte samtalen videre.',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng2-linkedin_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng2-linkedin_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
