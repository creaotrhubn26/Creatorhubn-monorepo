import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf9_credits-roll.html', 'utf8');

const CFG = {
  heading: 'Medvirkende',
  role1: 'Regi', person1: 'Astrid Lindholm',
  role2: 'Foto', person2: 'Mathias Berg',
  role3: 'Klipp', person3: 'Sofie Aaland',
  role4: 'Musikk', person4: 'Jonas Vik',
  role5: 'Produsent', person5: 'Henrik Solberg',
  accent: '#c9a24b',
  ink: '#10141c',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent('<div style="background:#0a0d14;min-height:100vh">' + html + '</div>', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf9_credits-roll_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf9_credits-roll_mid.png', omitBackground: true });

await browser.close();
console.log('done');
