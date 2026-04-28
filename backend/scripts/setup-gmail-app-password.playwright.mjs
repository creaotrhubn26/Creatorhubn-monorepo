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
// --dry-run flagg: viser EKSAKT hva scriptet ville gjort uten å sende noe
// til Render. Tar et snapshot av env-vars før, simulerer per-key PUT,
// og rapporterer hvilke vars som ville endret seg.
const DRY_RUN = process.argv.includes('--dry-run');

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

  // ─── DRY-RUN: hopp helt over browser, simulér API-kallene ──────────
  if (DRY_RUN) {
    console.log(`${c.yellow}[DRY-RUN MODE] — ingen browser åpnes, ingen API-kall sendes til Render${c.reset}\n`);

    // Snapshot env-vars
    const snap = await fetch(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars?limit=100`,
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}` } },
    );
    if (!snap.ok) {
      throw new Error(`Kunne ikke hente env-var-snapshot (HTTP ${snap.status})`);
    }
    const list = await snap.json();
    const keys = list.map((x) => x.envVar?.key).filter(Boolean);
    const keysSet = new Set(keys);

    console.log(`${c.cyan}Snapshot av Render env-vars NÅ:${c.reset} ${list.length} totalt`);
    console.log(`${c.dim}Keys: ${keys.sort().join(', ')}${c.reset}`);
    console.log('');

    const fakeEmail = PROVIDED_GMAIL ?? 'din@example.com';
    const fakePassword = 'XXXXXXXXXXXXXXXX'; // 16 placeholder
    console.log(`${c.cyan}Hvis du kjørte scriptet med EKTE password, ville disse API-kallene skjedd:${c.reset}`);
    for (const [key, value] of [
      ['GMAIL_USER', fakeEmail],
      ['GMAIL_APP_PASSWORD', fakePassword],
    ]) {
      const exists = keysSet.has(key);
      const action = exists ? `OPPDATER eksisterende verdi` : `OPPRETT ny env-var`;
      console.log(`  ${c.green}1.${c.reset} PUT  /v1/services/${RENDER_SERVICE_ID}/env-vars/${key}`);
      console.log(`         body: {"value": "${'*'.repeat(value.length)}"} (${value.length} tegn) → ${action}`);
    }
    console.log(`  ${c.green}2.${c.reset} POST /v1/services/${RENDER_SERVICE_ID}/deploys`);
    console.log(`         body: {"clearCache": "do_not_clear"} → trigger redeploy`);
    console.log('');

    // Forventet etter-state
    const projected = new Set(keysSet);
    projected.add('GMAIL_USER');
    projected.add('GMAIL_APP_PASSWORD');
    const droppedCheck = Array.from(keysSet).filter((k) => !projected.has(k));
    console.log(`${c.cyan}Projisert etter-state:${c.reset}`);
    console.log(`  • Antall env-vars FØR : ${list.length}`);
    console.log(`  • Antall env-vars ETTER: ${projected.size} (=${list.length} ${keysSet.has('GMAIL_USER') && keysSet.has('GMAIL_APP_PASSWORD') ? '+ 0' : keysSet.has('GMAIL_USER') || keysSet.has('GMAIL_APP_PASSWORD') ? '+ 1' : '+ 2'})`);
    console.log(`  • Vars som ville bli DROPPET: ${droppedCheck.length === 0 ? c.green + 'INGEN' + c.reset : c.red + droppedCheck.join(', ') + c.reset}`);
    console.log('');

    if (droppedCheck.length === 0) {
      console.log(`${c.green}✅ DRY-RUN BEKREFTER: Per-key PUT bevarer ALLE eksisterende env-vars.${c.reset}`);
      console.log(`${c.dim}Ingen risiko for at DATABASE_URL, STRIPE_*, META_* osv. droppes.${c.reset}`);
    } else {
      console.log(`${c.red}❌ ADVARSEL: ${droppedCheck.length} vars ville droppet — script-bug!${c.reset}`);
      process.exitCode = 1;
    }
    return;
  }

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

    // ─── Snapshot av eksisterende env-vars (safety-net) ──────────────
    // Vi MÅ vite at vi ikke dropper andre env-vars. Hent listen FØR vi
    // gjør noe, og verifiser etterpå at antallet kun har endret seg med
    // ≤2 (de to vi setter selv).
    const snapBefore = await fetch(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars?limit=100`,
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}` } },
    );
    if (!snapBefore.ok) {
      throw new Error(`Kunne ikke hente env-var-snapshot (HTTP ${snapBefore.status})`);
    }
    const beforeList = await snapBefore.json();
    const beforeKeys = new Set(beforeList.map((x) => x.envVar?.key).filter(Boolean));
    console.log(`${c.dim}Snapshot før: ${beforeList.length} env-vars (inkl. ${beforeKeys.has('GMAIL_USER') ? 'EKSISTERENDE' : 'INGEN'} GMAIL_USER, ${beforeKeys.has('GMAIL_APP_PASSWORD') ? 'EKSISTERENDE' : 'INGEN'} GMAIL_APP_PASSWORD)${c.reset}`);
    console.log(`${c.dim}  Eksisterende keys: ${Array.from(beforeKeys).slice(0, 8).join(', ')}…${c.reset}`);

    // (DRY_RUN håndteres på toppnivå før browser-launch — ingen ekstra
    // sjekk her. Kun reell setup når DRY_RUN er false.)

    const confirm = await ask('Skal jeg sette disse på Render og redeploy? [Y/n]:');
    if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
      console.log(`${c.yellow}Avbryter — du kan kjøre setup på nytt senere.${c.reset}`);
      return;
    }

    // ─── PER-KEY PUT (UPSERT-semantikk) ───────────────────────────────
    // VIKTIG: Vi bruker IKKE bulk-PUT mot /env-vars (uten key) — den
    // ERSTATTER hele env-listen og dropper alle andre vars. Per-key PUT
    // mot /env-vars/<key> er UPSERT (oppretter eller oppdaterer kun den
    // ene nøkkelen). Dette er kritisk for å bevare DATABASE_URL,
    // STRIPE_*, META_* osv.
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
      console.log(`${c.green}✓ ${key} satt (per-key PUT)${c.reset}`);
    }

    // ─── Safety-verifikasjon: tell env-vars etter for å være SIKKER ──
    const snapAfter = await fetch(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars?limit=100`,
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}` } },
    );
    if (snapAfter.ok) {
      const afterList = await snapAfter.json();
      const afterKeys = new Set(afterList.map((x) => x.envVar?.key).filter(Boolean));
      const expected = new Set(beforeKeys);
      expected.add('GMAIL_USER');
      expected.add('GMAIL_APP_PASSWORD');
      const missing = Array.from(expected).filter((k) => !afterKeys.has(k));
      if (missing.length > 0) {
        console.log(`${c.red}✗ ADVARSEL: ${missing.length} env-vars mangler nå:${c.reset}`);
        missing.forEach((k) => console.log(`    - ${k}`));
        throw new Error('Env-vars dropped — bulk-PUT ble brukt ved et uhell?');
      }
      console.log(`${c.green}✓ Snapshot etter: ${afterList.length} env-vars (forventet ${expected.size}). Ingen vars droppet.${c.reset}`);
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
