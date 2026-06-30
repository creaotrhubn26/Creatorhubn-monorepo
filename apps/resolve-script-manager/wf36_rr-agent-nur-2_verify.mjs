import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-nur-2.html', 'utf8');

const CFG = {
  beta: 'Nurture-sekvens',
  seclabel: 'Verdi-e-post · Trinn 2',
  seqlbl: 'Sekvens',
  seqpill: 'Trinn 2 av 4',
  mailtitle: 'Verdi-e-post',
  lead: 'Kari Nordmann',
  email: 'kari@blomstereng.no',
  warm: 'Engasjert',
  subject: '3 grep som doblet rekkevidden for kunder som deg',
  greet: 'Hei Kari,',
  body1: 'Forrige uke delte jeg hvordan vi jobber. I dag vil jeg gi deg noe konkret du kan bruke med en gang — <span class="hl">uansett om vi ender opp med å samarbeide</span>.',
  vkick: 'Gratis innsikt',
  vhead: 'Reels publisert tirsdag kl. 19',
  vsub: 'Bestetidspunktet for din målgruppe i Norge',
  vnum: '+118 %',
  vunit: 'rekkevidde',
  body2: 'Vil du ha hele <span class="hl">sjekklisten på 9 punkter</span>? Bare svar «JA», så sender jeg den over — ingen forpliktelser.',
  sign: 'Daniel — The Role Room',
  tip: 'Trinn 2 sendes 4 dager etter velkomst — gir verdi før salg og holder 31 % høyere svarrate',
  sched: 'Sendes om 4 dager · tor. 09:00',
  sendlbl: 'Legg i sekvens',
  sentlbl: 'Planlagt',
  step1: 'Velkomst', step2: 'Verdi', step3: 'Case', step4: 'Tilbud',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-2_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(160);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-2_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
