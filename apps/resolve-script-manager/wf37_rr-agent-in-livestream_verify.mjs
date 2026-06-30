import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-livestream.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'sensors',
  head: 'Gå live om dette temaet — <em>publikum er klart nå</em>',
  livePill: 'Live-forslag',
  viewChip: '~340 aktive nå',
  topicLbl: 'Foreslått tema',
  topic: '«Bak kulissene: <b>slik bygger vi en scene fra bunnen</b>» — spørsmål og svar live med publikum',
  chip1Txt: 'I kveld 19:00',
  chip2Txt: 'Instagram Live',
  chip3Txt: '20–25 min',
  insightLabel: 'Agentens innsikt',
  insightIcon: 'lightbulb',
  insightVal: 'Følgerne dine er mest aktive <b>på kvelden</b>, og live-spørsmål om opptak fikk høyest engasjement sist. Jeg setter opp en hendelse og varsler følgerne dine.',
  tall: '3,4×', tallLabel: 'mer rekkevidde enn vanlig innlegg',
  cta: 'Utfør · Planlegg live-sending',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-livestream_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-livestream_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
