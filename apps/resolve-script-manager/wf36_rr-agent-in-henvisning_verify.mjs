import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-henvisning.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  headEyebrow: 'Vekstmulighet',
  headTitle: 'Sett opp henvisningsprogram',
  headIcon: 'group_add',
  insight: '<b>Henvisninger</b> er din billigste vekstkanal. De 23 mest fornøyde kundene dine anbefaler deg gjerne — gi dem en delbar lenke og en liten belønning, så konverterer varme henvisninger 4× bedre enn kald annonsering.',
  tall: '14',
  tallLabel: 'Estimerte henvisninger / mnd',
  metricIcon: 'trending_up',
  trendTxt: 'lav kostnad',
  cta: 'Sett opp program',
  ctaIcon: 'bolt'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-henvisning_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-henvisning_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await page.waitForTimeout(150);

await browser.close();
console.log('done');
