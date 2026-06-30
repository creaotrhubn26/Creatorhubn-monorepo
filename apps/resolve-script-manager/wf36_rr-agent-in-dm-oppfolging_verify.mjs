import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-dm-oppfolging.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  title: 'Følg opp ubesvarte DM-er',
  head: 'Ubesvarte meldinger hoper seg opp',
  chip: 'Haster',
  sub: 'Du har <b>7 ubesvarte DM-er på Instagram</b> eldre enn 24 timer – svar i dag for å unngå tapte henvendelser.',
  tall: '7',
  tallLabel: 'Ubesvarte DM-er',
  kanal: 'Instagram',
  cta: 'Utfør'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-dm-oppfolging_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-dm-oppfolging_mid.png', omitBackground: true });

await browser.close();
console.log('done');
