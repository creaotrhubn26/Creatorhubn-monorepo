#!/usr/bin/env node
/**
 * Registers an iOS OAuth 2.0 Client ID in a Google Cloud project so
 * the CaptureApp (CreatorHub One) can run native Google sign-in via
 * ``GoogleOAuthCoordinator``. Mirrors the pattern of the Meta
 * Playwright helpers (fetch-meta-credentials, configure-meta-redirect-uri)
 * — headful Chromium, storage state persisted, graceful manual-fallback
 * if any selector drifts.
 *
 * What the script does:
 *   1. Opens https://console.cloud.google.com/apis/credentials in a
 *      visible browser. First run: you sign in with the Google account
 *      that owns the project. Subsequent runs reuse the saved state.
 *   2. Drives the "+ Create Credentials → OAuth client ID" flow:
 *        - Application type: iOS
 *        - Name:             CreatorHub One iPad
 *        - Bundle ID:        com.creatorhubn.capture
 *   3. Reads the freshly-minted client ID from the confirmation dialog
 *      (or the credential's detail page).
 *   4. If ``--write`` is passed, patches ``ipad/CaptureApp/project.yml``:
 *        GoogleOAuthClientID               → <client id>
 *        CFBundleURLSchemes[0]             → com.googleusercontent.apps.<reversed>
 *      and runs ``xcodegen generate`` so the iPad build picks it up.
 *   5. Leaves the browser open for 10 min so you can eyeball the new
 *      credential + copy the iOS plist snippet manually if the auto-
 *      extraction failed.
 *
 * Env:
 *   GCP_PROJECT_ID     project to register the client in (required)
 *   GOOGLE_STATE_FILE  override for the storageState path
 *   IOS_OAUTH_NAME     display name shown in the Credentials list
 *   IOS_BUNDLE_ID      defaults to com.creatorhubn.capture
 *
 * Prerequisite in Google Cloud Console (one-time, outside this script):
 *   * The project must have an OAuth consent screen configured (any
 *     user type). Without it, the iOS client-creation flow will
 *     redirect you to configure consent instead of showing the form.
 *
 * Run with:
 *   GCP_PROJECT_ID=your-project-id \
 *     node backend/scripts/configure-google-ios-oauth.playwright.mjs [--write]
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const PROJECT_ID = process.env.GCP_PROJECT_ID;
if (!PROJECT_ID) {
  console.error('Missing GCP_PROJECT_ID env. Set it to the Google Cloud project that should host the iOS OAuth client.');
  process.exit(2);
}

const OAUTH_NAME = process.env.IOS_OAUTH_NAME || 'CreatorHub One iPad';
const BUNDLE_ID = process.env.IOS_BUNDLE_ID || 'com.creatorhubn.capture';
const WRITE_TO_PROJECT_YML = process.argv.includes('--write');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const PROJECT_YML = path.join(REPO_ROOT, 'ipad/CaptureApp/project.yml');
const STATE_PATH = path.resolve(
  process.cwd(),
  process.env.GOOGLE_STATE_FILE || '.google-cloud-playwright-state.json',
);

const CREDENTIALS_URL =
  `https://console.cloud.google.com/apis/credentials?project=${encodeURIComponent(PROJECT_ID)}`;

function log(msg) {
  const t = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${t}] ${msg}`);
}

async function loadStorage() {
  try {
    await fs.access(STATE_PATH);
    return STATE_PATH;
  } catch { return undefined; }
}

/** Wait until the page settles on the GCP credentials URL. Covers the
 *  full login flow AND Google's step-up re-auth (2FA SMS code, device
 *  verification) that can interrupt a reused storageState session. */
async function waitForCredentialsPage(page, maxSeconds = 600) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (
      url.includes('console.cloud.google.com/apis/credentials') &&
      !url.includes('accounts.google.com')
    ) return true;
    // Google bounces through myaccount.google.com sometimes (consent,
    // device-trust). Keep waiting — user handles the interactive step.
    await page.waitForTimeout(2000);
  }
  return false;
}

/** Reverse a Google iOS client ID to produce its CFBundleURLScheme. */
function reverseClientId(clientId) {
  const parts = clientId.split('.');
  if (parts.length < 3) throw new Error(`Unexpected client-ID shape: ${clientId}`);
  return parts.reverse().join('.');
}

/**
 * Drive the "+ Create credentials → OAuth client ID" UI. Returns the
 * newly-minted client ID string, or null if automation couldn't make it
 * all the way through (in which case the browser is left open).
 */
/**
 * Before creating anything new, check if a client with the same name
 * already exists in the current project's OAuth 2.0 Client IDs table.
 * Previous runs that failed at ID-extraction may have left a fully
 * created client behind; we don't want to pile up duplicates.
 * Returns the existing client ID string, or null if none found.
 */
async function findExistingIOSClient(page) {
  // Wait a beat for the credentials list to hydrate.
  await page.waitForTimeout(1500);
  try {
    const nameLink = page.getByRole('link', { name: new RegExp(`^${OAUTH_NAME}$`, 'i') }).first();
    if ((await nameLink.count()) === 0) return null;

    // Navigate to the client's detail page so we get the full, non-
    // truncated ID. The credentials list truncates long IDs with "...".
    log('ℹ Åpner eksisterende clients detaljside for å lese full ID…');
    await nameLink.click();
    await page.waitForTimeout(2500);

    // The detail page shows "Client ID" as a labeled field. Read the
    // whole page content and regex for the pattern.
    const html = await page.content();
    const match = html.match(/([0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com)/i);

    // Back to the credentials list so subsequent logic (should there
    // be a create flow) starts from the expected page.
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1500);

    return match ? match[1] : null;
  } catch { return null; }
}

async function createIOSClient(page) {
  // Dismiss the cookie banner if it's covering the bottom of the page.
  // Not strictly needed for the Create-credentials button (which is
  // near the top) but keeps subsequent dropdown positioning clean.
  const cookieDismiss = page.getByRole('button', { name: /ok,?\s*got it/i }).first();
  if ((await cookieDismiss.count()) > 0) {
    await cookieDismiss.click({ timeout: 3000 }).catch(() => { /* best effort */ });
  }

  // Pre-check: if a client with the same display name already exists
  // (e.g. from a previous run that failed on ID-extraction), reuse it
  // rather than creating a duplicate.
  const existing = await findExistingIOSClient(page);
  if (existing) {
    log(`ℹ Eksisterende client funnet med samme navn — gjenbruker: ${existing}`);
    return existing;
  }

  log('Klikker "+ Create credentials" → "OAuth client ID"…');
  // Google Cloud wraps the trigger in a Material-style menu button, not
  // a plain <button>. Text-based match is most robust — fall back to
  // role-based + the button icon if the text-match fails.
  const createBtn = page
    .getByText(/create credentials/i)
    .or(page.getByRole('button', { name: /create credentials/i }))
    .first();
  await createBtn.waitFor({ state: 'visible', timeout: 15000 });
  await createBtn.click();

  // Menu item text is literally "OAuth client ID". Sometimes Google
  // renders it as a plain <button> inside the menu, sometimes as a
  // role=menuitem, sometimes as a link. Try them in order.
  const oauthItem = page
    .getByRole('menuitem', { name: /oauth client id/i })
    .or(page.getByRole('button', { name: /oauth client id/i }))
    .or(page.getByText(/^oauth client id$/i))
    .first();
  await oauthItem.waitFor({ state: 'visible', timeout: 8000 });
  await oauthItem.click();

  // --- Application type dropdown ---
  log('Velger Application type = iOS…');
  const typeCombo = page
    .getByRole('combobox', { name: /application type/i })
    .or(page.locator('mat-select[formcontrolname="applicationType"]'))
    .first();
  await typeCombo.waitFor({ state: 'visible', timeout: 10000 });
  await typeCombo.click();

  const iosOption = page.getByRole('option', { name: /^iOS$/i }).first();
  await iosOption.waitFor({ state: 'visible', timeout: 8000 });
  await iosOption.click();

  // --- Name + Bundle ID fields ---
  log(`Fyller inn navn + bundle ID (${BUNDLE_ID})…`);
  const nameInput = page
    .getByRole('textbox', { name: /^name$/i })
    .or(page.locator('input[formcontrolname="displayName"]'))
    .first();
  await nameInput.waitFor({ state: 'visible', timeout: 8000 });
  await nameInput.fill(OAUTH_NAME);

  const bundleInput = page
    .getByRole('textbox', { name: /bundle\s*id/i })
    .or(page.locator('input[formcontrolname="iosBundleId"]'))
    .first();
  await bundleInput.waitFor({ state: 'visible', timeout: 8000 });
  await bundleInput.fill(BUNDLE_ID);

  // --- Submit ---
  log('Klikker Create…');
  const submitBtn = page.getByRole('button', { name: /^create$/i }).first();
  await submitBtn.waitFor({ state: 'visible', timeout: 8000 });
  await submitBtn.click();

  // --- Extract the client ID from the confirmation dialog ---
  //
  // Google opens a modal titled "OAuth client created" with the ID
  // prominently displayed. We scope the extraction to the dialog
  // container so we don't accidentally grab an unrelated client ID
  // visible on the credentials list page in the background (which
  // would happen if the dialog hasn't finished rendering yet).
  log('Venter på "OAuth client created" bekreftelsesdialog…');

  // 1. Wait for the dialog's header to appear. Google uses
  //    `role="dialog"` + a heading with "OAuth client created" or
  //    "Klienten er opprettet" depending on UI locale. The heading
  //    waits for render, THEN we scope the search.
  const dialog = page.locator('[role="dialog"]').filter({
    has: page.getByText(/oauth client (id )?created|klient.+opprettet/i),
  }).first();

  try {
    await dialog.waitFor({ state: 'visible', timeout: 20000 });
  } catch {
    log('⚠ Bekreftelsesdialogen dukket ikke opp innen 20s. Sjekk browseren — OAuth consent screen mangler? Samme navn finnes allerede?');
    return null;
  }

  // 2. Poll the dialog's full HTML (including input values, not just
  //    rendered text) for the client-ID pattern. Google renders the ID
  //    in a readonly <input> inside the dialog, so innerText misses it.
  //    Extracting via outerHTML catches both text nodes AND input
  //    value= attributes, and we still stay scoped to the dialog so
  //    background-page IDs can't leak through.
  const deadline = Date.now() + 20_000;
  let clientId = null;
  while (Date.now() < deadline) {
    try {
      const dialogHtml = await dialog.evaluate((el) => el.outerHTML);
      const m = dialogHtml.match(/([0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com)/i);
      if (m) {
        clientId = m[1];
        break;
      }
    } catch { /* element may be detaching briefly; retry */ }
    await page.waitForTimeout(500);
  }

  if (!clientId) {
    const dialogText = await dialog.innerText().catch(() => '(dialog uleselig)');
    log('⚠ Dialog åpen, men fant ikke client-ID-mønsteret i dens DOM.');
    log(`  Dialog-tekst (første 400 tegn): ${dialogText.slice(0, 400)}`);
    // Screenshot the dialog so a follow-up run can eyeball what Google
    // actually rendered. Saves next-session debugging.
    await page.screenshot({
      path: 'google-oauth-dialog-miss.png',
      fullPage: true,
    }).catch(() => {});
    return null;
  }
  return clientId;
}

async function patchProjectYml(clientId) {
  const urlScheme = reverseClientId(clientId);
  log(`Patcher project.yml…`);
  log(`  GoogleOAuthClientID → ${clientId}`);
  log(`  CFBundleURLScheme   → ${urlScheme}`);

  let yml = await fs.readFile(PROJECT_YML, 'utf8');
  yml = yml.replace(
    /GoogleOAuthClientID:\s*REPLACE_WITH_IOS_OAUTH_CLIENT_ID/,
    `GoogleOAuthClientID: ${clientId}`,
  );
  yml = yml.replace(
    /com\.googleusercontent\.apps\.REPLACE_WITH_REVERSED_CLIENT_ID/,
    urlScheme,
  );
  await fs.writeFile(PROJECT_YML, yml, 'utf8');
  log('✓ project.yml oppdatert.');

  log('Kjører xcodegen generate…');
  const result = spawnSync('xcodegen', ['generate'], {
    cwd: path.join(REPO_ROOT, 'ipad/CaptureApp'),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    log('⚠ xcodegen failed — kjør manuelt i ipad/CaptureApp/.');
  } else {
    log('✓ xcodegen ferdig. iPad-bygget plukker opp endringene neste build.');
  }
}

(async () => {
  log(`Project:   ${PROJECT_ID}`);
  log(`Bundle ID: ${BUNDLE_ID}`);
  log(`Name:      ${OAUTH_NAME}`);
  log(`Write to project.yml: ${WRITE_TO_PROJECT_YML ? 'YES (will run xcodegen)' : 'NO (dry run — add --write to apply)'}`);

  const storageState = await loadStorage();
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(CREDENTIALS_URL, { waitUntil: 'domcontentloaded' });

    // Let any redirect chain settle — Google routes through login,
    // account-picker, 2FA, device-trust, etc. before landing us on the
    // Credentials page. This covers both fresh-login AND step-up re-
    // auth that can fire mid-session even with a saved storageState.
    log('Venter på at vi faktisk lander på Credentials-siden (inkludert evt. 2FA)…');
    const landed = await waitForCredentialsPage(page);
    if (!landed) {
      throw new Error(
        'Kom aldri fram til Credentials-siden innen 10 min. ' +
        'Fullfør login + 2FA i browseren, så kjør scriptet på nytt.',
      );
    }
    // Persist (refreshed) state so the next run skips any step-up re-
    // auth we just passed through.
    await context.storageState({ path: STATE_PATH });
    log('✓ På Credentials-siden. (State lagret.)');

    // Consent-screen gate: if the project lacks an OAuth consent screen,
    // Google punts the user to the consent-screen config form instead of
    // letting them create a client. Bail out with a clear message — this
    // is a one-time manual step we don't automate here.
    if (page.url().includes('/consent')) {
      log('⚠ Prosjektet mangler konfigurert OAuth consent screen.');
      log('  Fullfør consent-screen-konfigurasjonen i nettleseren, så kjør scriptet på nytt.');
      log('  Lar browseren stå åpen i 10 min for manuell setup.');
      await page.waitForTimeout(600_000);
      return;
    }

    await page.waitForTimeout(2500); // Let any progress spinner resolve.
    const clientId = await createIOSClient(page);

    if (clientId) {
      const urlScheme = reverseClientId(clientId);
      log('');
      log('═══════════════════════════════════════════════════════');
      log(`✓ iOS OAuth client registered`);
      log(`  Client ID:  ${clientId}`);
      log(`  URL scheme: ${urlScheme}`);
      log('═══════════════════════════════════════════════════════');
      log('');
      if (WRITE_TO_PROJECT_YML) {
        await patchProjectYml(clientId);
      } else {
        log('Dry run — client ID er IKKE skrevet til project.yml.');
        log('Kjør på nytt med --write, eller oppdater project.yml manuelt:');
        log(`  GoogleOAuthClientID: ${clientId}`);
        log(`  CFBundleURLSchemes:`);
        log(`    - ${urlScheme}`);
      }
    } else {
      log('⚠ Automatisk client-creation feilet.');
      log('  Fullfør resten manuelt i det åpne browservinduet.');
      log('  Når ID-en er synlig, kopier den og patch project.yml selv.');
    }

    log('Lar browseren stå åpen i 10 min for verifisering…');
    await page.waitForTimeout(600_000);
  } catch (err) {
    console.error('Script failed:', err?.message ?? err);
    await page.screenshot({ path: 'google-oauth-setup-failure.png', fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
})();
