/**
 * curate-from-freesound.ts
 *
 * Auto-kuratere ekte CC0-samples fra Freesound API per SFX-kategori.
 * Streng CC0-enforcement: hvert resultat sjekkes mot lisens-URL og
 * skippes hvis det IKKE er rent CC0. Ingen attribusjon-krav slipper
 * gjennom.
 *
 * Steg:
 *   1. Søk Freesound API per SFX_CATEGORY med English keyword
 *   2. Filter: license="Creative Commons 0", duration 0.5-10s
 *   3. Dobbeltsjekk lisens-URL i hvert resultat (defensiv)
 *   4. Last ned mp3-preview → konverter til 48kHz mono WAV via ffmpeg
 *   5. Skriv WAV til data/synthetic-samples/<file>.wav
 *   6. Skriv/oppdater manifest data/sfx-manifest.json
 *
 * Krav:
 *   - FREESOUND_API_KEY env-var (gratis registrering på
 *     freesound.org/apiv2/apply)
 *   - ffmpeg på PATH (sjekkes ved oppstart)
 *
 * Kjøring:
 *   FREESOUND_API_KEY=xyz npm run sfx:curate-freesound
 *   FREESOUND_API_KEY=xyz npm run sfx:curate-freesound -- --per-category 3
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// ============================================================================
// Konfig
// ============================================================================

const FREESOUND_API = 'https://freesound.org/apiv2';
const STRICT_CC0_LICENSE = 'http://creativecommons.org/publicdomain/zero/1.0/';
const STRICT_CC0_LICENSE_HTTPS = 'https://creativecommons.org/publicdomain/zero/1.0/';
const TARGET_SAMPLE_RATE = 48000;
const SAMPLES_DIR = 'data/synthetic-samples';
const MANIFEST_PATH = 'data/sfx-manifest.json';

// Kategorier vi henter fra. Holdt i sync med
// frontend/.../sfxCategories.ts. ID-en brukes som engelsk
// søk-query (kebab → space).
const CATEGORIES: Array<{ id: string; query: string; layer: 'event' | 'ambient' | 'music' }> = [
  // Event-lag
  { id: 'door-open', query: 'door opening', layer: 'event' },
  { id: 'door-close', query: 'door closing', layer: 'event' },
  { id: 'door-slam', query: 'door slam', layer: 'event' },
  { id: 'knock', query: 'knock on door', layer: 'event' },
  { id: 'footsteps-walking', query: 'footsteps walking', layer: 'event' },
  { id: 'footsteps-running', query: 'footsteps running', layer: 'event' },
  { id: 'gunshot', query: 'gunshot', layer: 'event' },
  { id: 'explosion', query: 'explosion', layer: 'event' },
  { id: 'punch', query: 'punch impact', layer: 'event' },
  { id: 'glass-break', query: 'glass break', layer: 'event' },
  { id: 'glass-clink', query: 'glass clink toast', layer: 'event' },
  { id: 'water-splash', query: 'water splash', layer: 'event' },
  { id: 'phone-ring', query: 'phone ringing', layer: 'event' },
  { id: 'phone-hangup', query: 'phone hang up', layer: 'event' },
  { id: 'beep', query: 'beep electronic', layer: 'event' },
  { id: 'click', query: 'click button', layer: 'event' },
  { id: 'siren', query: 'siren police', layer: 'event' },
  { id: 'thunder', query: 'thunder', layer: 'event' },
  { id: 'crowd-cheer', query: 'crowd cheer applause', layer: 'event' },
  { id: 'scream', query: 'human scream', layer: 'event' },
  { id: 'gasp', query: 'human gasp', layer: 'event' },
  { id: 'laugh', query: 'human laugh', layer: 'event' },
  { id: 'car-pass', query: 'car pass by', layer: 'event' },
  { id: 'car-start', query: 'car engine start', layer: 'event' },
  { id: 'car-crash', query: 'car crash impact', layer: 'event' },
  // Ambient-lag
  { id: 'rain', query: 'rain ambient', layer: 'ambient' },
  { id: 'wind', query: 'wind ambient', layer: 'ambient' },
  { id: 'traffic', query: 'traffic ambient', layer: 'ambient' },
  { id: 'crowd-murmur', query: 'crowd murmur background', layer: 'ambient' },
  { id: 'water-running', query: 'running water', layer: 'ambient' },
  { id: 'ambient-indoor', query: 'room tone interior', layer: 'ambient' },
  { id: 'ambient-outdoor', query: 'outdoor ambient nature', layer: 'ambient' },
  { id: 'ambient-night', query: 'night ambient crickets', layer: 'ambient' },
  { id: 'fight', query: 'fight scuffle', layer: 'ambient' },
];

// ============================================================================
// CLI args
// ============================================================================

interface CliArgs {
  perCategory: number;
  apiKey: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
  };
  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey) {
    console.error('[curate-freesound] mangler FREESOUND_API_KEY env-var.');
    console.error('  Få nøkkel gratis på https://freesound.org/apiv2/apply/');
    process.exit(1);
  }
  return {
    perCategory: Math.max(1, Math.min(5, parseInt(get('--per-category', '2'), 10))),
    apiKey,
  };
}

// ============================================================================
// Verktøy
// ============================================================================

export function isCc0License(licenseUrl: string | undefined): boolean {
  if (!licenseUrl || typeof licenseUrl !== 'string') return false;
  // Krev streng URL-parsing for å unngå look-alike-domener.
  let parsed: URL;
  try {
    parsed = new URL(licenseUrl.trim());
  } catch {
    return false;
  }
  // Hostname må være EXAKT creativecommons.org — ingen subdomener,
  // ingen look-alikes (creativecommons.evil.com osv.).
  if (parsed.hostname.toLowerCase() !== 'creativecommons.org') return false;
  // Path må starte med /publicdomain/zero/1.0 (med valgfri trailing slash).
  const path = parsed.pathname.toLowerCase().replace(/\/+$/, '');
  return path === '/publicdomain/zero/1.0';
}

async function checkFfmpeg(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-version']);
    proc.on('error', () => reject(new Error('ffmpeg ikke funnet på PATH')));
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg returnerte exit ${code}`));
    });
  });
}

/**
 * Konverter en URL (mp3) direkte til mono 48kHz WAV på disk.
 * ffmpeg leser HTTP-URL via input-protokoll, dekoder, konverterer,
 * og skriver output i ett pass.
 */
async function convertMp3UrlToWav(mp3Url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',                 // overskrive
      '-loglevel', 'error',
      '-i', mp3Url,
      '-ac', '1',           // mono
      '-ar', String(TARGET_SAMPLE_RATE),
      '-f', 'wav',
      outputPath,
    ];
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 200)}`));
    });
  });
}

// ============================================================================
// Freesound API
// ============================================================================

interface FreesoundSound {
  id: number;
  name: string;
  username: string;
  url: string;
  license: string;
  duration: number;
  avg_rating: number;
  num_ratings: number;
  previews: {
    'preview-hq-mp3'?: string;
    'preview-lq-mp3'?: string;
  };
  tags: string[];
}

async function searchFreesound(opts: {
  apiKey: string;
  query: string;
  pageSize: number;
}): Promise<FreesoundSound[]> {
  const params = new URLSearchParams({
    query: opts.query,
    // Filter på CC0-lisens + varighet 0.5-10s.
    filter: 'license:"Creative Commons 0" duration:[0.5 TO 10]',
    fields: 'id,name,username,url,license,duration,avg_rating,num_ratings,previews,tags',
    page_size: String(opts.pageSize),
    sort: 'rating_desc',
    token: opts.apiKey,
  });
  const url = `${FREESOUND_API}/search/text/?${params.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Freesound API ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json() as { results: FreesoundSound[] };
  return data.results ?? [];
}

// ============================================================================
// Manifest-skriving
// ============================================================================

interface ManifestSample {
  id: string;
  title: string;
  url: string;
  sourcePath: string;
  categoryId: string;
  license: 'CC0';
  attribution: string;
  durationSec: number;
  tags?: string[];
}

interface Manifest {
  $schema?: string;
  comment?: string;
  samples: ManifestSample[];
}

function loadOrInitManifest(): Manifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      if (Array.isArray(parsed.samples)) return parsed;
    } catch {
      // korrupt manifest — start fra null
    }
  }
  return {
    $schema: 'Auto-generert manifest med ekte CC0-samples fra Freesound.',
    comment: 'Disse er rene CC0-samples — fri kommersiell bruk uten attribusjon. Attribusjons-feltet er bevart for åpenhet, ikke krav.',
    samples: [],
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs();
  console.log(`[curate-freesound] kategorier: ${CATEGORIES.length}, per kategori: ${args.perCategory}`);

  console.log('[curate-freesound] sjekker ffmpeg…');
  await checkFfmpeg();
  console.log('[curate-freesound] ffmpeg OK');

  fs.mkdirSync(SAMPLES_DIR, { recursive: true });

  const manifest = loadOrInitManifest();
  // Bygg en map av eksisterende IDs så vi ikke duplikat-legger.
  const existingIds = new Set(manifest.samples.map((s) => s.id));

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let i = 0; i < CATEGORIES.length; i += 1) {
    const cat = CATEGORIES[i];
    process.stdout.write(`[${i + 1}/${CATEGORIES.length}] ${cat.id} ("${cat.query}") … `);

    let sounds: FreesoundSound[];
    try {
      sounds = await searchFreesound({
        apiKey: args.apiKey,
        query: cat.query,
        pageSize: Math.max(args.perCategory * 3, 10), // hent ekstra i tilfelle vi må skippe
      });
    } catch (err: any) {
      process.stdout.write(`SØKE-FEIL (${err?.message?.slice(0, 80) ?? err})\n`);
      totalErrors += 1;
      continue;
    }

    let downloadedForCategory = 0;
    for (const sound of sounds) {
      if (downloadedForCategory >= args.perCategory) break;

      // STRENG CC0-VERIFISERING — selv om filter var satt på query,
      // dobbeltsjekker vi her som siste sikkerhetsventil.
      if (!isCc0License(sound.license)) {
        console.error(`\n  [SECURITY] Sound ${sound.id} returnert med non-CC0 lisens "${sound.license}" — SKIPPER`);
        totalSkipped += 1;
        continue;
      }

      const sampleId = `freesound-${cat.id}-${sound.id}`;
      if (existingIds.has(sampleId)) {
        // Allerede i manifestet — hopp over.
        continue;
      }

      const previewUrl = sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'];
      if (!previewUrl) {
        totalSkipped += 1;
        continue;
      }

      const wavFilename = `${sampleId}.wav`;
      const wavPath = path.join(SAMPLES_DIR, wavFilename);
      try {
        await convertMp3UrlToWav(previewUrl, wavPath);
      } catch (err: any) {
        console.error(`\n  konvertering feilet for ${sound.id}: ${err?.message?.slice(0, 80)}`);
        totalErrors += 1;
        continue;
      }

      manifest.samples.push({
        id: sampleId,
        title: sound.name,
        url: `/api/sfx/static/${wavFilename}`,
        sourcePath: wavPath,
        categoryId: cat.id,
        license: 'CC0',
        attribution: `Freesound: ${sound.username} (${sound.url}) — ikke krevd under CC0, men bevart for åpenhet`,
        durationSec: sound.duration,
        tags: sound.tags?.slice(0, 5),
      });
      existingIds.add(sampleId);
      downloadedForCategory += 1;
      totalDownloaded += 1;

      // Vær snill mot Freesound: 100ms pause mellom requests.
      await new Promise((r) => setTimeout(r, 100));
    }

    process.stdout.write(`${downloadedForCategory} samples ✓\n`);
  }

  // Atomisk skriving av manifest.
  const tmpManifest = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tmpManifest, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmpManifest, MANIFEST_PATH);

  console.log('\n──────────────────────────────────────');
  console.log(`[curate-freesound] FERDIG`);
  console.log(`  Lastet ned:    ${totalDownloaded} samples`);
  console.log(`  Skipped:       ${totalSkipped} (non-CC0 eller manglende preview)`);
  console.log(`  Feil:          ${totalErrors}`);
  console.log(`  Manifest:      ${manifest.samples.length} totalt`);
  console.log('──────────────────────────────────────');
  console.log('Neste steg:');
  console.log('  npm run sfx:build         # CLAP-embeddings for de nye samplene');
  console.log('  POST /api/sfx/library/reload  # eller restart server');
}

// Kjør kun når scriptet kalles direkte (ikke import for tester).
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === `file://${path.resolve(process.argv[1])}`;
if (isMain) {
  main().catch((err) => {
    console.error('[curate-freesound] kritisk feil:', err);
    process.exit(1);
  });
}
