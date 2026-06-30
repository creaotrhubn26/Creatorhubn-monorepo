import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-in-cta.html', 'utf8');

const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Agent',
  eyebrow: 'Agent-anbefaling',
  insight: 'Bytt <span class="grad">handlingsknappen</span> for flere klikk',
  reason: 'Reelen «Casting åpner nå» får god rekkevidde, men få trykker videre. CTA-en «Les mer» er for passiv — en tydeligere og mer hastende oppfordring kan løfte klikkraten merkbart.',
  oldLab: 'Nåværende CTA',
  oldCta: '«Les mer»',
  newLab: 'Anbefalt CTA',
  newCta: '«Søk rollen i kveld»',
  tall: '+42',
  tallSuffiks: '%',
  tallLabel: 'flere klikk i estimert A/B-test',
  statIkon: 'ads_click',
  cta: 'Utfør',
  skip: 'Eller spør meg om analysen bak'
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-cta_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-cta_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
