import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-nur-5.html', 'utf8');

const CFG = {
  seclabel: 'Nurture-sekvens · trinn 5',
  lctag: 'Siste e-post i sekvensen',
  lctitle: 'Vi pakker ned tilbudet ditt',
  stepbadge: 'Siste sjanse',
  steps: ['Velkomst', 'Verdi-tips', 'Case-studie', 'Påminnelse', 'Siste sjanse'],
  lead: 'Kari Nordmann',
  leadsub: 'Blomstereng AS · 4 e-poster sendt, 0 svar',
  temp: 'Lunken lead',
  greet: 'Hei Kari,',
  body1: 'Jeg har sendt deg noen idéer for <span class="hlp">innholdsproduksjon til vårkampanjen</span>, men har ikke hørt fra deg — helt forståelig i en travel hverdag.',
  body2: 'Dette er <span class="hl">siste e-post fra meg</span>. Vil du fortsatt at vi tar en kort prat før vi gir plassen til neste kunde?',
  count: 48,
  countlbl: 'Tilbud utløper om',
  countunit: 'timer',
  offerlbl: 'Forbeholdt deg',
  offer: 'Gratis innholdsplan + 15 % på første måned',
  offerold: '9 800 kr',
  offernew: '8 330 kr / mnd',
  tip: 'Leads som åpnet trinn 3 konverterer 2,4× oftere på en «siste sjanse» med tidsfrist',
  sched: 'Sendes i dag 08:45 · deretter lukkes sekvensen',
  sendlbl: 'Send siste e-post',
  sentlbl: 'Sendt',
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
await page.waitForTimeout(160);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-5_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(160);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-5_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
