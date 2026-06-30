import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf33_rr-agent-mp-ukesplan.html', 'utf8');

const CFG = {
  uke: 'Uke 24',
  man: 'Instagram · Behind the scenes fra opptaket på Grünerløkka',
  tir: 'LinkedIn · Bransjeinnsikt: slik velger du castingbyrå',
  ons: 'TikTok · 3 raske tips for bedre lyssetting på sett',
  tor: 'hviledag',
  fre: 'Facebook · Ukens beste øyeblikk i karusell',
  lor: 'Instagram · Reel: møt teamet bak kulissene',
  son: 'hviledag',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-ukesplan_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-ukesplan_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
