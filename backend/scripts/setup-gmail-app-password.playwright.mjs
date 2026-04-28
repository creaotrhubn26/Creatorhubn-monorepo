#!/usr/bin/env node
/**
 * setup-gmail-app-password.playwright.mjs
 *
 * Hybrid-script for å sette opp Gmail-mailer for CreatorHub-backend:
 *
 *   1. Åpner et synlig Chromium-vindu mot Google-app-passwords-siden
 *   2. Du logger inn manuelt (Google blokkerer scripted login)
 *   3. Du oppretter app-passord ved å fylle inn navn + klikk "Opprett"
 *   4. Script leser det 16-tegns passordet fra DOM når Google viser det
 *   5. Script skriver GMAIL_USER + GMAIL_APP_PASSWORD til Render env-vars
 *      via API → trigger automatisk redeploy
 *
 * Forutsetninger:
 *   • node 18+ (innebygd fetch)
 *   • RENDER_API_KEY satt i shell-miljø
 *   • playwright installert (npm exec --prefix frontend playwright install)
 *
 * Kjøring:
 *   GMAIL_ADDRESS=din@gmail.com node backend/scripts/setup-gmail-app-password.playwright.mjs
 *
 * Hvis du IKKE oppgir GMAIL_ADDRESS, blir den hentet fra app-passwords-siden
 * etter at du logger inn.
 */

import { chromium } from 'playwright';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const RENDER_SERVICE_ID = 'srv-d76ob60ule4c73dv2p60';
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const PROVIDED_GMAIL = process.env.GMAIL_ADDRESS;

if (!RENDER_API_KEY) {
  console.error('❌ RENDER_API_KEY mangler i miljøet. Sett den først:');
  console.error('   export RENDER_API_KEY=rnd_...');
  process.exit(1);
}

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', cyan: '\x1b[36m',
  yellow: '\x1b[33m', dim: '\x1b[2m', red: '\x1b[31m', bold: '\x1b[1m',
};

const rl = readline.createInterface({ input: stdin, output: stdout });
const ask = (q) => rl.question(`${c.cyan}? ${q}${c.reset} `);

async function main() {
  console.log(`${c.bold}${c.cyan}━━━ Gmail App Password Setup ━━━${c.reset}`);
  console.log(`${c.dim}Åpner Chromium synlig. Logg inn med Google-kontoen som skal være avsender.${c.reset}\n`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  try {
    await page.goto('https://myaccount.google.com/apppasswords', { waitUntil: 'domcontentloaded' });
    console.log(`${c.green}▸ Browser-vindu åpnet.${c.reset}`);
    console.log('');
    console.log(`${c.yellow}HVA DU GJØR I BROWSEREN:${c.reset}`);
    console.log('  1. Logg inn med Google-kontoen (kreves 2-trinns-verifisering)');
    console.log('  2. Når du lander på app-passwords-siden, fyll inn et appnavn:');
    console.log(`     ${c.bold}CreatorHub Render Backend${c.reset}`);
    console.log('  3. Klikk "Create" / "Opprett"');
    console.log('  4. Google viser et 16-tegns passord — IKKE lukk dialogen');
    console.log('');
    console.log(`${c.dim}Når app-passordet er synlig på skjermen, kom tilbake hit og trykk ENTER.${c.reset}`);

    await ask('Trykk ENTER når app-passord er synlig:');

    // Forsøk å lese passordet fra DOM
    let appPassword = null;
    try {
      // Google viser passordet enten i en <span> med 4-tegns grupper, eller i en stor tekst-boks
      const candidates = [
        'div[role="dialog"] span:has-text(" ")',
        'div[role="dialog"] strong',
        'div[aria-label*="password" i]',
        'div[aria-label*="passord" i]',
      ];
      for (const sel of candidates) {
        const found = await page.locator(sel).all().catch(() => []);
        for (const el of found) {
          const txt = (await el.textContent())?.trim() ?? '';
          // App-passord = 16 tegn, vanligvis vist som 4-grupper med space
          const cleaned = txt.replace(/\s+/g, '');
          if (/^[a-z]{16}$/i.test(cleaned)) {
            appPassword = cleaned;
            console.log(`${c.green}✓ Lest app-passord automatisk (skjult)${c.reset}`);
            break;
          }
        }
        if (appPassword) break;
      }
    } catch (e) {
      // ignore — fallback til manuell inntasting under
    }

    if (!appPassword) {
      console.log(`${c.yellow}⚠ Kunne ikke lese passord automatisk fra DOM. Skriv det inn manuelt nedenfor.${c.reset}`);
      const manualPwd = await ask('Lim inn app-passordet (16 tegn):');
      appPassword = manualPwd.replace(/\s+/g, '').trim();
      if (!/^[a-z]{16}$/i.test(appPassword)) {
        throw new Error(`Forventet 16 bokstaver, fikk: "${appPassword}"`);
      }
    }

    // Hent gmail-adressen
    let gmailAddress = PROVIDED_GMAIL;
    if (!gmailAddress) {
      try {
        // Prøv å lese profilbilde-knappens label (typisk har email)
        const profileBtn = await page.locator('a[aria-label*="@"]').first().getAttribute('aria-label').catch(() => null);
        if (profileBtn) {
          const m = profileBtn.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
          if (m) gmailAddress = m[0];
        }
      } catch {}
    }
    if (!gmailAddress) {
      gmailAddress = (await ask('Gmail-adresse for avsender (f.eks. dan@creatorhubn.com):')).trim();
    }
    if (!/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(gmailAddress)) {
      throw new Error(`Ugyldig email: ${gmailAddress}`);
    }

    console.log('');
    console.log(`${c.cyan}━━━ Render env-vars ━━━${c.reset}`);
    console.log(`  GMAIL_USER         = ${gmailAddress}`);
    console.log(`  GMAIL_APP_PASSWORD = ${'*'.repeat(16)} (16 tegn lest)`);
    console.log('');

    const confirm = await ask('Skal jeg sette disse på Render og redeploy? [Y/n]:');
    if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
      console.log(`${c.yellow}Avbryter — du kan kjøre setup på nytt senere.${c.reset}`);
      return;
    }

    // PUT env-vars (oppdaterer eksisterende eller oppretter nye)
    const setRes = await fetch(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${RENDER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          { key: 'GMAIL_USER', value: gmailAddress },
          { key: 'GMAIL_APP_PASSWORD', value: appPassword },
        ]),
      },
    );

    if (!setRes.ok) {
      // PUT replaces ALL env vars. Vi vil heller MERGE — bruk POST per nøkkel.
      console.log(`${c.dim}PUT failed (${setRes.status}), prøver POST per env-var…${c.reset}`);
      for (const [key, value] of [
        ['GMAIL_USER', gmailAddress],
        ['GMAIL_APP_PASSWORD', appPassword],
      ]) {
        const r = await fetch(
          `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars/${key}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${RENDER_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ value }),
          },
        );
        if (!r.ok) {
          const t = await r.text();
          throw new Error(`Failed to set ${key}: HTTP ${r.status} ${t.slice(0, 200)}`);
        }
        console.log(`${c.green}✓ ${key} satt${c.reset}`);
      }
    } else {
      console.log(`${c.green}✓ Begge env-vars satt på Render${c.reset}`);
    }

    // Trigger deploy
    const deployRes = await fetch(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RENDER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clearCache: 'do_not_clear' }),
      },
    );
    if (deployRes.ok || deployRes.status === 202) {
      console.log(`${c.green}✓ Render-deploy trigget${c.reset}`);
    } else {
      console.log(`${c.yellow}⚠ Deploy-trigger returnerte ${deployRes.status} — sjekk Render dashboard${c.reset}`);
    }

    console.log('');
    console.log(`${c.bold}${c.green}═══ Ferdig! ═══${c.reset}`);
    console.log(`${c.dim}Render redeploy bygges nå (~2 min). Etter at health-endepunktet rapporterer ny commit,${c.reset}`);
    console.log(`${c.dim}kan du kjøre smoke-testen for å verifisere e-post-sending.${c.reset}`);

  } catch (err) {
    console.error(`${c.red}✗ Feil:${c.reset}`, err.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await browser.close();
  }
}

main();
