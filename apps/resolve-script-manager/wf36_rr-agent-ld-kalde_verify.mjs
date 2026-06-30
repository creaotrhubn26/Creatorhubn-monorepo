import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-ld-kalde.html', 'utf8');

const CFG = {
  section: 'Kalde leads · reaktivering',
  count: '3',
  nm1: 'Bjørnar Sæther',
  last1: 'Sist kontakt for 47 dager siden',
  src1: 'Instagram-DM',
  react1: 'Del den ferske <b>bryllupsfilmen fra Røros</b> og spør om høst-datoene deres.',
  nm2: 'Åse Mørk',
  last2: 'Sist kontakt for 62 dager siden',
  src2: 'Lead Ad · Meta',
  react2: 'Send et <b>kort tilbud med 15 % vårrabatt</b> og en lenke til portefølje-reelen.',
  nm3: 'Håkon Lødøen',
  last3: 'Sist kontakt for 88 dager siden',
  src3: 'Nettside-skjema',
  react3: 'Gjenåpne med en <b>personlig videohilsen</b> og tilby en uforpliktende 15-min prat.',
  footk: 'Klar til å sendes',
  foots: 'Personlige reaktiveringer skreddersydd av Agenten',
  cta: 'Vekk alle 3',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-kalde_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-kalde_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
