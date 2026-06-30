import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf11_rr-shoot-schedule.html', 'utf8');

const CFG = {
  dato: 'Fredag 14. juni 2026',
  t1: '07:00', a1: 'Rigg, lys & kamera',
  t2: '09:30', a2: 'Opptak Scene 1–3',
  t3: '13:00', a3: 'Lunsjpause',
  t4: '17:30', a4: 'Wrap & nedrigg',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// branded dark backdrop to judge legibility over video
await page.setContent(
  '<div style="background:radial-gradient(circle at 30% 20%,#241636,#0b0712 70%);min-height:100vh;display:flex;align-items:center;padding:60px">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-shoot-schedule_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf11_rr-shoot-schedule_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
