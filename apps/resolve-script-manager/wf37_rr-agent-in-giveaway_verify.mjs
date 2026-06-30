import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-giveaway.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  gvLabel: 'Foreslått kampanje',
  gvTitle: 'Kjør en konkurranse for vekst',
  giftIcon: 'redeem',
  mech1: 'Lik & følg',
  mech2: 'Tagg 2 venner',
  mech3: '7 dager',
  insight: 'Engasjementet ditt har flatet ut de siste ukene. En <b>konkurranse</b> med lavterskel-deltakelse («følg, lik og tagg to venner») er den raskeste måten å skape ny vekst på akkurat nå. Agenten anslår en kraftig økning i rekkevidde og nye følgere før helgen.',
  tall: '3 200',
  tallLabel: 'Estimert nye følgere',
  metricIcon: 'group_add',
  trendTxt: '+ rekkevidde',
  cta: 'Utfør',
  ctaIcon: 'bolt'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
const injected = html.replace('<script>', '<script>window.__CFG__=' + JSON.stringify(CFG) + ';</script>\n<script>');
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-giveaway_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-giveaway_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
