import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-ld-selgervarsel.html', 'utf8');

const CFG = {
  label: 'Ny varm lead',
  title: 'Selger-varsel',
  sub: 'Agenten fanget en høyt scorende henvendelse — kontakt nå.',
  name: 'Kari Nordmann',
  source: 'Meta-annonse',
  place: 'Oslo',
  interest: 'Bryllupsfilm',
  score: '94',
  slaSeconds: 300,
  slaH: 'Ring innen anbefalt tid',
  slaS: 'Varme leads svarer 8× oftere ved rask oppfølging',
  call: 'Ring nå',
  mail: 'Send e-post',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-selgervarsel_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-selgervarsel_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
