import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-gjenbruk.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'autorenew',
  head: 'Gjenbruk topp-innlegget ditt — <em>oppdater og publiser på nytt</em>',
  platform: 'instagram',
  oldTag: 'Eldre vinner',
  oldCap: '«Slik bygger vi en scene fra bunnen — bak kulissene fra opptaket.»',
  oldLikes: '4,2k', oldSaves: '610',
  newTag: 'Nytt utkast',
  newCap: '«Ny vri på samme historie — friskt klipp, samme format som traff best.»',
  newEst: '+38% est.', newWhen: 'Tir 18:30',
  insightLabel: 'Agentens innsikt',
  insightIcon: 'lightbulb',
  insightVal: 'Dette formatet traff målgruppen din best for <b>6 uker siden</b> — de fleste følgerne dine så det aldri. Jeg gjenbruker vinkelen i et nytt utkast og foreslår beste tid.',
  tall: '3,4×', tallLabel: 'forventet rekkevidde mot nyprodusert',
  cta: 'Utfør · Lag gjenbruk-utkast',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-gjenbruk_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-gjenbruk_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
