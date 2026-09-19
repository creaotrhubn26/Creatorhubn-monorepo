#!/usr/bin/env node
/**
 * Google OAuth verification screencast: CreatorHub Norge (prosjekt
 * `creatorhubn-com`).
 *
 * Google avviste verifiseringen 2026-08-14 på to punkter. Personvern-
 * erklæringen er løst (PR #2428). Dette skriptet dekker det andre kravet:
 * en video som viser samtykkeflyten med gjeldende scopes, og at de
 * restricted scopene faktisk brukes i produktet.
 *
 * Krav verifisert mot kilde, ikke hukommelse:
 *
 * - Konsollen (Data Access → Demo video) sier: «Note: The unverified app
 *   screen will appear for your test account. This is expected and must be
 *   shown in the video.» Skriptet pauser derfor der i stedet for å klikke
 *   forbi.
 * - support.google.com/cloud/answer/13804565 krever i tillegg: hele
 *   OAuth-samtykkeflyten, komplett samtykkeskjerm med NØYAKTIG de scopene
 *   vi ber om, språkvelgeren nederst til venstre satt til English, hver
 *   forespurte scope demonstrert i bruk, og fortellerstemme (tale eller
 *   tekst) som peker på hvor kravene oppfylles. Skjermteksten i dette
 *   skriptet dekker tekst-varianten.
 *
 * Videoen dekker:
 *   1. Tittelkort: app, prosjekt-ID, hva som demonstreres
 *   2. Innlogget testbruker på creatorhubn.com/workspace
 *   3. «Kom i gang»-sjekklisten → «Verktøy koblet» → start tilkobling
 *   4. Uverifisert-app-skjermen (operatør: la den stå, ikke klikk forbi)
 *   5. Googles samtykkeskjerm med scope-listen (operatør: scroll gjennom)
 *   6. Tilbake i CreatorHub: tilkoblet konto vises
 *   7. Drive    — åpne/skrive prosjektfil        (drive, drive.readonly, …)
 *   8. Gmail    — kundesvar i prosjekttråden     (gmail.readonly, gmail.compose)
 *   9. Chat     — statusoppdatering i prosjektrom (chat.messages, …readonly)
 *  10. Sluttkort: Limited Use-erklæring
 *
 * Steg 4-5 og 7-9 er operatør-styrte. Skriptet legger på skjermtekst som
 * forteller hva som skal gjøres, og venter til du trykker ENTER i
 * terminalen. Skjermteksten blir samtidig fortellerstemmen for reviewer.
 *
 * Bruk:
 *   node backend/scripts/record-google-oauth-verification-demo.playwright.mjs
 *
 * ANBEFALT: kjør mot lokalt miljø, ikke produksjon.
 *
 * Konsollen sier selv: «If your app is already public, do not deploy
 * unverified scopes to your production traffic ... use a staging
 * environment or hidden test route.» Lokalt gir i tillegg rene demodata,
 * så ekte kundeinnhold ikke havner i en video som går til Google og
 * YouTube.
 *
 * Samtykkeskjermen blir identisk lokalt: den drives av client ID og
 * prosjekt, ikke av origin. Samme CREATORHUB_GOOGLE_CLIENT_ID gir samme
 * appnavn, samme branding og nøyaktig de samme scopene.
 *
 *   cd backend  && npm run dev          # 3003 (standard)
 *   cd frontend && npm run dev          # 5001, proxyer /api → 3003
 *
 * Redirect-URI-en lokalt er http://localhost:5001/api/creatorhub/google/
 * oauth/callback: Google sender nettleseren til frontend-porten, og Vite
 * proxyer /api videre til backend. backend/.env har allerede denne verdien
 * i CREATORHUB_GOOGLE_REDIRECT_URI, og resolveGoogleWorkspaceRedirectUri()
 * lar en konfigurert localhost-URI vinne. Den må stå i Authorized redirect
 * URIs på OAuth-klienten, ellers feiler samtykket med redirect_uri_mismatch.
 *
 *   APP_BASE_URL=http://localhost:5001 \
 *     node backend/scripts/record-google-oauth-verification-demo.playwright.mjs
 *
 * Backend trenger de ekte CREATORHUB_GOOGLE_CLIENT_ID og _CLIENT_SECRET
 * lokalt for at samtykkeskjermen skal bli riktig. De ligger i Render —
 * legg dem i en lokal .env, aldri i repoet.
 *
 * Logg inn i CreatorHub med e-post/passord lokalt, ikke Google Sign-In:
 * registrert JS-origin er localhost:5002, mens frontend dev kjører på
 * 5001. Workspace-tilkoblingen er server-side redirect og bryr seg ikke
 * om JS-origin, men Google Sign-In gjør det.
 *
 * Env (leses fra backend/.env.google-verification.demo.local hvis den finnes):
 *   APP_BASE_URL        default: https://creatorhubn.com
 *                       lokalt:  http://localhost:5001
 *   DEMO_PROJECT_ID     prosjekt med Drive-filer, Gmail-tråd og Chat-rom
 *
 * USE_USER_CHROME=1: bruk din installerte Chrome-profil (testbrukeren må
 * være innlogget der). Chrome må være HELT avsluttet (cmd+Q) først, ellers
 * feiler det med «profile locked».
 *
 * Output: recordings/google-oauth-verification-demo-<ts>.webm
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VIDEO_DIR = path.resolve(REPO_ROOT, 'recordings');
const ENV_FILE = path.resolve(REPO_ROOT, 'backend/.env.google-verification.demo.local');
const DEFAULT_APP_BASE = 'https://creatorhubn.com';
const HEADLESS = process.env.HEADLESS === '1';
const USE_USER_CHROME = process.env.USE_USER_CHROME === '1';
const USER_CHROME_PROFILE =
  process.env.USER_CHROME_PROFILE || path.join(process.env.HOME || '', 'Library/Application Support/Google/Chrome');
const USER_CHROME_PROFILE_DIR = process.env.USER_CHROME_PROFILE_DIR || 'Default';
const VIEWPORT = { width: 1440, height: 900 };

const rl = readline.createInterface({ input, output });
const ask = (q) => rl.question(q);

function log(msg) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadEnv() {
  const out = {
    APP_BASE_URL: process.env.APP_BASE_URL || DEFAULT_APP_BASE,
    DEMO_PROJECT_ID: process.env.DEMO_PROJECT_ID || '',
  };
  try {
    const raw = await fs.readFile(ENV_FILE, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (out[k] !== undefined && !out[k]) out[k] = v.replace(/^['"]|['"]$/g, '').trim();
    }
  } catch {}
  return out;
}

async function beat(page, ms = 1500) {
  await page.waitForTimeout(ms);
}

// ── Skjermgrafikk ─────────────────────────────────────────────────────────
// Samme mønster som Meta App Review-skriptene, men i CreatorHub-oransje
// i stedet for Meta-lilla.

async function installStyles(page) {
  await page.addStyleTag({
    content: `
      #gv-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 32px; transform: translateX(-50%);
        min-width: 520px; max-width: 1080px;
        padding: 18px 28px;
        background: rgba(20, 12, 2, 0.94);
        border: 1.5px solid rgba(255, 140, 0, 0.6);
        border-radius: 14px;
        color: #fff5e8;
        font: 700 22px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        opacity: 0; transition: opacity 420ms ease;
        pointer-events: none;
      }
      #gv-caption.show { opacity: 1; }
      #gv-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em;
        color: #ffb066;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #gv-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: linear-gradient(135deg, rgba(120, 53, 15, 0.97), rgba(180, 83, 9, 0.97));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #fff7ed; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #gv-title.show { opacity: 1; }
      #gv-title h1 { font-size: 46px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #gv-title h2 { font-size: 21px; font-weight: 500; margin: 0 0 8px; color: #fed7aa; }
      #gv-title p  { font-size: 18px; font-weight: 400; max-width: 820px; color: #ffedd5; margin: 24px 16px 0; line-height: 1.55; }
      #gv-title code { background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px; font-size: 16px; }
      .gv-spot {
        outline: 3px solid #ff8c00 !important;
        outline-offset: 6px;
        border-radius: 12px !important;
        box-shadow: 0 0 0 8px rgba(255, 140, 0, 0.32) !important;
        animation: gvPulse 1.8s ease-in-out infinite;
      }
      @keyframes gvPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(255,140,0,0.32) !important; }
        50%     { box-shadow: 0 0 0 16px rgba(255,140,0,0.12) !important; }
      }
    `,
  });
}

async function showTitleCard(page, { title, subtitle, body }) {
  await page.evaluate(({ title, subtitle, body }) => {
    let el = document.getElementById('gv-title');
    if (!el) { el = document.createElement('div'); el.id = 'gv-title'; document.body.appendChild(el); }
    el.innerHTML = `<h2>${subtitle}</h2><h1>${title}</h1><p>${body}</p>`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
}

async function hideTitleCard(page) {
  await page.evaluate(() => {
    const el = document.getElementById('gv-title');
    if (el) { el.classList.remove('show'); setTimeout(() => el.remove(), 520); }
  });
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('gv-caption');
    if (!el) { el = document.createElement('div'); el.id = 'gv-caption'; document.body.appendChild(el); }
    el.innerHTML = `<span class="step">${step}</span>${text}`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { step, text });
}

async function hideCaption(page) {
  await page.evaluate(() => {
    const el = document.getElementById('gv-caption');
    if (el) el.classList.remove('show');
  });
}

async function spotlight(page, selector) {
  await page.evaluate((selector) => {
    document.querySelectorAll('.gv-spot').forEach((el) => el.classList.remove('gv-spot'));
    const target = document.querySelector(selector);
    if (target) target.classList.add('gv-spot');
  }, selector);
}

async function removeSpotlight(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.gv-spot').forEach((el) => el.classList.remove('gv-spot'));
  });
}

/**
 * Operatør-styrt steg. Legger på skjermtekst (som blir fortellerstemmen for
 * reviewer), og venter til operatøren trykker ENTER i terminalen.
 *
 * Caption-en legges bare på når siden er en CreatorHub-side. På Googles egne
 * samtykkesider kan vi ikke injisere noe — der står instruksjonen i
 * terminalen alene, og skjermbildet viser Googles uendrede skjerm. Det er
 * poenget: reviewer skal se Googles skjerm nøyaktig som den er.
 */
async function operatorStep(page, { step, caption, terminal, canInject = true }) {
  if (canInject && caption) {
    try {
      await installStyles(page);
      await showCaption(page, step, caption);
    } catch {
      // Siden kan ha navigert midt i — ikke la skjermtekst stoppe opptaket.
    }
  }
  log('');
  log(`── ${step} ─────────────────────────────`);
  log(terminal);
  await ask('   Trykk ENTER når du er ferdig med dette steget… ');
  if (canInject && caption) {
    try { await hideCaption(page); } catch {}
  }
}

async function runDemo(page, env) {
  const base = env.APP_BASE_URL.replace(/\/$/, '');

  log(`Åpner ${base}/workspace`);
  await page.goto(`${base}/workspace`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await installStyles(page);

  // ── 1. Tittelkort ──────────────────────────────────────────────────────
  await showTitleCard(page, {
    subtitle: 'CreatorHub Norge · Google OAuth verification',
    title: 'Google Workspace access — consent and use',
    body: 'Google Cloud project <code>creatorhubn-com</code>. This recording shows a user granting CreatorHub access to their own Google account, and the three restricted scope groups being used: Drive, Gmail and Google Chat. Every scope is granted per user, by that user, for data in their own account.',
  });
  await beat(page, 6000);
  await hideTitleCard(page);
  await beat(page, 800);

  // ── 2-3. Start tilkoblingen fra «Kom i gang»-sjekklisten ───────────────
  await operatorStep(page, {
    step: 'Step 1',
    caption: 'A signed-in CreatorHub user starts the Google Workspace connection from the onboarding checklist',
    terminal:
      'Vis dashbordet med «Kom i gang»-sjekklisten, og klikk på «Verktøy koblet»-steget\n'
      + '   slik at tilkoblingen starter. Ikke fullfør Google-skjermen ennå.',
  });

  // ── 4. Uverifisert-app-skjermen ────────────────────────────────────────
  // Googles egne sider kan vi ikke injisere skjermtekst på.
  await operatorStep(page, {
    step: 'Step 2',
    canInject: false,
    terminal:
      'Googles UVERIFISERT-APP-skjerm skal nå vises. LA DEN STÅ i minst 5 sekunder.\n'
      + '   Google krever eksplisitt at denne skjermen er med i videoen.\n'
      + '   Klikk deretter «Advanced» → «Go to creatorhubn.com (unsafe)».',
  });

  // ── 5. Samtykkeskjermen med scope-listen ───────────────────────────────
  await operatorStep(page, {
    step: 'Step 3',
    canInject: false,
    terminal:
      'Samtykkeskjermen viser nå scopene.\n'
      + '   1) SJEKK SPRÅKVELGEREN nede til venstre — den MÅ stå på English.\n'
      + '      Google avviser videoer der samtykkeskjermen ikke er på engelsk.\n'
      + '   2) SCROLL SAKTE gjennom hele listen slik at Drive-, Gmail- og\n'
      + '      Chat-tilgangene er lesbare. Scopene må matche nøyaktig de vi ber om.\n'
      + '   3) Godkjenn deretter.',
  });

  // ── 6. Tilbake i produktet ─────────────────────────────────────────────
  await operatorStep(page, {
    step: 'Step 4',
    caption: 'Back in CreatorHub: the connected Google account is shown, and the user can revoke access at any time',
    terminal:
      'Vent til du er tilbake i CreatorHub og tilkoblingen viser tilkoblet konto.\n'
      + '   Vis kontoen som er koblet til.',
  });

  // ── 7. Drive ───────────────────────────────────────────────────────────
  await operatorStep(page, {
    step: 'Step 5 · Drive',
    caption:
      'drive / drive.readonly — CreatorHub opens the footage and documents the user selected for this project, '
      + 'and writes approved deliverables back into their own Drive',
    terminal:
      'Åpne prosjektet og vis Drive-flaten: en fil brukeren selv har pekt ut åpnes,\n'
      + '   og en godkjent leveranse skrives tilbake til deres egen Drive.\n'
      + `   ${env.DEMO_PROJECT_ID ? `Prosjekt: ${env.DEMO_PROJECT_ID}` : 'Ingen DEMO_PROJECT_ID satt — naviger manuelt.'}`,
  });

  // ── 8. Gmail ───────────────────────────────────────────────────────────
  await operatorStep(page, {
    step: 'Step 6 · Gmail',
    caption:
      'gmail.readonly / gmail.compose — only replies whose In-Reply-To matches a Message-ID CreatorHub itself sent '
      + 'are fetched into the project thread. No other mail is read.',
    terminal:
      'Åpne prosjekt-chatten. Send en melding fra brukerens egen Gmail-adresse,\n'
      + '   og vis at kundens svar dukker opp i samme prosjekttråd ved refresh.\n'
      + '   Vis gjerne at et utkast opprettes i Gmail før sending.',
  });

  // ── 9. Google Chat ─────────────────────────────────────────────────────
  await operatorStep(page, {
    step: 'Step 7 · Chat',
    caption:
      'chat.messages / chat.messages.readonly — the project mirrors its client conversation into a Google Chat space '
      + 'the user owns. No other spaces are accessed.',
    terminal:
      'Vis Google Chat-fanen: post en statusoppdatering i prosjektets eget rom,\n'
      + '   og vis at meldingene i det samme rommet leses tilbake inn i prosjektpanelet.',
  });

  // ── 10. Sluttkort ──────────────────────────────────────────────────────
  await installStyles(page);
  await showTitleCard(page, {
    subtitle: 'CreatorHub Norge · Limited Use',
    title: 'Limited Use compliance',
    body: "CreatorHub Norge's use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. Data is never sold, never used for advertising, and never used to develop, improve or train generalised AI or ML models. Full policy: creatorhubn.com/privacy-policy",
  });
  await beat(page, 7000);
  await hideTitleCard(page);
  await beat(page, 800);
}

async function openBrowser() {
  if (USE_USER_CHROME) {
    log(`Bruker eksisterende Chrome-profil: ${USER_CHROME_PROFILE} (profile-directory=${USER_CHROME_PROFILE_DIR})`);
    log('MERK: Chrome må være HELT avsluttet (cmd+Q) først, ellers feiler dette med «profile locked».');
    const context = await chromium.launchPersistentContext(USER_CHROME_PROFILE, {
      headless: HEADLESS,
      channel: 'chrome',
      args: [
        '--no-sandbox',
        `--profile-directory=${USER_CHROME_PROFILE_DIR}`,
        '--disable-blink-features=AutomationControlled',
      ],
      locale: 'en-US',
      viewport: VIEWPORT,
      recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
    });
    return { context, browser: null, ownsBrowser: false };
  }
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: VIEWPORT,
    recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
  });
  return { context, browser, ownsBrowser: true };
}

/**
 * Sjekker at målet svarer før vi starter opptaket. Uten dette bruker man
 * et helt take på å oppdage at dev-serveren ikke kjører.
 */
async function preflight(env) {
  const base = env.APP_BASE_URL.replace(/\/$/, '');
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base);

  // «Noe svarer» er ikke godt nok. På macOS squatter AirPlay Receiver på
  // port 5000 og svarer 403 med Server: AirTunes — og en hvilken som helst
  // annen dev-server kan sitte på 5001. Begge ga falskt grønt lys her
  // 2026-09-19. Preflighten sjekker derfor at det faktisk er CreatorHub.
  let reachable = false;
  try {
    const res = await fetch(base, { redirect: 'follow' });
    const server = res.headers.get('server') || '';
    const body = await res.text().catch(() => '');
    const looksLikeCreatorHub = /CreatorHub/i.test(body);
    reachable = (res.ok || res.status < 500) && looksLikeCreatorHub;
    log(`Preflight: ${base} svarer ${res.status}${server ? ` (Server: ${server})` : ''}`);
    if (!looksLikeCreatorHub) {
      log(`Preflight: ${base} svarer, men innholdet er IKKE CreatorHub.`);
      if (/AirTunes/i.test(server)) {
        log('           Server-headeren sier AirTunes — det er macOS AirPlay Receiver.');
      }
    }
  } catch (err) {
    log(`Preflight: ${base} svarer IKKE (${err.message})`);
  }

  if (!reachable) {
    log('');
    log('Målet svarer ikke. Start miljøet først:');
    if (isLocal) {
      log('  cd backend  && PORT=5000 npm run dev     # 5000 er registrert redirect-URI');
      log('  cd frontend && npm run dev               # 5001');
    } else {
      log(`  Sjekk at ${base} er oppe.`);
    }
    return false;
  }

  if (!isLocal) {
    log('');
    log('ADVARSEL: du tar opp mot PRODUKSJON.');
    log('Konsollen anbefaler staging/lokalt for demo-opptak, og produksjons-');
    log('prosjekter inneholder ekte kundedata som da havner i videoen.');
  } else {
    // Redirect-URI-en på OAuth-klienten er hardkodet til port 5000. Kjører
    // backend et annet sted, feiler samtykket med redirect_uri_mismatch
    // først ETTER at operatøren har gått gjennom halve opptaket.
    let backendOk = false;
    let backendNote = 'ingenting svarer';
    try {
      const res = await fetch(`${base}/api/creatorhub/google/status`, { redirect: 'manual' });
      const ctype = res.headers.get('content-type') || '';
      if (/json/i.test(ctype)) {
        backendOk = true;
        log(`Preflight: backend nås via ${base}/api (${res.status}, JSON) ✓`);
      } else {
        backendNote = `${base}/api svarer ${res.status} med content-type ${ctype || 'ukjent'} — Vite-proxyen når ikke backend`;
      }
    } catch (err) {
      backendNote = `${base}/api svarer ikke (${err.message})`;
    }

    if (!backendOk) {
      log('');
      log(`ADVARSEL: ${backendNote}.`);
      log('Start backend: cd backend && npm run dev   (standard port 3003)');
      log('Vite proxyer /api dit fra 5001.');
      log('');
      log('Redirect-URI-en lokalt er');
      log(`  ${base}/api/creatorhub/google/oauth/callback`);
      log('Den MÅ stå i Authorized redirect URIs på OAuth-klienten, ellers');
      log('feiler samtykket med redirect_uri_mismatch midt i opptaket.');
    }
  }
  return true;
}

async function main() {
  const env = await loadEnv();
  log('Google OAuth verification screencast');
  log(`  APP_BASE_URL:    ${env.APP_BASE_URL}`);
  log(`  DEMO_PROJECT_ID: ${env.DEMO_PROJECT_ID || '(ingen — naviger manuelt)'}`);
  log(`  Modus:           ${USE_USER_CHROME ? 'systemets Chrome' : 'medfølgende Chromium'}`);
  log('');
  await preflight(env);
  log('');
  log('Sjekkliste før du starter:');
  log('  • Nettleserens språk står på engelsk (samtykkeskjermen MÅ være på engelsk)');
  log('  • Du er logget inn i CreatorHub med en konto som har rene demodata');
  log('  • Prosjektet har en Drive-fil, en Gmail-tråd og et Chat-rom å vise');
  await ask('Trykk ENTER for å starte opptaket… ');

  await ensureDir(VIDEO_DIR);
  const bundle = await openBrowser();
  const page = bundle.context.pages()[0] || (await bundle.context.newPage());
  try {
    await runDemo(page, env);
    log('✓ Opptak ferdig');
  } catch (err) {
    console.error('Opptaket feilet:', err);
    process.exitCode = 1;
  } finally {
    rl.close();
    await page.close().catch(() => {});
    await bundle.context.close().catch(() => {});
    if (bundle.ownsBrowser && bundle.browser) await bundle.browser.close().catch(() => {});
  }

  try {
    const files = (await fs.readdir(VIDEO_DIR)).filter((f) => f.endsWith('.webm'));
    const stats = await Promise.all(
      files.map(async (f) => {
        try { return { f, t: (await fs.stat(path.join(VIDEO_DIR, f))).mtimeMs }; }
        catch { return { f, t: 0 }; }
      }),
    );
    stats.sort((a, b) => b.t - a.t);
    if (stats.length) {
      const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
      const stableName = `google-oauth-verification-demo-${ts}.webm`;
      await fs.rename(path.join(VIDEO_DIR, stats[0].f), path.join(VIDEO_DIR, stableName));
      log(`→ recordings/${stableName}`);
      log('Konverter til mp4 før opplasting til YouTube:');
      log(`  ffmpeg -i recordings/${stableName} -c:v libx264 -crf 20 -pix_fmt yuv420p recordings/upload/google-oauth-verification.mp4`);
    }
  } catch {}
}

main();
