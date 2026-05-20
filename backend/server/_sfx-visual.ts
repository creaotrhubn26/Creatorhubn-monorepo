/**
 * _sfx-visual.ts
 *
 * Visuell SFX-deteksjon via Claude vision. Sender et storyboard-frame
 * (PNG/JPEG/WebP som dataURL eller base64) til Anthropic + spør om
 * detekterte sound-events med strukturert tool_use-output.
 *
 * Tre lag:
 *   1. Streng allowed-list av categoryIds — Claude må velge fra disse
 *   2. Disk-cache per sha256(image-bytes + frame-duration) — samme
 *      frame analyseres aldri to ganger uten override
 *   3. Tool-use-schema gir parsed JSON, ingen brittle text-parsing
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { logAIUsage } from './ai-usage-tracker.js';

// Holdt i sync med frontend/.../sfxCategories.ts. Kategorier som er
// tilgjengelige for Claude å velge fra.
export const SFX_CATEGORY_IDS = [
  'door-open', 'door-close', 'door-slam', 'knock',
  'footsteps-walking', 'footsteps-running',
  'thunder', 'rain', 'wind',
  'car-pass', 'car-start', 'car-crash', 'traffic', 'siren',
  'gunshot', 'explosion', 'punch', 'fight',
  'glass-break', 'glass-clink',
  'water-splash', 'water-running',
  'phone-ring', 'phone-hangup', 'beep', 'click',
  'crowd-murmur', 'crowd-cheer', 'scream', 'gasp', 'laugh',
  'music-tense', 'music-soft', 'music-action',
  'ambient-indoor', 'ambient-outdoor', 'ambient-night',
] as const;

export type SfxCategoryId = typeof SFX_CATEGORY_IDS[number];

const ALLOWED_CATEGORIES = new Set<string>(SFX_CATEGORY_IDS);
const ALLOWED_INTENSITIES = new Set(['low', 'medium', 'high']);
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

const SYSTEM_PROMPT = `You analyze storyboard panels and identify sound effects that should accompany the moment depicted. You're helping a storyboard artist build the audio bed for an animatic.

What to look for:
1. Explicit SFX text drawn in the panel ("BANG!", "CRASH", "RING RING", "WHOOSH") — high confidence
2. Objects in active use (doors mid-swing, ringing phones, breaking glass, mouths open mid-shout)
3. Motion lines / speed lines indicating impact, movement, or force
4. Multi-pose sequences showing action across the panel — events at distinct timing
5. Atmospheric/environmental cues (rain, wind, traffic, crowds)
6. Character emotional state suggesting vocalizations (gasping, laughing, screaming)

Rules:
- Only use categoryIds from the allowed list — never invent new ones
- offsetSec MUST be between 0 and (frame_duration - 0.1)
- If panel is empty or pure background with no detectable events, return events: []
- Be conservative: only report events with clear visual evidence
- Rationale should be ONE short sentence describing the visual evidence`;

const VISION_TOOL = {
  name: 'report_sfx_events',
  description: 'Report sound effects detected in the storyboard panel with timing',
  input_schema: {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            categoryId: {
              type: 'string',
              enum: SFX_CATEGORY_IDS,
              description: 'One of the allowed SFX category IDs',
            },
            offsetSec: {
              type: 'number',
              description: 'Seconds from frame start when the SFX should fire',
            },
            intensity: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Loudness/strength of the SFX',
            },
            rationale: {
              type: 'string',
              description: 'One sentence explaining the visual evidence',
            },
          },
          required: ['categoryId', 'offsetSec', 'intensity'],
        },
      },
    },
    required: ['events'],
  },
};

// ============================================================================
// Typer
// ============================================================================

export interface VisualSfxEvent {
  categoryId: SfxCategoryId;
  offsetSec: number;
  intensity: 'low' | 'medium' | 'high';
  rationale?: string;
}

export interface DetectVisualSfxInput {
  /** base64-encoded image-bytes (uten data-URL-prefiks). */
  imageBase64: string;
  /** MIME-type. Må være i ALLOWED_MIME_TYPES. */
  mimeType: string;
  /** Frame-varighet i sekunder, brukes til å bound offsets. */
  frameDurationSec: number;
}

export interface DetectVisualSfxResult {
  events: VisualSfxEvent[];
  cached: boolean;
  /** Hash som identifiserer denne analysen i cachen. */
  cacheKey: string;
}

export class VisualDetectError extends Error {
  public readonly status?: number;
  public readonly retryable: boolean;
  constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

// ============================================================================
// Cache-helpers
// ============================================================================

function getCacheDir(): string {
  const dir = process.env.SFX_VISUAL_CACHE_DIR
    ?? path.resolve(process.cwd(), 'data', 'sfx-visual-cache');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildCacheKey(input: DetectVisualSfxInput): string {
  // Hash på image + duration så samme bilde + samme varighet = samme cache.
  const hash = crypto.createHash('sha256');
  hash.update(input.imageBase64);
  hash.update(`|${input.mimeType}|${input.frameDurationSec.toFixed(3)}`);
  return hash.digest('hex').slice(0, 32);
}

export function getCachedVisualSfx(input: DetectVisualSfxInput): DetectVisualSfxResult | null {
  const cacheKey = buildCacheKey(input);
  const filePath = path.join(getCacheDir(), `${cacheKey}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(parsed.events)) return null;
    return { events: parsed.events, cached: true, cacheKey };
  } catch {
    return null;
  }
}

function writeCacheAtomic(cacheKey: string, events: VisualSfxEvent[]): void {
  const filePath = path.join(getCacheDir(), `${cacheKey}.json`);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ events, builtAt: new Date().toISOString() }, null, 2));
  fs.renameSync(tmpPath, filePath);
}

// ============================================================================
// Validering — Claude kan i prinsippet returnere noe rart, vi sjekker alt
// ============================================================================

function validateEvents(raw: unknown, maxOffsetSec: number): VisualSfxEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  const events = (raw as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  const valid: VisualSfxEvent[] = [];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const e = ev as Record<string, unknown>;
    if (typeof e.categoryId !== 'string' || !ALLOWED_CATEGORIES.has(e.categoryId)) continue;
    if (typeof e.offsetSec !== 'number' || !Number.isFinite(e.offsetSec)) continue;
    if (typeof e.intensity !== 'string' || !ALLOWED_INTENSITIES.has(e.intensity)) continue;
    valid.push({
      categoryId: e.categoryId as SfxCategoryId,
      offsetSec: Math.max(0, Math.min(maxOffsetSec, e.offsetSec)),
      intensity: e.intensity as 'low' | 'medium' | 'high',
      rationale: typeof e.rationale === 'string' ? e.rationale.slice(0, 200) : undefined,
    });
  }
  return valid;
}

// ============================================================================
// Hoved-API
// ============================================================================

export interface ClaudeClient {
  messages: {
    create: (params: Record<string, unknown>) => Promise<{
      content?: Array<{
        type: string;
        name?: string;
        input?: unknown;
      }>;
    }>;
  };
}

/**
 * Kjør visuell SFX-analyse mot Claude vision.
 *
 * @param input - image + duration
 * @param clientFactory - lazy-loadet eller injisert (for tester)
 */
export async function detectVisualSfx(
  input: DetectVisualSfxInput,
  clientFactory?: () => Promise<ClaudeClient>,
): Promise<DetectVisualSfxResult> {
  // 1. Validér input
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType as any)) {
    throw new VisualDetectError(`Ustøttet MIME-type: ${input.mimeType}`, 400, false);
  }
  if (!input.imageBase64 || input.imageBase64.length < 100) {
    throw new VisualDetectError('imageBase64 mangler eller er for liten', 400, false);
  }
  if (!Number.isFinite(input.frameDurationSec) || input.frameDurationSec <= 0) {
    throw new VisualDetectError('frameDurationSec må være positiv', 400, false);
  }
  const maxOffset = Math.max(0, input.frameDurationSec - 0.1);

  // 2. Cache-sjekk
  const cached = getCachedVisualSfx(input);
  if (cached) return cached;

  // 3. Bygg Claude-klient
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !clientFactory) {
    throw new VisualDetectError('ANTHROPIC_API_KEY ikke satt', 503, false);
  }

  let client: ClaudeClient;
  if (clientFactory) {
    client = await clientFactory();
  } else {
    try {
      const mod: any = await import('@anthropic-ai/sdk');
      const AnthropicCtor = mod.default ?? mod.Anthropic;
      client = new AnthropicCtor({
        apiKey,
        maxRetries: 1,
        timeout: 30_000,
      });
    } catch (err: any) {
      throw new VisualDetectError(
        `Klarte ikke laste Anthropic SDK: ${err?.message ?? String(err)}`,
        503,
        false,
      );
    }
  }

  // 4. Kall Claude
  const model = process.env.SFX_VISUAL_MODEL || 'claude-haiku-4-5-20251001';
  let response: Awaited<ReturnType<ClaudeClient['messages']['create']>>;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [VISION_TOOL],
      tool_choice: { type: 'tool', name: 'report_sfx_events' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: input.mimeType,
                data: input.imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analyze this storyboard panel. Frame duration: ${input.frameDurationSec.toFixed(2)}s. List sound effects with timing offsets (0 to ${maxOffset.toFixed(2)}s).`,
            },
          ],
        },
      ],
    });
    logAIUsage(response as any, { feature: 'role-room/sfx-visual' }).catch(() => undefined);
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    const retryable = status === 429 || (status && status >= 500);
    throw new VisualDetectError(
      `Claude vision-call feilet: ${err?.message ?? String(err)}`,
      status,
      retryable,
    );
  }

  // 5. Hent ut tool_use-resultat
  const toolUse = (response.content ?? []).find(
    (block) => block?.type === 'tool_use' && block?.name === 'report_sfx_events',
  );
  if (!toolUse || typeof toolUse.input !== 'object') {
    throw new VisualDetectError('Claude returnerte ikke tool_use-blokk', 502, true);
  }

  const validatedEvents = validateEvents(toolUse.input, maxOffset);
  const cacheKey = buildCacheKey(input);
  writeCacheAtomic(cacheKey, validatedEvents);

  return { events: validatedEvents, cached: false, cacheKey };
}

/**
 * Test-helper for å eksponere internals.
 */
export const _internalForTests = {
  buildCacheKey,
  validateEvents,
  SFX_CATEGORY_IDS,
};
