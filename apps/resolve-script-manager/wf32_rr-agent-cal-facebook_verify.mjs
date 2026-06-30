import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-cal-facebook.html', 'utf8');

const CFG = {
  uke: 'Uke 24',
  d1: 'Mandag',  t1: 'Behind the scenes fra opptaket på Grünerløkka',
  d2: 'Onsdag',  t2: 'Video: tre tips for bedre lyssetting på sett',
  d3: 'Fredag',  t3: 'Album: ukens beste øyeblikk fra produksjonen',
  d4: 'Søndag',  t4: 'Spørsmål og svar – møt teamet bak kameraet',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-cal-facebook_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-cal-facebook_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
