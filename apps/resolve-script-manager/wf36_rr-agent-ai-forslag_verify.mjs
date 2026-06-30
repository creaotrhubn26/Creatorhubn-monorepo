import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-ai-forslag.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Foreslåtte prompts',
  head: 'Hva vil du jobbe med?',
  sub: 'Velg et forslag, så setter jeg i gang — eller skriv ditt eget spørsmål.',
  secLabel: 'Forslag til deg',
  forslag1: 'Hva mangler i briefen?', meta1: 'Jeg sjekker briefen for hull før vi går videre', ikon1: 'fact_check',
  forslag2: 'Lag en kampanjeplan for høsten', meta2: '30-dagers innholdsplan med beste publiseringstider', ikon2: 'campaign',
  forslag3: 'Hvem er målgruppen min?', meta3: 'Segmentér følgerne og løft frem de varme leadene', ikon3: 'groups',
  forslag4: 'Hvordan presterer jeg på social?', meta4: 'Innsikt på tvers av Instagram, TikTok og LinkedIn', ikon4: 'insights',
  placeholder: 'Spør Agenten om hva som helst …'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-forslag_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-forslag_mid.png', omitBackground: true });

await browser.close();
console.log('done');
