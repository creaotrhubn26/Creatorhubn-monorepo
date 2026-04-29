#!/usr/bin/env node
// Twilio onboarding for audition-reminder SMS.
//
// Hybrid: Playwright headed-mode for login (handhåndterer 2FA), så Twilio
// SDK for å hente Account SID + Auth Token + opprette to Messaging Services
// (RoleRoom + CreatorHub). Output skrives til .env.twilio.local som du
// kopierer videre til Render UI.
//
// Kjør:   node backend/scripts/twilio-onboarding.mjs
// Krav:   node 20+, internett, en bruker med tilgang til Twilio Console
//
// Hva scriptet IKKE gjør (manuelle steg):
//   - Verifisere identitet (Twilio krever fysisk dokumentasjon for Norge-SMS)
//   - Få godkjent alfanumerisk sender-ID hos Telenor/Telia (1–7 dagers ventetid
//     etter at Twilio har submittet)
//   - Sette de 8 hemmelighetene i Render UI (du gjør det selv etter scriptet)

import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import twilio from 'twilio';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '..', '..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'backend', '.env.twilio.local');

const rl = readline.createInterface({ input, output });
const ask = (q) => rl.question(q);
const log = (msg) => console.log(`\x1b[36m[twilio-onboarding]\x1b[0m ${msg}`);
const warn = (msg) => console.log(`\x1b[33m[twilio-onboarding]\x1b[0m ${msg}`);
const ok = (msg) => console.log(`\x1b[32m[twilio-onboarding]\x1b[0m ${msg}`);

async function loginAndScrapeCredentials() {
  log('Åpner Chromium mot console.twilio.com — logg inn manuelt (også 2FA).');
  log('Når du står på dashboardet, gå tilbake til denne terminalen og trykk Enter.');

  const browser = await chromium.launch({ headless: false, slowMo: 30 });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://console.twilio.com/', { waitUntil: 'domcontentloaded' });

  await ask('\n>> Logget inn? Trykk Enter når dashbord er synlig... ');

  log('Henter Account SID + Auth Token fra dashbordet...');

  let accountSid = null;
  let authToken = null;

  try {
    await page.goto('https://console.twilio.com/?frameUrl=%2Fconsole', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const sidMatches = await page.locator('text=/AC[a-f0-9]{32}/').allInnerTexts();
    accountSid = sidMatches.map((s) => (s.match(/AC[a-f0-9]{32}/) || [null])[0]).find(Boolean) || null;
  } catch (err) {
    warn(`Auto-scrape feilet (${err.message}). Vi henter SID + Token manuelt.`);
  }

  if (!accountSid) {
    accountSid = (await ask('>> Lim inn Account SID (AC...): ')).trim();
  } else {
    ok(`Fant Account SID: ${accountSid}`);
  }

  authToken = (await ask('>> Lim inn Auth Token (synlig under "Show" i dashbordet): ')).trim();

  await browser.close();

  if (!accountSid || !accountSid.startsWith('AC') || accountSid.length !== 34) {
    throw new Error(`Account SID ser feil ut: "${accountSid}"`);
  }
  if (!authToken || authToken.length < 30) {
    throw new Error('Auth Token ser tom eller for kort ut.');
  }

  return { accountSid, authToken };
}

async function ensureMessagingService(client, friendlyName) {
  log(`Sjekker om Messaging Service "${friendlyName}" finnes...`);
  const existing = await client.messaging.v1.services.list({ limit: 50 });
  const match = existing.find((svc) => svc.friendlyName === friendlyName);
  if (match) {
    ok(`Eksisterende Messaging Service funnet: ${match.sid}`);
    return match.sid;
  }
  log(`Oppretter ny Messaging Service: ${friendlyName}`);
  const created = await client.messaging.v1.services.create({
    friendlyName,
    inboundRequestUrl: 'https://creatorhub-backend.onrender.com/api/health',
    fallbackToLongCode: false,
    scanMessageContent: 'inherit',
    smartEncoding: true,
  });
  ok(`Opprettet: ${created.sid}`);
  return created.sid;
}

async function maybeRegisterAlphaSender(client, messagingServiceSid, alphaName) {
  log(`Forsøker å registrere alfanumerisk sender "${alphaName}" på MS ${messagingServiceSid}...`);
  try {
    const existing = await client.messaging.v1
      .services(messagingServiceSid)
      .alphaSenders.list({ limit: 20 });
    const match = existing.find((sender) => sender.alphaSender === alphaName);
    if (match) {
      ok(`Alpha-sender "${alphaName}" finnes allerede (${match.sid}).`);
      return match.sid;
    }
    const created = await client.messaging.v1
      .services(messagingServiceSid)
      .alphaSenders.create({ alphaSender: alphaName });
    ok(`Submittet alfanumerisk sender "${alphaName}" → ${created.sid}`);
    warn('Norge krever pre-godkjenning hos Telenor/Telia. Twilio sender forespørsel videre — typisk 1–7 dager ventetid.');
    return created.sid;
  } catch (err) {
    warn(`Kunne ikke registrere "${alphaName}" automatisk: ${err.message}`);
    warn('Gjør dette manuelt: console.twilio.com → Messaging → Sender Pool → Add Sender → Alphanumeric.');
    return null;
  }
}

async function writeEnvFile(rows) {
  const lines = [
    '# Auto-generert av backend/scripts/twilio-onboarding.mjs',
    '# IKKE commit denne filen. Kopier verdiene videre til Render UI.',
    '#',
    `# Generated: ${new Date().toISOString()}`,
    '',
  ];
  for (const [key, value] of rows) {
    lines.push(`${key}=${value}`);
  }
  await fs.writeFile(OUTPUT_FILE, lines.join('\n') + '\n', { mode: 0o600 });
  ok(`Skrev ${rows.length} verdier til ${OUTPUT_FILE} (mode 0600).`);
}

async function ensureGitignore() {
  const gitignorePath = path.join(REPO_ROOT, 'backend', '.gitignore');
  let current = '';
  try {
    current = await fs.readFile(gitignorePath, 'utf8');
  } catch {}
  if (!current.includes('.env.twilio.local')) {
    await fs.appendFile(gitignorePath, '\n# Twilio onboarding output (secrets, not for git)\n.env.twilio.local\n');
    log('La til .env.twilio.local i backend/.gitignore.');
  }
}

async function main() {
  await ensureGitignore();

  const { accountSid, authToken } = await loginAndScrapeCredentials();
  const client = twilio(accountSid, authToken);

  log('Oppretter to Messaging Services (én per brand)...');
  const roleRoomMsSid   = await ensureMessagingService(client, 'The Role Room — audition reminders');
  const creatorHubMsSid = await ensureMessagingService(client, 'CreatorHub — transactional');

  log('Submitter alfanumeriske sender-IDs (godkjenning kommer separat)...');
  await maybeRegisterAlphaSender(client, roleRoomMsSid,   'RoleRoom');
  await maybeRegisterAlphaSender(client, creatorHubMsSid, 'CreatorHub');

  await writeEnvFile([
    ['TWILIO_ACCOUNT_SID', accountSid],
    ['TWILIO_AUTH_TOKEN',  authToken],
    ['ROLE_ROOM_TWILIO_ACCOUNT_SID',           accountSid],
    ['ROLE_ROOM_TWILIO_AUTH_TOKEN',            authToken],
    ['ROLE_ROOM_TWILIO_MESSAGING_SERVICE_SID', roleRoomMsSid],
    ['CREATORHUB_TWILIO_ACCOUNT_SID',          accountSid],
    ['CREATORHUB_TWILIO_AUTH_TOKEN',           authToken],
    ['CREATORHUB_TWILIO_MESSAGING_SERVICE_SID', creatorHubMsSid],
  ]);

  ok('\nFerdig. Neste steg:');
  console.log('  1. Åpne backend/.env.twilio.local — kopier verdiene til Render UI på');
  console.log('     creatorhub-backend (https://dashboard.render.com → Environment).');
  console.log('  2. Vent på Telenor/Telia-godkjenning av alfanumerisk sender-ID');
  console.log('     (Twilio sender deg e-post når status endrer seg).');
  console.log('  3. Når SMS faktisk kan sendes, test med:');
  console.log('     curl -XPOST https://creatorhub-backend.onrender.com/api/role-room/casting/reminders/sweep -H "x-admin-key: ..."');
  console.log('  4. Slett backend/.env.twilio.local etter at verdiene er i Render.');

  rl.close();
}

main().catch((err) => {
  console.error('\n[twilio-onboarding] FEIL:', err);
  rl.close();
  process.exit(1);
});
