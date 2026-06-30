import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-ab-test.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'science',
  head: 'Test to varianter — <em>finn vinneren som konverterer</em>',
  aLabel: 'Nåværende',
  aLine: '«Book et uforpliktende møte om innholdsproduksjon.»',
  aMetric: 'Klikkrate', aVal: '2,1%', aPct: 49,
  bLabel: 'Agentens variant',
  bLine: '«Få en ferdig innholdsplan på 48 timer — helt gratis.»',
  bMetric: 'Klikkrate', bVal: 'est. 4,3%', bPct: 100,
  winCrown: 'Favoritt',
  statIcon: 'trending_up',
  tall: '+38%', tallLabel: 'forventet løft i konvertering',
  insightLabel: 'Agentens innsikt',
  insightVal: 'Variant B lover et <b>konkret resultat</b> med tidsramme. Jeg deler trafikken <b>50/50</b> i 5 dager og kårer vinneren automatisk.',
  cta: 'Utfør · Start A/B-test',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-ab-test_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-ab-test_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
