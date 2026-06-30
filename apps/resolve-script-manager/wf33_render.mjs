import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf33_rr-agent-mp-readiness.html', 'utf8');
const CFG = {
  accent:'#a78bfa', ink:'#f5f3ff', logo:'',
  r1:'Kundeprofil', r2:'Branding', r3:'Mål og KPI', r4:'Kanaler'
};
const injected = html.replace('__CFG__', JSON.stringify(CFG));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
page.on('console', m => console.log('[page]', m.type(), m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const hasFn = await page.evaluate(()=> typeof window.setProgress);
console.log('setProgress typeof =', hasFn);

async function shot(p, file){
  await page.evaluate((pp)=>window.setProgress(pp), p);
  await page.waitForTimeout(250);
  const el = await page.$('#wrap');
  await el.screenshot({ path: file, omitBackground: true });
}

await shot(1, '/tmp/wf33_rr-agent-mp-readiness_end.png');
await shot(0.5, '/tmp/wf33_rr-agent-mp-readiness_mid.png');
await page.evaluate(()=>window.setProgress(0));
console.log('done');
await browser.close();
