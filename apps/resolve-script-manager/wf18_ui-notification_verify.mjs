import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf18_ui-notification.html', 'utf8');

const CFG = {
  appnavn: 'Creatorhub',
  tittel: 'Ny audition-forespørsel',
  melding: 'Synnøve Bråthen har sendt inn selvtape til rollen «Astrid».',
  tid: '2 min siden',
  accent: '#6366f1',
  ink: '#1f2d4a',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

await page.setContent(
  '<div style="background:linear-gradient(120deg,#0f172a,#1e293b 55%,#334155);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf18_ui-notification_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf18_ui-notification_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
