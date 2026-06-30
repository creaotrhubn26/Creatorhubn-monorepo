import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-poll.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'bar_chart',
  head: 'Kjør en <em>avstemning</em> i Story i kveld',
  pollTag: 'Story-avstemning',
  pollQ: 'Hvilken scene vil du se bak kulissene?',
  pollA: 'Lyssettingen',
  pollB: 'Kostymene',
  insightLabel: 'Agentens innsikt',
  insightIcon: 'lightbulb',
  insightVal: 'Avstemninger får følgerne til å <b>tappe</b> — og hvert svar forteller meg hva de vil se. Jeg foreslår spørsmål og publiserer til beste tidspunkt.',
  tall: '2,4×', tallLabel: 'høyere story-respons',
  cta: 'Utfør · Lag avstemning',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-poll_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-poll_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
