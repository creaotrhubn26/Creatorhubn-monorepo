#!/usr/bin/env node
/**
 * smoke-test-encrypted-delivery.mjs
 *
 * E2E round-trip-test for envelope-encryption + client-gallery-leveranse.
 *
 * Flow:
 *   1. Generer en tilfeldig 1MB test-fil + lagre SHA-256
 *   2. POST /api/chunked-upload/init med encryptAtRest=true → uploadId
 *   3. PUT chunks
 *   4. POST /finish → fileId
 *   5. POST /api/photographer/galleries (eller bruk eksisterende) → galleryId + accessToken
 *   6. POST /api/photographer/galleries/:id/attach-uploads med fileIds=[fileId]
 *   7. GET /api/client/gallery/:accessToken/images (offentlig, ingen auth)
 *      → forventer 1 bilde med fullSizeUrl
 *   8. GET fullSizeUrl (decrypt-proxy) → last ned plaintext
 *   9. SHA-256 sammenlign med original
 *  10. PASS/FAIL
 *
 * Bruk:
 *   BASE_URL=https://creatorhubn.com \
 *   COOKIE='your-session-cookie' \
 *   node scripts/smoke-test-encrypted-delivery.mjs
 *
 * Hvordan finne COOKIE:
 *   - Logg inn på CreatorHub i browseren
 *   - Åpne DevTools → Application → Cookies → kopier hele cookie-headeren
 *     (kan være flere cookies, lim inn alle som én streng)
 *
 * Krever Node 18+ (innebygd fetch + crypto + Blob).
 */

import { createHash, randomBytes } from 'crypto';
import { Buffer } from 'buffer';
import process from 'process';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const COOKIE = process.env.COOKIE || '';
const AUTH_BEARER = process.env.AUTH_BEARER || '';
// readActiveSessionToken på backend leser fra Authorization: Bearer eller
// x-session-token / x-auth-token (cookie støttes ikke direkte). Hvis
// COOKIE-strengen ser ut som et rent token (uten ';' eller '='), behandle
// den som Bearer-token. Eksplisitt AUTH_BEARER overstyrer.
const resolvedBearer =
  AUTH_BEARER ||
  (COOKIE && !COOKIE.includes(';') && !COOKIE.includes('=') ? COOKIE : '');
const TEST_FILE_SIZE = Number(process.env.TEST_SIZE) || 1 * 1024 * 1024; // 1 MB
const CHUNK_SIZE = 256 * 1024; // 256 KB per chunk for testing

// ──────────────────────────────────────────────────────────────────
// Output helpers
// ──────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};
const step = (n, msg) =>
  console.log(`\n${c.cyan}[${n}]${c.reset} ${c.bold}${msg}${c.reset}`);
const ok = (msg) => console.log(`  ${c.green}✓${c.reset} ${msg}`);
const fail = (msg) => console.log(`  ${c.red}✗${c.reset} ${msg}`);
const info = (msg) => console.log(`  ${c.dim}${msg}${c.reset}`);
const die = (msg) => {
  console.error(`\n${c.red}${c.bold}FAIL:${c.reset} ${msg}`);
  process.exit(1);
};

// ──────────────────────────────────────────────────────────────────
// HTTP helpers
// ──────────────────────────────────────────────────────────────────
const headers = (extra = {}) => ({
  ...(resolvedBearer ? { Authorization: `Bearer ${resolvedBearer}` } : {}),
  ...(COOKIE && COOKIE.includes(';') ? { Cookie: COOKIE } : {}),
  ...extra,
});

const apiPost = async (path, body, opts = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', ...(opts.headers || {}) }),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, ok: res.ok, body: json ?? text };
};

const apiGet = async (path, opts = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: headers(opts.headers || {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, ok: res.ok, body: json ?? text };
};

const apiPut = async (path, body, opts = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/octet-stream', ...(opts.headers || {}) }),
    body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, ok: res.ok, body: json ?? text };
};

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const main = async () => {
  console.log(`${c.bold}E2E Encrypted Delivery Smoke Test${c.reset}`);
  console.log(`${c.dim}BASE_URL: ${BASE_URL}${c.reset}`);
  console.log(`${c.dim}TEST_FILE_SIZE: ${TEST_FILE_SIZE} bytes${c.reset}`);

  if (!COOKIE && !AUTH_BEARER) {
    die(
      'Mangler auth. Sett enten:\n' +
        '  AUTH_BEARER="<token>"  (programmatisk Bearer-token), eller\n' +
        '  COOKIE="<cookie-streng med ; og =>" (fra browser DevTools)',
    );
  }

  // ──────────────────────────────────────────────────────────────────
  step(1, 'Generer test-fil + beregn SHA-256');
  const testFile = randomBytes(TEST_FILE_SIZE);
  const originalHash = sha256(testFile);
  ok(`Test-fil generert (${TEST_FILE_SIZE} bytes)`);
  info(`SHA-256: ${originalHash}`);

  // ──────────────────────────────────────────────────────────────────
  step(2, 'Init chunked upload med encryptAtRest=true');
  const totalChunks = Math.ceil(testFile.length / CHUNK_SIZE);
  const initRes = await apiPost('/api/chunked-upload/init', {
    fileName: `smoke-test-${Date.now()}.bin`,
    fileSize: testFile.length,
    chunkSize: CHUNK_SIZE,
    totalChunks,
    mimeType: 'application/octet-stream',
    metadata: { encryptAtRest: true, smokeTest: true },
  });
  if (!initRes.ok) {
    die(
      `Init feilet: HTTP ${initRes.status}\n${JSON.stringify(initRes.body, null, 2)}`,
    );
  }
  const uploadId = initRes.body.uploadId;
  ok(`uploadId: ${uploadId}`);
  info(`totalChunks: ${totalChunks}, expiresAt: ${initRes.body.expiresAt}`);

  // ──────────────────────────────────────────────────────────────────
  step(3, `Upload ${totalChunks} chunks`);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, testFile.length);
    const chunk = testFile.subarray(start, end);
    const chunkRes = await apiPut(
      `/api/chunked-upload/${uploadId}/chunks/${i}`,
      chunk,
    );
    if (!chunkRes.ok) {
      die(
        `Chunk ${i} feilet: HTTP ${chunkRes.status}\n${JSON.stringify(chunkRes.body, null, 2)}`,
      );
    }
    process.stdout.write(
      `\r  ${c.dim}Chunk ${i + 1}/${totalChunks} (${chunk.length} bytes)${c.reset}`,
    );
  }
  process.stdout.write('\n');
  ok(`Alle ${totalChunks} chunks lastet opp`);

  // ──────────────────────────────────────────────────────────────────
  step(4, 'Finish upload → assembler + krypter + lagre');
  const finishRes = await apiPost(
    `/api/chunked-upload/${uploadId}/finish`,
    {},
  );
  if (!finishRes.ok) {
    die(
      `Finish feilet: HTTP ${finishRes.status}\n${JSON.stringify(finishRes.body, null, 2)}`,
    );
  }
  const fileId = finishRes.body.fileId;
  const storageBackend = finishRes.body.storage?.backend;
  ok(`fileId: ${fileId}`);
  info(`storageBackend: ${storageBackend}, size: ${finishRes.body.size}`);
  if (storageBackend === 'filesystem') {
    info(
      `${c.yellow}Advarsel: storage gikk til filesystem (ikke R2). Sjekk at GENERIC_UPLOADS_R2_* env-vars er satt for full prod-verifikasjon.${c.reset}`,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  step(5, 'Opprett nytt klient-galleri');
  const galleryRes = await apiPost('/api/photographer/galleries', {
    clientName: `Smoke Test ${new Date().toISOString()}`,
    clientEmail: 'smoke-test@example.com',
    projectTitle: 'Smoke Test Gallery',
  });
  if (!galleryRes.ok) {
    die(
      `Gallery-opprettelse feilet: HTTP ${galleryRes.status}\n${JSON.stringify(galleryRes.body, null, 2)}`,
    );
  }
  const galleryId =
    galleryRes.body.gallery?.id ||
    galleryRes.body.galleryId ||
    galleryRes.body.id;
  const accessToken =
    galleryRes.body.gallery?.accessToken ||
    galleryRes.body.accessToken;
  if (!galleryId || !accessToken) {
    die(
      `Mangler galleryId/accessToken i response: ${JSON.stringify(galleryRes.body, null, 2)}`,
    );
  }
  ok(`galleryId: ${galleryId}`);
  info(`accessToken: ${accessToken}`);

  // ──────────────────────────────────────────────────────────────────
  step(6, 'Attach fileId til galleriet');
  const attachRes = await apiPost(
    `/api/photographer/galleries/${galleryId}/attach-uploads`,
    { fileIds: [fileId] },
  );
  if (!attachRes.ok) {
    die(
      `Attach feilet: HTTP ${attachRes.status}\n${JSON.stringify(attachRes.body, null, 2)}`,
    );
  }
  if (attachRes.body.added !== 1) {
    die(
      `Forventet 1 lagt til, fikk added=${attachRes.body.added}, skipped=${attachRes.body.skipped}`,
    );
  }
  const imageId = attachRes.body.imageIds[0];
  ok(`imageId: ${imageId}`);

  // ──────────────────────────────────────────────────────────────────
  step(7, 'GET klient-galleri-manifest (OFFENTLIG, ingen auth)');
  const manifestRes = await fetch(
    `${BASE_URL}/api/client/gallery/${accessToken}`,
    // Bevisst INGEN cookie — vi simulerer en kunde uten CreatorHub-konto
    { method: 'GET' },
  );
  if (!manifestRes.ok) {
    die(`Manifest-GET feilet: HTTP ${manifestRes.status}`);
  }
  const manifest = await manifestRes.json();
  ok(`Manifest OK — gallery: ${manifest.projectTitle}`);

  const imagesRes = await fetch(
    `${BASE_URL}/api/client/gallery/${accessToken}/images`,
    { method: 'GET' },
  );
  if (!imagesRes.ok) {
    die(`Images-GET feilet: HTTP ${imagesRes.status}`);
  }
  const imagesBody = await imagesRes.json();
  if (!imagesBody.images || imagesBody.images.length !== 1) {
    die(
      `Forventet 1 bilde, fikk ${imagesBody.images?.length}: ${JSON.stringify(imagesBody, null, 2)}`,
    );
  }
  const image = imagesBody.images[0];
  ok(`Bilde funnet i manifest, fullSizeUrl: ${image.fullSizeUrl}`);

  if (!image.fullSizeUrl?.includes('/files/') || !image.fullSizeUrl.includes(accessToken)) {
    die(
      `fullSizeUrl peker ikke til decrypt-proxy. Forventet '/api/client/gallery/<token>/files/<imageId>/download', fikk '${image.fullSizeUrl}'`,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  step(8, 'Last ned via decrypt-proxy (som kunde, uten auth)');
  // fullSizeUrl er relativ — gjør den absolutt
  const downloadUrl = image.fullSizeUrl.startsWith('http')
    ? image.fullSizeUrl
    : `${BASE_URL}${image.fullSizeUrl}`;
  const downloadRes = await fetch(downloadUrl, { method: 'GET' });
  if (!downloadRes.ok) {
    die(`Download-GET feilet: HTTP ${downloadRes.status}`);
  }
  const downloadedArrayBuf = await downloadRes.arrayBuffer();
  const downloaded = Buffer.from(downloadedArrayBuf);
  ok(`Lastet ned ${downloaded.length} bytes`);
  if (downloaded.length !== testFile.length) {
    die(
      `Størrelse mismatch: original=${testFile.length}, nedlastet=${downloaded.length}`,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  step(9, 'SHA-256 sammenligning');
  const downloadedHash = sha256(downloaded);
  info(`Original:    ${originalHash}`);
  info(`Nedlastet:   ${downloadedHash}`);
  if (originalHash !== downloadedHash) {
    die('SHA-256 mismatch — fil ble korrupt under encrypt/decrypt-round-trip');
  }
  ok('SHA-256 matcher — round-trip OK');

  // ──────────────────────────────────────────────────────────────────
  console.log(
    `\n${c.green}${c.bold}✓ PASS${c.reset} ${c.green}— hele e2e-flyten fungerer${c.reset}\n`,
  );
  console.log(`${c.dim}Galleri-lenke: ${BASE_URL}/client/gallery/${accessToken}${c.reset}`);
  console.log(`${c.dim}(åpne i inkognito-vindu for å verifisere klient-opplevelsen)${c.reset}\n`);
};

main().catch((err) => {
  console.error(`\n${c.red}${c.bold}UNCAUGHT:${c.reset}`, err);
  process.exit(1);
});
