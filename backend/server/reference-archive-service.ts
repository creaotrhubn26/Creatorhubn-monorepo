/**
 * Reference frame archive — service layer.
 *
 * Owns three things:
 *   1. Claude Vision auto-tagging (analyseFrame)
 *   2. DB read/write for role_room_reference_frames
 *   3. Optional R2 upload (uploadFrameToR2) so the caller doesn't have to
 *      host the bytes themselves — we reuse the Capture R2 bucket with a
 *      dedicated `reference-archive/` prefix and sign 7-day GET URLs.
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { buildCaptureR2Config } from './capture-upload-service.js';
import { logAIUsage } from './ai-usage-tracker.js';

const MAX_IMAGE_BASE64_BYTES = 6 * 1024 * 1024; // ~4.5 MB decoded

export type ReferenceFrameTagsShotType =
  | 'wide'
  | 'medium'
  | 'close-up'
  | 'extreme-close-up'
  | 'over-the-shoulder'
  | 'two-shot'
  | 'insert'
  | 'aerial'
  | 'unknown';

export interface ReferenceFrameClaudeTags {
  shotType: ReferenceFrameTagsShotType;
  cameraAngle: string;
  lensRange: string;
  lightingMood: string;
  colorPalette: string[];
  composition: string;
  timeOfDay: string;
  suggestedCinematographerStyle: string;
  keywords: string[];
}

export interface ReferenceFrame {
  id: string;
  ownerUserId: string;
  uploadedByUserId: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  filmTitle: string | null;
  cinematographer: string | null;
  year: number | null;
  notes: string | null;
  claudeTags: ReferenceFrameClaudeTags;
  userTags: string[];
  usedOnProjectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type AnalyseFrameResult =
  | { ok: true; tags: ReferenceFrameClaudeTags; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: 'not_configured' | 'image_too_large' | 'invalid_response'; detail?: string };

const SHOT_TYPES: readonly ReferenceFrameTagsShotType[] = [
  'wide',
  'medium',
  'close-up',
  'extreme-close-up',
  'over-the-shoulder',
  'two-shot',
  'insert',
  'aerial',
  'unknown',
];

const EMPTY_TAGS: ReferenceFrameClaudeTags = {
  shotType: 'unknown',
  cameraAngle: '',
  lensRange: '',
  lightingMood: '',
  colorPalette: [],
  composition: '',
  timeOfDay: '',
  suggestedCinematographerStyle: '',
  keywords: [],
};

const SYSTEM_PROMPT = `You tag film stills and photography frames for a cinematographer's searchable reference archive.

Return your analysis by calling the tag_reference_frame tool. Be precise and terse — your tags feed a keyword search, not marketing copy. If a field is not confidently determinable, use an empty string rather than guessing.

Fields:
- shotType: one of wide | medium | close-up | extreme-close-up | over-the-shoulder | two-shot | insert | aerial | unknown
- cameraAngle: free text (e.g. "low angle", "dutch tilt 15deg", "bird's eye", "eye-level")
- lensRange: approximate lens/focal length (e.g. "24-35mm", "85mm+", "anamorphic 40mm")
- lightingMood: short descriptor (e.g. "high-key soft", "low-key neon", "golden-hour rim")
- colorPalette: 3-6 dominant hex colour codes in "#rrggbb" format
- composition: short descriptor (e.g. "rule-of-thirds left", "centered negative space", "leading lines")
- timeOfDay: "day" | "night" | "dusk" | "dawn" | "interior" | "unknown"
- suggestedCinematographerStyle: at most one name (e.g. "Deakins", "Lubezki", "Khondji", "Bhardwaj") — empty if not clearly derivative
- keywords: 4-8 short lowercase keywords the cinematographer would search for (e.g. "interior", "solitude", "warm-highlights", "tungsten", "practicals")`;

const TAG_TOOL = {
  name: 'tag_reference_frame',
  description: 'Record structured tags for one film/photography reference frame.',
  input_schema: {
    type: 'object',
    required: [
      'shotType',
      'cameraAngle',
      'lensRange',
      'lightingMood',
      'colorPalette',
      'composition',
      'timeOfDay',
      'suggestedCinematographerStyle',
      'keywords',
    ],
    properties: {
      shotType: { type: 'string', enum: SHOT_TYPES as unknown as string[] },
      cameraAngle: { type: 'string' },
      lensRange: { type: 'string' },
      lightingMood: { type: 'string' },
      colorPalette: {
        type: 'array',
        items: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        minItems: 0,
        maxItems: 8,
      },
      composition: { type: 'string' },
      timeOfDay: { type: 'string' },
      suggestedCinematographerStyle: { type: 'string' },
      keywords: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 12 },
    },
  },
} as const;

function clampShotType(value: unknown): ReferenceFrameTagsShotType {
  if (typeof value === 'string' && (SHOT_TYPES as readonly string[]).includes(value)) {
    return value as ReferenceFrameTagsShotType;
  }
  return 'unknown';
}

function asStringArray(value: unknown, maxLen = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .slice(0, maxLen);
}

function asHexArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v),
    )
    .slice(0, 8);
}

export function sanitiseTags(raw: unknown): ReferenceFrameClaudeTags {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    shotType: clampShotType(r.shotType),
    cameraAngle: typeof r.cameraAngle === 'string' ? r.cameraAngle : '',
    lensRange: typeof r.lensRange === 'string' ? r.lensRange : '',
    lightingMood: typeof r.lightingMood === 'string' ? r.lightingMood : '',
    colorPalette: asHexArray(r.colorPalette),
    composition: typeof r.composition === 'string' ? r.composition : '',
    timeOfDay: typeof r.timeOfDay === 'string' ? r.timeOfDay : '',
    suggestedCinematographerStyle:
      typeof r.suggestedCinematographerStyle === 'string'
        ? r.suggestedCinematographerStyle
        : '',
    keywords: asStringArray(r.keywords).map((k) => k.toLowerCase()),
  };
}

export interface AnalyseFrameInput {
  imageBase64: string;
  mime: string;
  hintFilmTitle?: string;
  hintCinematographer?: string;
}

export async function analyseFrame(input: AnalyseFrameInput): Promise<AnalyseFrameResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: 'not_configured' };
  if (!input.imageBase64 || input.imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
    return { ok: false, error: 'image_too_large' };
  }

  let client: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 1,
      timeout: 20_000,
    });
  } catch (err) {
    return { ok: false, error: 'not_configured', detail: String(err) };
  }

  const hintLine = [
    input.hintFilmTitle ? `Hint: from film "${input.hintFilmTitle}".` : '',
    input.hintCinematographer ? `Hint: cinematographer "${input.hintCinematographer}".` : '',
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const response = await client.messages.create({
      model: process.env.REFERENCE_ARCHIVE_VISION_MODEL || 'claude-opus-4-7',
      max_tokens: 900,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      tools: [TAG_TOOL],
      tool_choice: { type: 'tool', name: 'tag_reference_frame' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: input.mime, data: input.imageBase64 },
            },
            {
              type: 'text',
              text:
                hintLine ||
                'Tag this frame for a cinematographer reference archive.',
            },
          ],
        },
      ],
    });
    logAIUsage(response as any, { feature: 'role-room/reference-archive' }).catch(() => undefined);
    const toolUse = (response.content ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) => b?.type === 'tool_use' && b?.name === 'tag_reference_frame',
    );
    if (!toolUse || typeof toolUse.input !== 'object') {
      return { ok: false, error: 'invalid_response', detail: 'no tool_use block' };
    }
    return {
      ok: true,
      tags: sanitiseTags(toolUse.input),
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (err) {
    return { ok: false, error: 'invalid_response', detail: String(err) };
  }
}

// ──────────────────────────── Storage (R2) ─────────────────────────────

const READ_URL_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d — AWS/R2 hard ceiling

let storageClient: S3Client | null = null;

function getStorageClient(): { client: S3Client; bucket: string } | null {
  const cfg = buildCaptureR2Config();
  if (!cfg.enabled || !cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    return null;
  }
  if (!storageClient) {
    storageClient = new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return { client: storageClient, bucket: cfg.bucket };
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export type UploadFrameResult =
  | { ok: true; sourceUrl: string; storageKey: string }
  | { ok: false; error: 'storage_not_configured' | 'upload_failed'; detail?: string };

export async function uploadFrameToR2(input: {
  ownerUserId: string;
  imageBase64: string;
  mime: string;
}): Promise<UploadFrameResult> {
  const storage = getStorageClient();
  if (!storage) return { ok: false, error: 'storage_not_configured' };

  const ext = EXT_BY_MIME[input.mime] ?? 'bin';
  const key = `reference-archive/${input.ownerUserId}/${randomUUID()}.${ext}`;
  const body = Buffer.from(input.imageBase64, 'base64');

  try {
    await storage.client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: body,
        ContentType: input.mime,
      }),
    );
    const signedUrl = await getSignedUrl(
      storage.client,
      new PutObjectCommand({ Bucket: storage.bucket, Key: key }),
      { expiresIn: READ_URL_TTL_SECONDS },
    );
    // PutObjectCommand presign works for reads too on R2 when used with GET,
    // but for clarity we issue a GetObjectCommand presign below. Fall back to
    // a direct R2 public URL if the bucket is public-read configured.
    void signedUrl;
    // Real read-URL path — sign a GET.
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const readUrl = await getSignedUrl(
      storage.client,
      new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
      { expiresIn: READ_URL_TTL_SECONDS },
    );
    return { ok: true, sourceUrl: readUrl, storageKey: key };
  } catch (err) {
    return { ok: false, error: 'upload_failed', detail: String(err) };
  }
}

// ──────────────────────────── DB layer ────────────────────────────

function mapRow(row: Record<string, unknown>): ReferenceFrame {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    uploadedByUserId: String(row.uploaded_by_user_id),
    sourceUrl: String(row.source_url),
    thumbnailUrl: row.thumbnail_url == null ? null : String(row.thumbnail_url),
    filmTitle: row.film_title == null ? null : String(row.film_title),
    cinematographer: row.cinematographer == null ? null : String(row.cinematographer),
    year: row.year == null ? null : Number(row.year),
    notes: row.notes == null ? null : String(row.notes),
    claudeTags: sanitiseTags(row.claude_tags),
    userTags: Array.isArray(row.user_tags) ? (row.user_tags as string[]) : [],
    usedOnProjectIds: Array.isArray(row.used_on_project_ids)
      ? (row.used_on_project_ids as string[])
      : [],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export interface CreateReferenceFrameInput {
  ownerUserId: string;
  uploadedByUserId: string;
  sourceUrl: string;
  thumbnailUrl?: string | null;
  filmTitle?: string | null;
  cinematographer?: string | null;
  year?: number | null;
  notes?: string | null;
  claudeTags: ReferenceFrameClaudeTags;
  userTags?: string[];
  usedOnProjectIds?: string[];
}

export async function createReferenceFrame(
  pool: Pool,
  input: CreateReferenceFrameInput,
): Promise<ReferenceFrame> {
  const { rows } = await pool.query(
    `INSERT INTO role_room_reference_frames (
      owner_user_id, uploaded_by_user_id, source_url, thumbnail_url,
      film_title, cinematographer, year, notes,
      claude_tags, user_tags, used_on_project_ids
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
    RETURNING *`,
    [
      input.ownerUserId,
      input.uploadedByUserId,
      input.sourceUrl,
      input.thumbnailUrl ?? null,
      input.filmTitle ?? null,
      input.cinematographer ?? null,
      input.year ?? null,
      input.notes ?? null,
      JSON.stringify(input.claudeTags),
      input.userTags ?? [],
      input.usedOnProjectIds ?? [],
    ],
  );
  return mapRow(rows[0]);
}

export interface SearchReferenceFramesInput {
  ownerUserId: string;
  query?: string;
  shotType?: ReferenceFrameTagsShotType;
  cinematographer?: string;
  timeOfDay?: string;
  limit?: number;
  offset?: number;
}

/**
 * Free-text + faceted search across the owner's archive. Uses the
 * GIN indexes created in migration 0057:
 *   - claude_tags @> '{"shotType":"..."}'  (jsonb_path_ops)
 *   - user_tags && ARRAY[...]               (GIN)
 *   - ILIKE on text fields                  (seq scan for small sets)
 */
export async function searchReferenceFrames(
  pool: Pool,
  input: SearchReferenceFramesInput,
): Promise<ReferenceFrame[]> {
  const clauses: string[] = ['owner_user_id = $1'];
  const params: unknown[] = [input.ownerUserId];

  if (input.shotType) {
    params.push(JSON.stringify({ shotType: input.shotType }));
    clauses.push(`claude_tags @> $${params.length}::jsonb`);
  }
  if (input.cinematographer) {
    params.push(`%${input.cinematographer}%`);
    const idx = params.length;
    clauses.push(`(cinematographer ILIKE $${idx} OR claude_tags ->> 'suggestedCinematographerStyle' ILIKE $${idx})`);
  }
  if (input.timeOfDay) {
    params.push(JSON.stringify({ timeOfDay: input.timeOfDay }));
    clauses.push(`claude_tags @> $${params.length}::jsonb`);
  }
  if (input.query) {
    params.push(`%${input.query}%`);
    const idx = params.length;
    // A cheap keyword search — matches film title, notes, or user tags.
    // For a larger corpus we'd swap in pg_trgm + trigram GIN.
    params.push(input.query.toLowerCase());
    const tagIdx = params.length;
    clauses.push(
      `(film_title ILIKE $${idx} OR notes ILIKE $${idx} OR $${tagIdx} = ANY(user_tags))`,
    );
  }

  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  params.push(limit);
  params.push(offset);

  const sql = `
    SELECT *
    FROM role_room_reference_frames
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;
  const { rows } = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function updateReferenceFrame(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: Partial<{
    filmTitle: string | null;
    cinematographer: string | null;
    year: number | null;
    notes: string | null;
    userTags: string[];
    usedOnProjectIds: string[];
    sourceUrl: string;
    thumbnailUrl: string | null;
  }>,
): Promise<ReferenceFrame | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.filmTitle !== undefined) push('film_title', patch.filmTitle);
  if (patch.cinematographer !== undefined) push('cinematographer', patch.cinematographer);
  if (patch.year !== undefined) push('year', patch.year);
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.userTags !== undefined) push('user_tags', patch.userTags);
  if (patch.usedOnProjectIds !== undefined) push('used_on_project_ids', patch.usedOnProjectIds);
  if (patch.sourceUrl !== undefined) push('source_url', patch.sourceUrl);
  if (patch.thumbnailUrl !== undefined) push('thumbnail_url', patch.thumbnailUrl);
  if (sets.length === 0) return null;
  sets.push(`updated_at = now()`);
  params.push(ownerUserId);
  params.push(id);
  const { rows } = await pool.query(
    `UPDATE role_room_reference_frames
     SET ${sets.join(', ')}
     WHERE owner_user_id = $${params.length - 1} AND id = $${params.length}
     RETURNING *`,
    params,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteReferenceFrame(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM role_room_reference_frames WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}
