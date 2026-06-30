import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf27_rr-agent-chat.html', 'utf8');

const CFG = {
  sporsmal: 'Hvem konkurrerer vi mot i byrå-markedet, og hvor er den reelle åpningen for oss?',
  svar: 'Konkurrentanalysen peker på fem aktører – men ingen eier hele reisen fra idé til levering. Konkurrenten er fragmenteringen. Min anbefaling: posisjonér The Role Room som operativsystemet for produksjon, og kjør lead-gen mot byråene som sliter med å lime verktøyene sammen.',
  f1: 'Vis ROI-funnel for siste kampanje',
  f2: 'Lag markedsplan for neste kvartal',
  f3: 'Finn partnere til discovery i Bergen',
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
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf27_rr-agent-chat_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf27_rr-agent-chat_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
