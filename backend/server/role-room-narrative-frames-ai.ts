/**
 * Story Graph Fase 8f — KI-referansebilde på scenekortet.
 *
 * Bildet genereres av det eksisterende `POST /api/storyboards/generate-frame` (DALL·E, returnerer
 * base64 og persisterer ingenting). Persistering gjør vi her: PNG → objektlager
 * (narrative_assets.storage_key, samme vei som CI-bevis i 8c) → scene-ramme med bildetekst
 * «KI-referanse». Daglig tak per prosjekt fordi generate-frame ikke har kostnadskontroll.
 */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

import * as svc from './role-room-narrative-service.js';
import { putCreatorHubObject } from './creatorhub-object-storage.js';

export const AI_FRAME_DAILY_LIMIT = 10;
export const AI_FRAME_FOLDER = 'ki-referanse';
export const AI_FRAME_MAX_BYTES = 8 * 1024 * 1024;

export class AiFrameError extends Error {
  constructor(public readonly code: 'daily_limit' | 'invalid_image' | 'storage_unavailable' | 'scene_not_found', message: string) {
    super(message); this.name = 'AiFrameError';
  }
}

export async function countAiFramesToday(db: svc.Queryable, projectId: string): Promise<number> {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM narrative_assets WHERE project_id = $1 AND folder_path = $2 AND created_at > now() - interval '1 day'`,
    [projectId, AI_FRAME_FOLDER],
  );
  return Number((rows[0] as { n?: number } | undefined)?.n ?? 0) || 0;
}

/** Dekoder base64 (data-URL eller rå) og krever PNG/JPEG-magic. */
export function decodeImageBase64(input: string): { buffer: Buffer; mime: 'image/png' | 'image/jpeg'; ext: 'png' | 'jpg' } {
  const raw = input.replace(/^data:image\/(png|jpeg);base64,/, '');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(raw) || raw.length < 64) throw new AiFrameError('invalid_image', 'Ugyldig bildedata.');
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length === 0 || buffer.length > AI_FRAME_MAX_BYTES) throw new AiFrameError('invalid_image', 'Bildet er tomt eller for stort (maks 8 MB).');
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { buffer, mime: 'image/png', ext: 'png' };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { buffer, mime: 'image/jpeg', ext: 'jpg' };
  throw new AiFrameError('invalid_image', 'Bildet må være PNG eller JPEG.');
}

export interface AiFrameResult {
  assetId: string; storageKey: string; frame: svc.NarrativeSceneFrame; usedToday: number; dailyLimit: number;
}

export async function createAiReferenceFrame(
  pool: Pool, projectId: string, sceneId: string, userId: string,
  input: { imageBase64: string; caption?: string; prompt?: string; model?: string },
  opts: { put?: typeof putCreatorHubObject } = {},
): Promise<AiFrameResult> {
  const used = await countAiFramesToday(pool, projectId);
  if (used >= AI_FRAME_DAILY_LIMIT) throw new AiFrameError('daily_limit', `Daglig tak på ${AI_FRAME_DAILY_LIMIT} KI-referansebilder per prosjekt er nådd.`);
  const img = decodeImageBase64(input.imageBase64);
  const assetId = `nas_${randomUUID()}`;
  const storageKey = `narrative/${projectId}/frames/${sceneId}/${randomUUID()}.${img.ext}`;
  const put = opts.put ?? putCreatorHubObject;
  const stored = await put(storageKey, img.buffer, img.mime, { projectId, sceneId, kind: 'ai-reference-frame' });
  if (!stored) throw new AiFrameError('storage_unavailable', 'Objektlager er ikke konfigurert.');
  const name = `${(input.caption ?? 'KI-referanse').trim().slice(0, 120) || 'KI-referanse'}.${img.ext}`;
  await pool.query(
    `INSERT INTO narrative_assets (id, project_id, kind, name, storage_key, external_url, mime, size_bytes, folder_path, created_by)
       VALUES ($1, $2, 'image', $3, $4, NULL, $5, $6, $7, $8)`,
    [assetId, projectId, name, storageKey, img.mime, img.buffer.length, AI_FRAME_FOLDER, userId],
  );
  const caption = [(input.caption ?? 'KI-referanse').trim().slice(0, 120) || 'KI-referanse', input.model ? `(${input.model})` : ''].filter(Boolean).join(' ');
  const frame = await svc.createSceneFrame(pool, projectId, sceneId, userId, { assetId, caption });
  if (!frame) throw new AiFrameError('scene_not_found', 'Scenen finnes ikke.');
  return { assetId, storageKey, frame, usedToday: used + 1, dailyLimit: AI_FRAME_DAILY_LIMIT };
}
