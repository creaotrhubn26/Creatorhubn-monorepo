import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-lokalt-event.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'event_available',
  head: 'Knytt deg til et <em>lokalt arrangement</em> denne uka',
  calMonth: 'JUN',
  calDay: '21',
  eventName: 'Trondheim Filmfestival · åpningshelg',
  eventPlace: 'Trondheim sentrum',
  eventAud: 'Din målgruppe samles',
  insightLabel: 'Hvorfor akkurat dette',
  insightIcon: 'lightbulb',
  insightVal: 'Folk i nærområdet søker <b>«ting å gjøre»</b> akkurat nå — et innlegg som kobler deg på arrangementet treffer en varm, lokal målgruppe før helga',
  gaugeIcon: 'campaign',
  tall: '~8 400', tallLabel: 'lokale i rekkevidde rundt eventet',
  cta: 'Utfør · Lag innlegg knyttet til eventet',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-lokalt-event_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-lokalt-event_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
