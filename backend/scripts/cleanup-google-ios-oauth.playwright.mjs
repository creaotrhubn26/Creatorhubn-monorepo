#!/usr/bin/env node
/**
 * Deletes OAuth 2.0 Client IDs matching a display-name filter from a
 * Google Cloud project's Credentials page. Pair with
 * ``configure-google-ios-oauth.playwright.mjs`` to clean up orphan iOS
 * clients left behind by failed-mid-flight setup runs.
 *
 * Default behaviour is LIST-ONLY (dry run). Add ``--delete`` to actually
 * remove them — and optionally ``KEEP_CLIENT_ID=<id>`` so the client
 * currently wired into project.yml survives the sweep.
 *
 * Env:
 *   GCP_PROJECT_ID        project to clean (required)
 *   IOS_OAUTH_NAME        display-name filter, default "CreatorHub One iPad"
 *   KEEP_CLIENT_ID        full client ID to preserve; all others deleted
 *   GOOGLE_STATE_FILE     override storageState path
 *
 * Example (delete tidum-no's orphan client, keep none):
 *   GCP_PROJECT_ID=tidum-no \
 *     node backend/scripts/cleanup-google-ios-oauth.playwright.mjs --delete
 *
 * Example (delete duplicates in creatorhubn-com, keep the wired one):
 *   GCP_PROJECT_ID=creatorhubn-com \
 *   KEEP_CLIENT_ID=256648631702-s96ihgei36g0pgc11t4o27arcjoc35g5.apps.googleusercontent.com \
 *     node backend/scripts/cleanup-google-ios-oauth.playwright.mjs --delete
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const PROJECT_ID = process.env.GCP_PROJECT_ID;
if (!PROJECT_ID) {
  console.error('Missing GCP_PROJECT_ID env.');
  process.exit(2);
}

const OAUTH_NAME = process.env.IOS_OAUTH_NAME || 'CreatorHub One iPad';
const KEEP_CLIENT_ID = (process.env.KEEP_CLIENT_ID || '').trim();
const DELETE_MODE = process.argv.includes('--delete');
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
  try { await fs.access(STATE_PATH); return STATE_PATH; }
  catch { return undefined; }
}

async function waitForCredentialsPage(page, maxSeconds = 600) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (
      url.includes('console.cloud.google.com/apis/credentials') &&
      !url.includes('accounts.google.com')
    ) return true;
    await page.waitForTimeout(2000);
  }
  return false;
}

/**
 * Collect every row under the "OAuth 2.0 Client IDs" table whose Name
 * cell matches ``OAUTH_NAME``. Returns an array of { name, clientId }
 * where clientId is fully-qualified (read from the row's detail page
 * since the list view truncates long IDs).
 */
async function enumerateMatchingClients(page) {
  const matches = [];
  // Collect all anchor-link rows with the display name. Using filter
  // (not strict equality) because Google occasionally pads names with
  // extra whitespace in the rendered cell.
  const rows = page.getByRole('link', { name: new RegExp(`^\\s*${OAUTH_NAME}\\s*$`, 'i') });
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const link = rows.nth(i);
    const nameText = (await link.innerText().catch(() => '')).trim();
    // Follow the link to the detail page for the full ID.
    await link.click();
    await page.waitForTimeout(2500);
    const html = await page.content();
    const m = html.match(/([0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com)/i);
    if (m) matches.push({ name: nameText, clientId: m[1] });
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1500);
  }
  return matches;
}

/**
 * Delete a client by navigating to its detail page (reached by clicking
 * the name link in the list) and pressing the "Delete OAuth client"
 * button there. More robust than hunting for a per-row trash icon in
 * the list, because the detail page has a stable primary action bar.
 * Returns true if the deletion modal was confirmed successfully.
 */
async function deleteClient(page, clientId) {
  log(`  Sletter ${clientId}…`);
  // Fresh list view so the link-by-name lookup resolves consistently.
  await page.goto(CREDENTIALS_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const nameLink = page
    .getByRole('link', { name: new RegExp(`^\\s*${OAUTH_NAME}\\s*$`, 'i') })
    .first();
  if ((await nameLink.count()) === 0) {
    log(`  ⚠ Fant ingen lenke for "${OAUTH_NAME}" — allerede slettet?`);
    return false;
  }
  await nameLink.click();
  await page.waitForTimeout(2500);

  // Confirm the detail page matches the intended client before acting.
  const html = await page.content();
  if (!html.includes(clientId)) {
    log(`  ⚠ Detaljsiden inneholder ikke ${clientId.slice(0, 40)}… — hopper over.`);
    await page.goBack().catch(() => {});
    return false;
  }

  // Top action bar has "Delete" (or "Delete OAuth client") as a primary
  // button. Multiple locator candidates cover Google's occasional UI
  // reshuffles.
  const deleteBtn = page
    .getByRole('button', { name: /delete\s+oauth\s+client/i })
    .or(page.getByRole('button', { name: /^delete$/i }))
    .or(page.getByRole('button', { name: /slett/i }))
    .first();
  await deleteBtn.waitFor({ state: 'visible', timeout: 10000 });
  await deleteBtn.click();

  // Confirm modal. Google's modal uses "Delete" as the confirm label,
  // sometimes "Remove". Match permissively.
  const confirmBtn = page
    .getByRole('button', { name: /^(delete|remove|slett)$/i })
    .or(page.getByRole('button', { name: /confirm/i }))
    .last();
  await confirmBtn.waitFor({ state: 'visible', timeout: 8000 });
  await confirmBtn.click();
  await page.waitForTimeout(2500);
  log(`  ✓ Slettet.`);
  return true;
}

(async () => {
  log(`Project:         ${PROJECT_ID}`);
  log(`Name filter:     "${OAUTH_NAME}"`);
  log(`Keep client ID:  ${KEEP_CLIENT_ID || '(none — all matching clients will be deleted)'}`);
  log(`Mode:            ${DELETE_MODE ? 'DELETE' : 'DRY RUN (add --delete to actually remove)'}`);

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
    log('Venter til vi lander på Credentials (inkl. evt. login/2FA)…');
    const landed = await waitForCredentialsPage(page);
    if (!landed) throw new Error('Kom aldri fram til Credentials-siden (login timed out).');
    await context.storageState({ path: STATE_PATH });
    await page.waitForTimeout(2500);

    log('Kartlegger matching OAuth-klienter…');
    const matches = await enumerateMatchingClients(page);
    if (matches.length === 0) {
      log('Ingen OAuth-klienter matcher navnet. Ingenting å gjøre.');
      return;
    }

    log(`Fant ${matches.length} matching client(s):`);
    for (const m of matches) {
      const marker = m.clientId === KEEP_CLIENT_ID ? '  [KEEP]' : '  [delete]';
      log(`${marker} ${m.name}  →  ${m.clientId}`);
    }

    const toDelete = matches.filter((m) => m.clientId !== KEEP_CLIENT_ID);
    if (toDelete.length === 0) {
      log('Alle matching clients er KEEP — ingen slettinger nødvendig.');
      return;
    }

    if (!DELETE_MODE) {
      log('DRY RUN ferdig. Kjør på nytt med --delete for å faktisk slette.');
      return;
    }

    // Refresh the list view so the row locators resolve cleanly after
    // the detail-page navigations above.
    await page.goto(CREDENTIALS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    for (const m of toDelete) {
      await deleteClient(page, m.clientId);
    }
    log(`✓ Ferdig. Slettet ${toDelete.length} client(s).`);
  } catch (err) {
    console.error('Script failed:', err?.message ?? err);
    await page.screenshot({ path: 'google-oauth-cleanup-failure.png', fullPage: true }).catch(() => {});
  } finally {
    await page.waitForTimeout(3000);
    await context.close();
    await browser.close();
  }
})();
