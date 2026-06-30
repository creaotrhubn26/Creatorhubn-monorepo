import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-ai-samtale.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  sporsmal1: 'Hvordan kan vi få flere bryllupskunder fra Instagram i sommer?',
  svar1: 'Innholdet ditt presterer best på behind-the-scenes og ekte par. Jeg foreslår tre reels i uka med karusell-oppfølging, og at vi vrir bio mot booking. Engasjementet ligger 38 % over snittet på den vinkelen.',
  sporsmal2: 'Ja, kjør på. Kan du lage en plan for de neste to ukene?',
  svar2: 'Klart! Jeg har satt opp en 14-dagers kalender med poster, beste publiseringstidspunkt og forslag til caption. Vil du at jeg planlegger den direkte i Feed-planneren?',
  innsikt1: 'Engasjement +38 %', innsikt1Farge: '#34d399',
  innsikt2: 'Beste tid: tor 19:00', innsikt2Farge: '#E1306C',
  forslag1: 'Planlegg i Feed-planneren',
  forslag2: 'Lag 14-dagers kalender',
  forslag3: 'Vis ROI-funnel'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-samtale_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-samtale_mid.png', omitBackground: true });

await browser.close();
console.log('done');
