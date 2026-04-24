/**
 * Reference archive — semantic embeddings layer (v2).
 *
 * Drives the /suggest endpoint and adds embedding generation to the
 * upload path. Pairs with migration 0058 (pgvector + embedding column).
 *
 * Embedding strategy: we embed a TEXT representation of the frame, not
 * the image itself. That text is built from the film / cinematographer
 * metadata plus Claude Vision's structured tags (shot type, mood,
 * palette, composition, keywords). For search, we embed the scene
 * description and do cosine similarity. This sidesteps CLIP hosting
 * while getting most of the UX win, because Claude's text tags are
 * already high-signal.
 *
 * Model: text-embedding-3-small — 1536 dims, $0.02 / 1M tokens. Swap
 * to -3-large (3072 dims) if precision stops being enough.
 */

import type { Pool } from 'pg';
import type { ReferenceFrame, ReferenceFrameClaudeTags } from './reference-archive-service.js';

const EMBEDDING_MODEL = process.env.REFERENCE_ARCHIVE_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;

export interface EmbeddingResult {
  embedding: number[];
  usage: { inputTokens: number };
  model: string;
}

export type EmbeddingError =
  | { error: 'not_configured' }
  | { error: 'openai_error'; status: number; detail: string }
  | { error: 'invalid_response'; detail: string };

/**
 * Call OpenAI's /v1/embeddings. Uses fetch to avoid pulling in the
 * `openai` SDK for one endpoint; the repo already uses raw fetch to
 * OpenAI in role-room-agent.ts for the same reason.
 */
export async function embedText(text: string): Promise<EmbeddingResult | EmbeddingError> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: 'not_configured' };

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 8000) }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return { error: 'openai_error', status: response.status, detail };
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: Array<{ embedding?: unknown }>;
    usage?: { prompt_tokens?: number };
  };
  const raw = body.data?.[0]?.embedding;
  if (!Array.isArray(raw) || raw.length !== EMBEDDING_DIMS) {
    return { error: 'invalid_response', detail: `expected ${EMBEDDING_DIMS}-dim vector` };
  }
  const vector = raw.map(Number);
  if (vector.some((n) => !Number.isFinite(n))) {
    return { error: 'invalid_response', detail: 'non-finite values in vector' };
  }
  return {
    embedding: vector,
    usage: { inputTokens: body.usage?.prompt_tokens ?? 0 },
    model: EMBEDDING_MODEL,
  };
}

function hasError(result: EmbeddingResult | EmbeddingError): result is EmbeddingError {
  return (result as EmbeddingError).error !== undefined;
}

/**
 * Text representation of a reference frame — the string we embed.
 * Keep it in this module so the same canonicalisation is used at
 * upload-time and whenever a frame's metadata is edited (the PATCH
 * path should re-embed via `refreshFrameEmbedding`).
 */
export function buildFrameText(frame: {
  filmTitle: string | null;
  cinematographer: string | null;
  year: number | null;
  notes: string | null;
  claudeTags: ReferenceFrameClaudeTags;
  userTags: string[];
}): string {
  const t = frame.claudeTags;
  const parts = [
    frame.filmTitle ? `Film: ${frame.filmTitle}` : '',
    frame.year ? `Year: ${frame.year}` : '',
    frame.cinematographer ? `Cinematographer: ${frame.cinematographer}` : '',
    t.shotType && t.shotType !== 'unknown' ? `Shot: ${t.shotType}` : '',
    t.cameraAngle ? `Angle: ${t.cameraAngle}` : '',
    t.lensRange ? `Lens: ${t.lensRange}` : '',
    t.lightingMood ? `Light: ${t.lightingMood}` : '',
    t.timeOfDay ? `Time: ${t.timeOfDay}` : '',
    t.composition ? `Composition: ${t.composition}` : '',
    t.suggestedCinematographerStyle ? `Style: ${t.suggestedCinematographerStyle}` : '',
    t.colorPalette.length ? `Palette: ${t.colorPalette.join(', ')}` : '',
    t.keywords.length ? `Keywords: ${t.keywords.join(', ')}` : '',
    frame.userTags.length ? `Tags: ${frame.userTags.join(', ')}` : '',
    frame.notes ? `Notes: ${frame.notes}` : '',
  ];
  return parts.filter(Boolean).join('\n');
}

export function buildSceneQueryText(scene: {
  sceneNumber?: string | number;
  heading?: string;
  locationName?: string;
  intExt?: string;
  timeOfDay?: string;
  description?: string;
  characters?: string[];
  mood?: string;
  beats?: string[];
}): string {
  const parts = [
    scene.heading ? `Scene: ${scene.heading}` : '',
    scene.intExt && scene.timeOfDay ? `${scene.intExt} — ${scene.timeOfDay}` : '',
    scene.locationName ? `Location: ${scene.locationName}` : '',
    scene.mood ? `Mood: ${scene.mood}` : '',
    scene.characters?.length ? `Characters: ${scene.characters.join(', ')}` : '',
    scene.beats?.length ? `Beats: ${scene.beats.join(' · ')}` : '',
    scene.description ?? '',
  ];
  return parts.filter(Boolean).join('\n');
}

// pgvector wire format: `[1,2,3]` as a string literal — drizzle/pg passes it through as text.
export function vectorToPg(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export async function setFrameEmbedding(
  pool: Pool,
  frameId: string,
  vector: number[],
): Promise<void> {
  await pool.query(
    `UPDATE role_room_reference_frames SET embedding = $1::vector, updated_at = now() WHERE id = $2`,
    [vectorToPg(vector), frameId],
  );
}

export interface SuggestResult {
  frame: ReferenceFrame;
  similarity: number;
}

/**
 * Cosine-similarity search against the owner's archive. `<=>` in pgvector
 * returns cosine DISTANCE (0 = identical, 2 = opposite), so we convert to
 * similarity with `1 - distance`. Results only include frames that have
 * an embedding (null-embeddings are filtered out so old rows don't crash
 * the call).
 */
export async function searchByEmbedding(
  pool: Pool,
  input: { ownerUserId: string; embedding: number[]; limit?: number },
): Promise<SuggestResult[]> {
  const limit = Math.max(1, Math.min(50, input.limit ?? 10));
  const { rows } = await pool.query(
    `SELECT
       id, owner_user_id, uploaded_by_user_id, source_url, thumbnail_url,
       film_title, cinematographer, year, notes, claude_tags, user_tags,
       used_on_project_ids, created_at, updated_at,
       1 - (embedding <=> $1::vector) AS similarity
     FROM role_room_reference_frames
     WHERE owner_user_id = $2 AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorToPg(input.embedding), input.ownerUserId, limit],
  );

  // Lazy import to avoid a circular type-load — the service's mapRow isn't
  // exported, so we mirror it inline with the same field conversions.
  const { sanitiseTags } = await import('./reference-archive-service.js');
  return rows.map((row): SuggestResult => ({
    similarity: Number(row.similarity) || 0,
    frame: {
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
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    },
  }));
}

export const __test__ = { hasError, EMBEDDING_DIMS };
