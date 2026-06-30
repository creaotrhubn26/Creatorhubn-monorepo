import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-ai-samtykke.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brand: 'The Role Room',
  tag: 'AI-laget for innholdsprodusenter',
  eyebrow: 'Samtykke-port',
  tittel: 'Før Agenten analyserer dataene dine',
  undertekst: 'Vi trenger ditt samtykke for å behandle innholds- og engasjementsdata. Personopplysninger pseudonymiseres før de sendes til AI-modellen.',
  punkt1Tittel: 'Pseudonymisering',
  punkt1Tekst: 'Navn, e-post og telefon byttes ut med anonyme nøkler før analyse.',
  pseudoFor: 'kari.nordmann@epost.no',
  pseudoEtter: 'lead_8f3a2c',
  punkt2Tittel: 'Databehandling',
  punkt2Tekst: 'Behandles kun for å gi deg innsikt og forslag. Lagres ikke til modelltrening.',
  punkt3Tittel: 'Dine rettigheter',
  punkt3Tekst: 'Du kan trekke samtykket og slette dataene når som helst. GDPR-kompatibelt.',
  databehandler: 'Anthropic (Claude)',
  region: 'EU-region',
  godtaTekst: 'Godta og fortsett',
  fotTekst: 'Samtykket logges med tidsstempel · Versjon 2.4'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-samtykke_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-samtykke_mid.png', omitBackground: true });

await browser.close();
console.log('done');
