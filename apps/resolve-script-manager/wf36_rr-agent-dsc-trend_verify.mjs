import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-dsc-trend.html', 'utf8');

const CFG = {
  eyebrow: 'Trender akkurat nå',
  title: 'Trendende emner & lyder',
  summary: 'Agenten anbefaler å publisere på <b>3 av disse</b> innen 48 timer for å ri toppen av bølgen.',
  trends: [
    { topic: '#NorskKortfilm', platform: 'instagram', kind: 'Emne',   volume: '124k innlegg',  growth: 312 },
    { topic: 'Lyd: «Sommernatt»', platform: 'tiktok', kind: 'Lyd',     volume: '48k videoer',   growth: 248 },
    { topic: 'Bak kulissene',  platform: 'youtube',   kind: 'Format', volume: '9,2k klipp',    growth: 176 },
    { topic: '#Castingkall',   platform: 'linkedin',  kind: 'Emne',   volume: '3,4k delinger', growth: 134 },
    { topic: 'Lavbudsjett-rigg', platform: 'facebook', kind: 'Tema',  volume: '21k innlegg',   growth: 92  }
  ],
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-trend_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-trend_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
