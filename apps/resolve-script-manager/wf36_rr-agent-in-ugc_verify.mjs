import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-ugc.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  live: 'Live innsikt',
  eyebrow: 'Agent-anbefaling',
  head: 'Tre fans har laget innhold om deg — <em>del det videre</em>',
  insightLabel: 'Brukergenerert innhold å dele', insightIcon: 'collections_bookmark',
  insightVal: 'Publikummet ditt har <b>tagget deg i 3 nye innlegg</b> denne uka. Å reposte øker tilliten og sparer deg for produksjonstid.',
  recoIcon: 'auto_fix_high',
  tall: '3', tallLabel: 'nye UGC-innlegg klare for repost',
  cta: 'Utfør · Del innholdet',
  foot: 'Du godkjenner hver repost før den går live — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-ugc_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-ugc_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
