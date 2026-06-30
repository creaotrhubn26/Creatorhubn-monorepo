import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-case-study.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'auto_stories',
  head: 'Vårkampanjen ble en suksess — <em>gjør den til en case-study</em>',
  arcBeforeK: 'Før', arcBeforeV: '18 leads / mnd', arcBeforeS: 'Lav synlighet lokalt',
  arcAfterK: 'Etter', arcAfterV: '74 leads / mnd', arcAfterS: '3 nye signerte byråer',
  insightLabel: 'Agentens innsikt',
  insightIcon: 'lightbulb',
  insightVal: 'Resultatet er sterkt nok til å overbevise nye kunder. Jeg samler tall, sitater og før/etter i en <b>delbar case-study</b> du kan bruke i salg og på nettsiden.',
  tall: '312 %', tallLabel: 'vekst i henvendelser etter kampanjen',
  cta: 'Utfør · Lag case-study',
  foot: 'Du godkjenner før noe publiseres — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
const injected = '<script>window.__CFG__=' + JSON.stringify(CFG) + ';<\/script>\n' + html;
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-case-study_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-case-study_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
