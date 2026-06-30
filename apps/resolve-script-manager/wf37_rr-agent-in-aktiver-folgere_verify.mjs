import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-aktiver-folgere.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  live: 'Live innsikt',
  eyebrow: 'Agent-anbefaling',
  head: 'Mange følgere er stille — <em>vekk dem til live</em>',
  insightLabel: 'Agentens innsikt',
  insightIcon: 'groups',
  insightVal: 'En stor andel av følgerne dine har ikke <b>likt eller kommentert</b> på over 60 dager. De kjenner deg allerede — en målrettet <b>«vi savner deg»-story</b> med spørreklistremerke er den raskeste veien til ny aktivitet.',
  audLabel: 'Følgeraktivitet siste 60 dager',
  legendQuiet: 'Stille følgere',
  legendActive: 'Aktive nå',
  recoIcon: 'bolt',
  tall: '12 400', tallLabel: 'stille følgere klare til å aktiveres',
  cta: 'Utfør · Aktiver følgere',
  foot: 'Du godkjenner story-utkastet før det publiseres — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
const injected = '<script>window.__CFG__=' + JSON.stringify(CFG) + ';<\/script>\n' + html;
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-aktiver-folgere_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-aktiver-folgere_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
