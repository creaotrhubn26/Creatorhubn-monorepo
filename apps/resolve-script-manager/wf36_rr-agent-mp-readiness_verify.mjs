import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-mp-readiness.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brand: 'The Role Room',
  tag: 'AI-laget for innholdsprodusenter',
  eyebrow: 'Klar-sjekk',
  tittel: 'Klar til å generere markedsplan',
  undertekst: 'Agenten sjekker at alt er på plass før den lager planen din. Alle fire kravene må være oppfylt.',
  krav: [
    { ikon: 'link', tittel: 'Tilkoblede kontoer', tekst: 'Minst én sosial kanal må være koblet til.', verdi: '3 kanaler' },
    { ikon: 'business_center', tittel: 'Merkevareprofil', tekst: 'Tone, målgruppe og posisjonering er definert.', verdi: 'Komplett' },
    { ikon: 'insights', tittel: 'Innsiktsdata', tekst: 'Nok historikk til å finne beste tidspunkt og emner.', verdi: '90 dager' },
    { ikon: 'verified_user', tittel: 'Samtykke', tekst: 'Godkjent databehandling med pseudonymisering.', verdi: 'Godkjent' }
  ],
  statusTekst: 'Alle krav oppfylt.',
  statusUndertekst: 'Agenten er klar til å generere planen.',
  knappTekst: 'Generer markedsplan',
  fotTekst: 'Drevet av Claude · Genereres på sekunder'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mp-readiness_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mp-readiness_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mp-readiness_start.png', omitBackground: true });

await browser.close();
console.log('done');
