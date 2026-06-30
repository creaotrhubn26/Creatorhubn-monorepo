import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const id = 'rr-agent-in-epost-sekvens';
let html = readFileSync(`/tmp/wf36_${id}.html`, 'utf8');

const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  eyebrow: 'Agent-anbefaling',
  insightLbl: 'Innsikt · e-post',
  title: 'Start en <b>e-post-sekvens</b>',
  mainIcon: 'forward_to_inbox',
  steps: ['Velkomst', 'Verdi', 'Tilbud'],
  insight: 'Du har samlet <b>47 varme leads</b> fra «Nattskift»-kampanjen som aldri fikk oppfølging. En automatisk sekvens på 3 e-poster over 9 dagar kan vekke dei før dei kjølner.',
  tall: '47',
  tallLabel: 'Varme leads uten oppfølging',
  metricIcon: 'drafts',
  trendTxt: 'klare nå',
  cta: 'Utfør',
  ctaIcon: 'bolt'
};

html = html.replace('__CFG__', JSON.stringify(CFG));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 1100, height: 800 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

const wrap = await page.$('#wrap');

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(200);
await wrap.screenshot({ path: `/tmp/wf36_${id}_end.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(200);
await wrap.screenshot({ path: `/tmp/wf36_${id}_mid.png`, omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('rendered');
