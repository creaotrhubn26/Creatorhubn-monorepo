import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-vinnende-post.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'emoji_events',
  head: 'Ditt beste innlegg denne uka — <em>gjenbruk vinneren</em>',
  platform: 'instagram',
  winCrown: 'Ukas vinner',
  winHandle: '@studio.roleroom',
  winWhen: 'Tirsdag · 18:30',
  winCap: '«Bak kulissene fra opptaket i går — slik bygger vi en scene fra bunnen.»',
  winLikes: '5,1k', winComments: '412', winSaves: '733',
  winPlatIcon: 'photo_camera',
  insightLabel: 'Agentens innsikt',
  insightIcon: 'lightbulb',
  insightVal: 'Bak-kulissene-innhold på <b>tirsdag kveld</b> traff målgruppen best. Jeg lager et nytt utkast i samme format og foreslår beste publiseringstid.',
  tall: '6,8%', tallLabel: 'engasjement — 3× ditt snitt',
  cta: 'Utfør · Lag lignende innlegg',
  foot: 'Du godkjenner før noe publiseres — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-vinnende-post_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-vinnende-post_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
