import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-gap.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  head: 'En kanal er underbrukt',
  insight: 'Jeg har sammenlignet aktiviteten din på tvers av kanalene. <b>Instagram</b> og <b>TikTok</b> jobber hardt for deg — men <b>LinkedIn</b> ligger nesten brakk, selv om følgerne dine der er mest kjøpeklare. Her er det rekkevidde å hente uten å bruke en krone.',
  tall: '+5 200', tallLabel: 'Uutnyttet rekkevidde i måneden', statIcon: 'groups',
  cta: 'Utfør forslag', skip: 'Senere'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-gap_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-gap_mid.png', omitBackground: true });

await browser.close();
console.log('done');
