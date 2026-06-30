import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-adv-budsjett.html', 'utf8');

const CFG = {
  eyebrow: 'Annonsebudsjett',
  title: 'Budsjett-pacing',
  subtitle: 'Juni · Instagram + Facebook',
  budget: '30 000 kr',
  spent: '27 600 kr',
  spentPct: '46',
  idealPct: '50',
  paceState: 'behind',
  daysLeft: '14',
  dailyNow: '1 730 kr',
  dailyRec: '620 kr',
  insight: 'Du ligger <b>4 % under</b> ideell pacing. Øk dagsbudsjettet til <b>620 kr</b> for å bruke opp potten jevnt før månedsslutt.',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-budsjett_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-budsjett_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
