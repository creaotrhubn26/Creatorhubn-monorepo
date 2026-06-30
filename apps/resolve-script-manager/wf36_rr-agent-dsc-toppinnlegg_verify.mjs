import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-dsc-toppinnlegg.html', 'utf8');

const CFG = {
  period: 'Siste 30 dager',
  subtitle: 'rangert etter engasjement',
  posts: [
    { plat: 'instagram', kind: 'reel',     cap: 'Bak kulissene fra bryllupet på Lysøen', eng: 4820, rate: 9.4, date: '12. mai' },
    { plat: 'tiktok',    kind: 'video',    cap: 'Slik fanger vi den magiske blå timen',  eng: 3110, rate: 7.1, date: '5. mai' },
    { plat: 'instagram', kind: 'karusell', cap: '5 grep for varmere fargegradering',     eng: 2240, rate: 5.8, date: '21. apr' }
  ],
  insight: 'Reels presterer 2,3× bedre enn bilder — prioritér video neste uke.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-toppinnlegg_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-toppinnlegg_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
