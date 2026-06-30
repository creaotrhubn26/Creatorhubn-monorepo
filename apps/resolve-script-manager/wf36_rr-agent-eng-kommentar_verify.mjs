import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-eng-kommentar.html', 'utf8');

const CFG = {
  plat: 'instagram',
  name: 'Mariann Eikrem',
  handle: '@mariann.e',
  time: '2 min siden',
  text: 'Dette er rett og slett nydelig jobba — gleder meg så til neste episode! Hvor får jeg tak i den blå kjolen hun går i?',
  sentiment: 'sporsmal',
  reply: 'Svar med Agent',
  hintLead: 'Agent foreslår svar',
  hintRest: '— svarer på spørsmålet og lenker til riktig produkt',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-kommentar_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-kommentar_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
