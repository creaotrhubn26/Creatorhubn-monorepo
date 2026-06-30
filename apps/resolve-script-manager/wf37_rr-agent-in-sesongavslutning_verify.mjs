import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-sesongavslutning.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  eyebrow: 'Agent-anbefaling',
  head: 'Avslutt sesongen <em>sterkt med en finale-kampanje</em>',
  clipIcon: 'flag',
  clabel: 'Innsikt · sesongavslutning',
  src: 'Sesongen',
  dst: 'Finale-kampanje',
  cdesc: 'Engasjementet ditt topper seg de siste tre ukene før forestillingen. Jeg setter opp en nedtellings-serie på tvers av kanalene, slik at sesongen krones med fulle hus.',
  tall: '+38%',
  tallLabel: 'forventet billettløft mot forrige sesongavslutning',
  cta: 'Utfør · Start kampanje',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-sesongavslutning_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-sesongavslutning_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
