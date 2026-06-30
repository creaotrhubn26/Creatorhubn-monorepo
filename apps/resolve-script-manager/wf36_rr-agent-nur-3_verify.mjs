import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-nur-3.html', 'utf8');

const CFG = {
  brandkicker: 'AI-oppfølging',
  seclabel: 'Nurture · trinn 3',
  steplabel: 'Del <b>relevant case study</b>',
  client: 'Nordfjord Eiendom',
  bransje: 'Eiendomsmegling · Bergen',
  match: '94 % match',
  title: 'Slik fikk vi <span class="hl">3,2× flere visningspåmeldinger</span> på 90 dager',
  m1lbl: 'Rekkevidde', m1val: 320, m1suf: '%', m1dec: 0, m1delta: 'vs. forrige kvartal',
  m2lbl: 'Nye leads', m2val: 48, m2suf: '', m2dec: 0, m2delta: 'per måned',
  m3lbl: 'ROAS', m3val: 5.4, m3suf: '×', m3dec: 1, m3delta: 'på annonsekroner',
  quote: 'The Role Room tok over hele innholdsmaskinen vår. Vi merket forskjellen allerede i uke to — flere visninger, varmere leads og mindre styr.',
  qwho: 'Marit Solheim',
  qrole: '· markedssjef',
  tip: 'Samme bransje og bymarked som Kari — sosialt bevis treffer best på trinn 3 i nurture-løpet',
  channel: 'Sendes på e-post',
  chanico: 'mail',
  sharelbl: 'Del case study',
  sentlbl: 'Delt',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-3_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(160);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-3_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
