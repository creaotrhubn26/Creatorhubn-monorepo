import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-ai-verktoy.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  intro: 'Jeg har klargjort et innlegg basert på markedsplanen din. Se gjennom detaljene og trykk «Bekreft» når du er klar – så publiserer jeg.',
  verktoy: 'Publiser Reel',
  ikon: 'campaign',
  kanal: 'Instagram',
  felt1: 'Innholdstype', verdi1: 'Reel · 9:16 · 22 sek',
  felt2: 'Publiseres', verdi2: 'I dag kl. 18:30',
  felt3: 'Annonsebudsjett', verdi3: '450 kr',
  felt1ikon: 'category', felt2ikon: 'schedule', felt3ikon: 'payments',
  konsekvens: 'Dette publiserer til <b>3 412 følgere</b> og kan ikke angres etter publisering.',
  bekreft: 'Bekreft og kjør',
  avbryt: 'Avbryt'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
const injected = '<script>window.__CFG__=' + JSON.stringify(CFG) + ';</' + 'script>\n' + html;
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-verktoy_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-verktoy_mid.png', omitBackground: true });

await browser.close();
console.log('done');
