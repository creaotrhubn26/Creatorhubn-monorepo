import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf11_rr-role-announcement.html', 'utf8');

const CFG = {
  roleName: 'Lena Berg',
  produksjon: 'Nordlys — NRK Dramaserie',
  alder: '28–36',
  kjonn: 'Kvinne',
  lokasjon: 'Oslo / Tromsø',
  beskrivelse: 'En målbevisst gravejournalist som avdekker en sannhet ingen vil høre. Bærebjelken i historien — krever nærvær, tyngde og sårbarhet i tette nærbilder.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:#202020;min-height:100vh;display:flex;align-items:center;padding:60px">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-role-announcement_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-role-announcement_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
