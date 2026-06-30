import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-merch.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  merchLabel: 'Merch-mulighet for produksjonen',
  merchName: '«Bak kamera»-hettegenser',
  merchIcon: 'checkroom',
  pill1: 'Crew-design',
  pill2: 'Print on demand',
  marginVal: '62%',
  marginLbl: 'Margin',
  insight: 'Innholdet ditt om <b>«Nattskift»</b> bygger en lojal fanbase — 3 av 5 toppkommentarer spør etter merch. En enkel hettegenser med produksjonslogoen kan kapitalisere på engasjementet før premieren.',
  tall: '34 500 kr',
  tallLabel: 'Estimert merch-omsetning',
  metricIcon: 'payments',
  trendTxt: 'ny inntekt',
  cta: 'Utfør',
  ctaIcon: 'bolt'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-merch_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-merch_mid.png', omitBackground: true });

await browser.close();
console.log('done');
