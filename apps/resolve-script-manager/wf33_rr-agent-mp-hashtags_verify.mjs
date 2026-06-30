import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf33_rr-agent-mp-hashtags.html', 'utf8');

const CFG = {
  tags: '#kortfilm, #norskfilm!, #bakomkulissene, #filmproduksjon!, #kreativbransjen, #filmskaper!, #settliv, #voiceover, #indiefilm, #regissør!',
  score: '84',
  scoreCaption: 'Balansert miks av bred rekkevidde og presis nisje',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

html = html.replace('__CFG__', JSON.stringify(CFG));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:linear-gradient(120deg,#1c1c22,#2a2230 55%,#0e0e16);min-height:100vh;padding:40px">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-hashtags_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf33_rr-agent-mp-hashtags_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
