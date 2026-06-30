import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf23_ch-wedding-timeline.html', 'utf8');

const CFG = {
  eyebrow: 'Bryllupsdag',
  brudepar: 'Ingrid & Håkon',
  dato: 'Lørdag 23. august 2026',
  lokasjon: 'Søndre Gård, Lillehammer',
  t1: '07:00', a1: 'Brudestyling og forberedelser',
  t2: '13:00', a2: 'Vielse i Mariakirken',
  t3: '15:00', a3: 'Portretter ved fjorden',
  t4: '18:00', a4: 'Festmiddag og taler',
  t5: '22:00', a5: 'Brudevals og fest',
  accent: '#ffba6c',
  ink: '#fff5e8',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf23_ch-wedding-timeline_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf23_ch-wedding-timeline_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
