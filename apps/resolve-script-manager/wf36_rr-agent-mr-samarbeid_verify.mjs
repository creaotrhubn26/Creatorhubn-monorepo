import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-mr-samarbeid.html', 'utf8');

const CFG = {
  kicker: 'Samarbeid-status',
  summaryCap: 'Har svart',
  rows: [
    { name: 'Nordlys Lydstudio',    role: 'Lyd & musikk',      plat: 'Instagram', time: '14 min',  status: 'ok'   },
    { name: 'Bilde & Bevegelse AS', role: 'Foto & video',      plat: 'YouTube',   time: '1 t 20 m', status: 'ok'   },
    { name: 'Søster Kreativ',       role: 'Grafisk design',    plat: 'LinkedIn',  time: '3 t 05 m', status: 'wait' },
    { name: 'Fjord Influencer',     role: 'Distribusjon',      plat: 'TikTok',    time: 'Sendt',    status: 'wait' },
    { name: 'Østkant Catering',     role: 'Servering på sett', plat: 'Facebook',  time: 'Ingen',    status: 'no'   }
  ],
  note: 'Agenten purrer <b>2 partnere</b> automatisk og varsler deg når alle har bekreftet',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-samarbeid_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-samarbeid_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
