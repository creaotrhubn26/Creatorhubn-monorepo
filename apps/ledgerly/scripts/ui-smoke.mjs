/**
 * UI-røyktest: login → opprett org → Gmail-import → åpne bilag →
 * «Hvorfor foreslår dere dette?» → godkjenn og bokfør → rapporter.
 * Kjøres mot API-server som serverer bygget SPA.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:4315';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/ledgerly-shots';
import { mkdirSync } from 'node:fs';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const fail = async (msg) => {
  await page.screenshot({ path: `${SHOTS}/failure.png`, fullPage: true });
  console.error('FAIL:', msg);
  process.exit(1);
};

try {
  // 1. Login
  await page.goto(BASE);
  await page.fill('#email', 'ui-smoke@example.com');
  await page.fill('#name', 'UI Smoke');
  await page.click('button:has-text("Logg inn")');

  // 2. Opprett virksomhet
  await page.waitForSelector('#orgname', { timeout: 5000 });
  await page.fill('#orgname', 'UI Smoke ENK');
  await page.click('button:has-text("Opprett")');
  await page.waitForSelector('h1:has-text("Oversikt")', { timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}/01-oversikt.png`, fullPage: true });

  // 3. Gmail-import (sandbox)
  await page.click('nav button:has-text("Gmail-import")');
  await page.waitForSelector('h1:has-text("Gmail-import")');
  await page.click('button:has-text("Importer")');
  await page.waitForSelector('td:has-text("faktura-2024-1042.pdf")', { timeout: 8000 });
  const quarantined = await page.locator('span.badge:has-text("Karantene")').count();
  if (quarantined < 1) await fail('Forventet karantenemerket dokument i importresultatet');
  await page.screenshot({ path: `${SHOTS}/02-gmail-import.png`, fullPage: true });

  // 4. Åpne bilaget og se forklaringen
  await page.click('tr:has-text("faktura-2024-1042.pdf") >> nth=0');
  await page.waitForSelector('h1:has-text("faktura-2024-1042.pdf")');
  await page.click('button:has-text("Hvorfor foreslår dere dette?")');
  await page.waitForSelector('text=Regler og kilder');
  const hasSource = await page.locator('a[href*="skatteetaten.no"], a[href*="lovdata.no"]').count();
  if (hasSource < 1) await fail('Forklaringen mangler offisiell kildelenke');
  await page.screenshot({ path: `${SHOTS}/03-bilagsdetalj.png`, fullPage: true });

  // 5. Godkjenn og bokfør
  await page.click('button:has-text("Godkjenn og bokfør")');
  await page.waitForSelector('text=Bokført som bilag nr. 1', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/04-bokfort.png`, fullPage: true });

  // 6. Rapporter viser kostnaden
  await page.click('nav button:has-text("Rapporter")');
  await page.waitForSelector('h1:has-text("Rapporter")');
  await page.waitForSelector('td:has-text("6551")', { timeout: 5000 });
  const kostnad = await page.locator('.card:has-text("Kostnader") .value').textContent();
  if (!kostnad?.includes('20 000,00')) await fail(`Kostnadskortet viser feil beløp: ${kostnad}`);
  await page.screenshot({ path: `${SHOTS}/05-rapporter.png`, fullPage: true });

  // 7. MVA-skjermen viser fradrag (testdata er fra 2025)
  await page.click('nav button:has-text("MVA")');
  await page.waitForSelector('h1:has-text("MVA")');
  await page.fill('#vfrom', '2025-01-01');
  await page.fill('#vto', '2025-12-31');
  await page.waitForSelector('td:has-text("Fradragsberettiget")', { timeout: 5000 });
  const inngaaende = await page.locator('.card:has-text("Inngående MVA") .value').textContent();
  if (!inngaaende?.includes('5 000,00')) await fail(`Inngående MVA feil: ${inngaaende}`);
  await page.screenshot({ path: `${SHOTS}/06-mva.png`, fullPage: true });

  // 8. Skatt og reserver
  await page.click('nav button:has-text("Skatt og reserver")');
  await page.waitForSelector('text=Ikke medregnet');
  await page.screenshot({ path: `${SHOTS}/07-skatt.png`, fullPage: true });

  // 9. Avansert visning: posteringslinjer på bokført bilag
  await page.selectOption('#viewmode', 'advanced');
  await page.click('nav button:has-text("Bilagsinnboks")');
  await page.click('button:has-text("Bokført")');
  await page.click('tr:has-text("faktura-2024-1042.pdf") >> nth=0');
  await page.waitForSelector('h2:has-text("Postering — bilag nr. 1")', { timeout: 6000 });
  const line6551 = await page.locator('td:has-text("6551")').count();
  if (line6551 < 1) await fail('Posteringslinjene mangler konto 6551 i avansert visning');
  await page.screenshot({ path: `${SHOTS}/09-avansert-postering.png`, fullPage: true });

  // 10. Regnskapsførervisning: hovedbok, bilagsjournal, revisjonslogg
  await page.selectOption('#viewmode', 'pro');
  await page.click('nav button:has-text("Hovedbok")');
  await page.waitForSelector('h1:has-text("Hovedbok")');
  await page.fill('#glacc', '2710');
  await page.waitForSelector('td:has-text("2710")', { timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}/10-hovedbok.png`, fullPage: true });

  await page.click('nav button:has-text("Bilagsjournal")');
  await page.waitForSelector('h1:has-text("Bilagsjournal")');
  await page.click('tr.clickable >> nth=0');
  await page.waitForSelector('th:has-text("Linje")', { timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}/11-bilagsjournal.png`, fullPage: true });

  await page.click('nav button:has-text("Revisjonslogg")');
  await page.waitForSelector('text=journal_entry.posted', { timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}/12-revisjonslogg.png`, fullPage: true });

  // 11. Mobil-/filopplasting fra bilagsinnboksen
  await page.selectOption('#viewmode', 'simple');
  await page.click('nav button:has-text("Bilagsinnboks")');
  await page.waitForSelector('button:has-text("Last opp bilag")');
  const pdfBytes = Buffer.from(
    '%PDF-1.7\nElkjøp Norge AS\nKvittering\nUSB-kabel\nTotal: NOK 249,00\n%%EOF',
    'utf8',
  );
  await page.setInputFiles('input[type="file"]', {
    name: 'kvittering-elkjop.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBytes,
  });
  await page.waitForSelector('.toast', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/13-opplasting.png`, fullPage: true });

  // 12. Salg og faktura: opprett kunde + faktura, utsted, motta betaling via bank
  await page.click('nav button:has-text("Salg og faktura")');
  await page.waitForSelector('h1:has-text("Salg og faktura")');
  await page.click('button:has-text("Ny faktura")');
  await page.fill('#newcust', 'Testkunde AS');
  await page.click('button:has-text("Opprett"):near(#newcust)');
  await page.waitForFunction(() => document.querySelector('#cust')?.value !== '');
  await page.fill('#desc0', 'Konsulenttimer');
  await page.fill('#qty0', '1');
  await page.fill('#price0', '1000,00');
  await page.fill('#idate', '2025-11-21');
  await page.click('button:has-text("Utsted og bokfør")');
  await page.waitForSelector('td:has-text("Testkunde AS")', { timeout: 8000 });
  const statusBadge = await page.locator('tr:has-text("Testkunde AS") .badge').first().textContent();
  if (!statusBadge?.includes('Utstedt')) await fail(`Fakturastatus: ${statusBadge}`);
  const kidCell = await page.locator('tr:has-text("Testkunde AS") td >> nth=4').textContent();
  if (!/^\d{8,}$/.test(kidCell?.trim() ?? '')) await fail(`Ugyldig KID i lista: ${kidCell}`);
  await page.screenshot({ path: `${SHOTS}/14-faktura.png`, fullPage: true });

  // 13. Innbetaling med KID matches og markerer fakturaen betalt
  await page.click('nav button:has-text("Bank og avstemming")');
  await page.waitForSelector('h1:has-text("Bank og avstemming")');
  const hasAccountForm = await page.locator('#ba').count();
  if (hasAccountForm) {
    await page.fill('#ba', '15032512345');
    await page.click('button:has-text("Opprett")');
    await page.waitForSelector('textarea', { timeout: 5000 });
  }
  await page.fill(
    'textarea',
    `Dato;Beskrivelse;Beløp;Motpart;KID;Referanse\n2025-11-25;Innbetaling;1250,00;TESTKUNDE AS;${kidCell?.trim()};inn-ui-1`,
  );
  await page.click('button:has-text("Importer og finn treff")');
  await page.waitForSelector('td:has-text("KID")', { timeout: 8000 });
  await page.click('td button:has-text("Godkjenn")');
  await page.waitForSelector('.toast:has-text("bokført")', { timeout: 8000 });
  await page.click('nav button:has-text("Salg og faktura")');
  await page.waitForSelector('tr:has-text("Testkunde AS") .badge:has-text("Betalt")', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/15-faktura-betalt.png`, fullPage: true });

  console.log('UI-SMOKE OK');
  await browser.close();
  process.exit(0);
} catch (err) {
  await fail(err.message);
}
