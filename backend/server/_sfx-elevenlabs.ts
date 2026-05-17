/**
 * _sfx-elevenlabs.ts
 *
 * Privat backend-modul som kaller ElevenLabs Sound Effects API
 * når CLAP-match ikke har gode treff. Disk-cacher resultatet per
 * sha256(prompt+duration) så vi ikke betaler for samme generering
 * to ganger.
 *
 * API-referanse: POST https://api.elevenlabs.io/v1/sound-generation
 *   Headers: xi-api-key
 *   Body: { text, model_id?, duration_seconds?, prompt_influence?, loop? }
 *   Response: application/octet-stream (binary mp3)
 *
 * Kost-vern: vi setter en hard maks-varighet (10s) som ekstra
 * sikkerhet. Hver generering koster ~200 credits default eller
 * 40 credits per sekund. Med 10s tak: maks ~$0.04 per kall hos
 * Creator-plan.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ELEVENLABS_SFX_URL = 'https://api.elevenlabs.io/v1/sound-generation';
const DEFAULT_MODEL = 'eleven_text_to_sound_v2';
const MAX_DURATION_SEC = 10;
const MIN_DURATION_SEC = 0.5;
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';

export interface GenerateSfxRequest {
  prompt: string;
  durationSec?: number;
  promptInfluence?: number;
  loop?: boolean;
}

export interface GenerateSfxResult {
  /** Hash som identifiserer denne kombinasjonen — brukes som filnavn. */
  cacheKey: string;
  /** Absolutt sti på disk hvor mp3 ligger. */
  filePath: string;
  /** Public URL klient kan hente fra. */
  url: string;
  /** True hvis returnert fra cache, false hvis nettopp generert. */
  cached: boolean;
  /** Filstørrelse i bytes. */
  sizeBytes: number;
}

export class ElevenLabsError extends Error {
  public readonly status?: number;
  public readonly retryable: boolean;
  constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

function getCacheDir(): string {
  const dir = process.env.SFX_GENERATED_DIR
    ?? path.resolve(process.cwd(), 'data', 'sfx-generated');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildCacheKey(req: GenerateSfxRequest): string {
  const normalized = {
    p: req.prompt.trim().toLowerCase(),
    d: req.durationSec ?? null,
    i: req.promptInfluence ?? null,
    l: req.loop ?? false,
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 32);
}

function clampDuration(d: number | undefined): number | null {
  if (d === undefined || d === null) return null;
  if (!Number.isFinite(d)) return null;
  return Math.max(MIN_DURATION_SEC, Math.min(MAX_DURATION_SEC, d));
}

/**
 * Sjekk om en generering allerede er cachet på disk.
 */
export function getCachedSfx(req: GenerateSfxRequest): GenerateSfxResult | null {
  const cacheKey = buildCacheKey(req);
  const filePath = path.join(getCacheDir(), `${cacheKey}.mp3`);
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    cacheKey,
    filePath,
    url: `/api/sfx/generated/${cacheKey}.mp3`,
    cached: true,
    sizeBytes: stat.size,
  };
}

/**
 * Generer en SFX via ElevenLabs API + lagre til disk-cache.
 * Hvis allerede cachet, returneres cache-resultatet uten API-kall.
 *
 * @param req - prompt + optional duration/influence/loop
 * @param apiKey - hvis ikke gitt, leses fra process.env.ELEVENLABS_API_KEY
 */
export async function generateSfx(
  req: GenerateSfxRequest,
  apiKey?: string,
): Promise<GenerateSfxResult> {
  // 1. Sjekk cache først
  const cached = getCachedSfx(req);
  if (cached) return cached;

  // 2. Hent API-nøkkel
  const key = apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new ElevenLabsError(
      'ELEVENLABS_API_KEY mangler. Sett env-var for å bruke AI-generering.',
      503,
      false,
    );
  }

  // 3. Bygg request-body
  const body: Record<string, unknown> = {
    text: req.prompt,
    model_id: DEFAULT_MODEL,
  };
  const clampedDur = clampDuration(req.durationSec);
  if (clampedDur !== null) body.duration_seconds = clampedDur;
  if (req.promptInfluence !== undefined) body.prompt_influence = req.promptInfluence;
  if (req.loop !== undefined) body.loop = req.loop;

  // 4. Kall API
  const url = `${ELEVENLABS_SFX_URL}?output_format=${DEFAULT_OUTPUT_FORMAT}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    throw new ElevenLabsError(
      `Nettverksfeil mot ElevenLabs: ${err?.message ?? String(err)}`,
      undefined,
      true,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const retryable = response.status === 429 || response.status >= 500;
    throw new ElevenLabsError(
      `ElevenLabs returnerte ${response.status}: ${text.slice(0, 200)}`,
      response.status,
      retryable,
    );
  }

  // 5. Lagre til disk-cache
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);
  if (audioBuffer.length < 100) {
    throw new ElevenLabsError(
      `ElevenLabs returnerte for liten payload (${audioBuffer.length} bytes)`,
      response.status,
      false,
    );
  }

  const cacheKey = buildCacheKey(req);
  const filePath = path.join(getCacheDir(), `${cacheKey}.mp3`);

  // Atomisk skriving — skriv til .tmp først, så rename.
  const tmpPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tmpPath, audioBuffer);
  await fs.promises.rename(tmpPath, filePath);

  return {
    cacheKey,
    filePath,
    url: `/api/sfx/generated/${cacheKey}.mp3`,
    cached: false,
    sizeBytes: audioBuffer.length,
  };
}

/**
 * Server en cachet SFX-fil fra disk. Returnerer null hvis ikke funnet.
 * Defensiv mot path-traversal: cacheKey må være ren hex.
 */
export function loadGeneratedSfxFile(cacheKey: string): { stream: fs.ReadStream; sizeBytes: number } | null {
  // Path-traversal-vern: cacheKey må være 32 hex-tegn.
  if (!/^[a-f0-9]{1,64}$/.test(cacheKey)) return null;
  const filePath = path.join(getCacheDir(), `${cacheKey}.mp3`);
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    stream: fs.createReadStream(filePath),
    sizeBytes: stat.size,
  };
}

/**
 * Test-helper: eksponer buildCacheKey for assertion i tester.
 */
export const _internalForTests = { buildCacheKey, clampDuration };
