#!/usr/bin/env node
/**
 * Post-deploy verification for Photo Enhancer lens correction (Lensfun).
 *
 * Two checks:
 *   1. READINESS (no RAW needed) — GET /api/photo-enhancer/status and assert
 *      rawSupport.lensCorrection.available (RawTherapee present). Reports
 *      whether the system Lensfun database is installed too.
 *   2. APPLIED (needs a RAW file) — POST the RAW to /api/photo-enhancer/enhance
 *      with lensCorrection enabled and assert the response shows it actually
 *      ran (rawConverter === "rawtherapee-lensfun" / lensCorrectionApplied).
 *
 * Usage:
 *   node scripts/verify-lens-correction.mjs --url https://your-backend
 *   node scripts/verify-lens-correction.mjs --url https://your-backend --raw shot.nef
 *   node scripts/verify-lens-correction.mjs --url ... --raw shot.nef --auth "$TOKEN"
 *
 * Exit code 0 = pass, 1 = fail. Requires Node 18+ (global fetch/FormData/Blob).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const baseUrl = (arg('url', process.env.PHOTO_ENHANCER_VERIFY_URL) || '').replace(/\/+$/, '');
const rawPath = arg('raw', null);
const authToken = arg('auth', process.env.PHOTO_ENHANCER_VERIFY_TOKEN || '');

if (!baseUrl) {
  console.error('✖ Missing --url (or PHOTO_ENHANCER_VERIFY_URL). Example:');
  console.error('  node scripts/verify-lens-correction.mjs --url https://your-backend');
  process.exit(1);
}

const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};

async function checkReadiness() {
  console.log(`→ GET ${baseUrl}/api/photo-enhancer/status`);
  const res = await fetch(`${baseUrl}/api/photo-enhancer/status`, { headers: authHeaders });
  if (!res.ok) {
    throw new Error(`status endpoint returned HTTP ${res.status}`);
  }
  const body = await res.json();
  const lens = body?.rawSupport?.lensCorrection;
  if (!lens) {
    throw new Error('rawSupport.lensCorrection missing — backend predates the lens-correction probe (redeploy needed).');
  }
  console.log(`  rawtherapee (lens correction):  ${lens.available ? '✓ available' : '✖ MISSING'}`);
  console.log(`  system Lensfun database:        ${lens.systemLensfunDatabase ? '✓ installed' : '· bundled-only (RawTherapee fallback)'}`);
  if (!lens.available) {
    throw new Error('Lens correction unavailable — rawtherapee-cli is not installed on the backend image.');
  }
  return body;
}

function rawMimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  const map = {
    '.nef': 'image/x-nikon-nef', '.cr2': 'image/x-canon-cr2', '.cr3': 'image/x-canon-cr3',
    '.arw': 'image/x-sony-arw', '.raf': 'image/x-fuji-raf', '.rw2': 'image/x-panasonic-rw2',
    '.orf': 'image/x-olympus-orf', '.dng': 'image/x-adobe-dng', '.pef': 'image/x-pentax-pef',
  };
  return map[ext] || 'application/octet-stream';
}

async function checkApplied() {
  console.log(`→ POST ${baseUrl}/api/photo-enhancer/enhance  (RAW: ${rawPath})`);
  const buffer = await readFile(rawPath);
  const form = new FormData();
  form.append('image', new Blob([buffer], { type: rawMimeFor(rawPath) }), path.basename(rawPath));
  form.append('preset', 'auto');
  form.append(
    'settings',
    JSON.stringify({
      lensCorrection: { enabled: true, auto: true, distortion: 0, vignette: 0, chromaticAberration: 0 },
      perFaceOverrides: [],
    }),
  );

  const res = await fetch(`${baseUrl}/api/photo-enhancer/enhance`, {
    method: 'POST',
    headers: authHeaders,
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`enhance returned HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  // The applied flag can live at the top level or under a job/source record.
  const applied = Boolean(
    body.lensCorrectionApplied ||
      body.source?.lensCorrectionApplied ||
      body.job?.source?.lensCorrectionApplied,
  );
  const converter =
    body.rawConverter || body.source?.rawConverter || body.job?.source?.rawConverter || null;
  console.log(`  RAW converter used:   ${converter ?? '(unknown)'}`);
  console.log(`  lensCorrectionApplied: ${applied ? '✓ true' : '✖ false'}`);
  if (!applied && converter !== 'rawtherapee-lensfun') {
    throw new Error(
      `Lens correction did not run — converter was "${converter}". Check that rawtherapee-cli + the Lensfun database are installed and that the lens is in the Lensfun DB.`,
    );
  }
}

try {
  await checkReadiness();
  if (rawPath) {
    await checkApplied();
  } else {
    console.log('· Skipping applied-check (no --raw file). Readiness only.');
  }
  console.log('\n✓ Lens correction verification passed.');
  process.exit(0);
} catch (error) {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
