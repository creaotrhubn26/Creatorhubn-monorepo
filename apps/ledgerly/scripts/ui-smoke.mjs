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

  console.log('UI-SMOKE OK');
  await browser.close();
  process.exit(0);
} catch (err) {
  await fail(err.message);
}
