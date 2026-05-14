#!/usr/bin/env node
/**
 * r2-enable-public-access.mjs
 *
 * Playwright-helper for R2 Public Access-aktivering. Bruker
 * headful Chromium så du kan logge inn + 2FA manuelt.
 *
 * Skript-strategi:
 *   1. Åpner dash.cloudflare.com
 *   2. Venter til du logger inn + navigerer til ønsket R2-bucket
 *   3. Detekterer pub-*.r2.dev-URL via DOM-polling (sjekker page-content hvert sekund)
 *   4. Skriver ut URL + kopierer til clipboard
 *
 * Kjør:
 *   node scripts/r2-enable-public-access.mjs
 *
 * Hva du må gjøre i nettleseren:
 *   1. Logg inn på Cloudflare
 *   2. Naviger til R2 → din bucket → Settings
 *   3. Aktiver "Public access" via "Allow Access" eller r2.dev-URL-toggle
 *   4. Skriptet plukker opp pub-*.r2.dev-URL automatisk
 *   5. Lukk nettleseren når URL er printet
 */

import { chromium } from 'playwright';

const TIMEOUT_MINUTES = 15;
const POLL_INTERVAL_MS = 1500;
const URL_PATTERN = /https:\/\/pub-[a-f0-9]{32}\.r2\.dev/i;

async function main() {
  console.log('Starter Cloudflare R2 Public Access-helper …');
  console.log('Et nettleservindu åpnes nå. Logg inn + naviger til bucket-en din.');
  console.log(`Skriptet venter opp til ${TIMEOUT_MINUTES} minutter på pub-*.r2.dev-URL.\n`);

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    await page.goto('https://dash.cloudflare.com/login', { waitUntil: 'domcontentloaded' });
    console.log('✓ Nettleser åpnet på Cloudflare login.');
    console.log('→ Logg inn + naviger til R2 → din bucket → Settings → "Public Access" / r2.dev-toggle.\n');

    const deadline = Date.now() + TIMEOUT_MINUTES * 60 * 1000;
    let lastUrl = '';
    let foundUrl = '';

    while (Date.now() < deadline && !foundUrl) {
      try {
        const currentUrl = page.url();
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          console.log(`  navigert til: ${currentUrl}`);
        }

        const content = await page.content();
        const match = content.match(URL_PATTERN);
        if (match) {
          foundUrl = match[0];
          break;
        }
      } catch (err) {
        // Page-state-feil ignoreres (navigasjon kan briste polling-snapshot)
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    if (!foundUrl) {
      console.error(`\n✗ Timeout etter ${TIMEOUT_MINUTES} min — fant ingen pub-*.r2.dev-URL.`);
      console.error('  Aktiver Public Access manuelt på bucket-en og kjør skriptet på nytt.');
      process.exit(1);
    }

    console.log(`\n✓ Fant Public-URL:\n  ${foundUrl}\n`);

    // Forsøk å kopiere til clipboard (macOS)
    try {
      const proc = await import('child_process').then((m) =>
        m.spawn('pbcopy', [], { stdio: ['pipe', 'inherit', 'inherit'] }),
      );
      proc.stdin.write(foundUrl);
      proc.stdin.end();
      console.log('  (kopiert til clipboard via pbcopy)\n');
    } catch {
      console.log('  (pbcopy ikke tilgjengelig — kopier manuelt over)\n');
    }

    console.log('Neste steg:');
    console.log('  1. Send denne URL-en til Claude så hen oppdaterer vercel.json + Render-env-var');
    console.log('  2. Eller bytt ut <PUB-URL> i kommandoene under selv:\n');
    console.log(`     CMS_R2_PUBLIC_URL_BASE=https://theroleroom.com/cdn   (i Render)`);
    console.log(`     # vercel.json rewrite: /cdn/(.*) → ${foundUrl}/$1\n`);
    console.log('  3. Trykk Enter her for å lukke nettleseren …');

    await new Promise((resolve) => process.stdin.once('data', resolve));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Feil:', err);
  process.exit(1);
});
