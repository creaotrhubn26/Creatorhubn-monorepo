/**
 * role-room-storage-integrations.ts
 *
 * L4 — Helpers som lar andre Role Room-moduler enkelt laste filer til
 * per-bruker B2 med riktig kontekst-kobling.
 *
 * To hovedfunksjoner:
 *   1. attachDataUrlToB2 — for moduler som idag har en base64 data-URL
 *      i DB (storyboards, signaturer, deck-thumbnails) som vi vil flytte
 *      til B2.
 *   2. moveStoryboardImageToB2 — atomisk migrate av én storyboard-rad:
 *      les image_data, last opp til B2 med kontekst (project/scene/
 *      storyboard-id), oppdater casting_storyboards.b2_file_id, NULL ut
 *      image_data.
 */

import type { Pool } from "pg";
import { uploadUserFile, type UploadContext, type UserFile } from "./role-room-user-storage-service.js";

/**
 * Tar en data-URL (typisk "data:image/png;base64,iVBORw0KG...") og
 * laster den opp til brukerens B2-prefix med riktig kontekst.
 * Returnerer den nye file-row hvis ok.
 */
export async function attachDataUrlToB2(
  pool: Pool,
  opts: {
    userId: string;
    dataUrl: string;
    displayName: string;
    sourceModule: string;
    context: UploadContext;
  },
): Promise<
  | { ok: true; file: UserFile }
  | { ok: false; reason: string }
> {
  const m = opts.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { ok: false, reason: "invalid_data_url" };
  const contentType = m[1];
  const base64 = m[2];
  let buf: Buffer;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, reason: "invalid_base64" };
  }
  if (buf.length === 0) return { ok: false, reason: "empty_data" };

  const result = await uploadUserFile(pool, {
    userId: opts.userId,
    displayName: opts.displayName,
    body: buf,
    contentType,
    sourceModule: opts.sourceModule,
    context: opts.context,
  });
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, file: result.file };
}

/**
 * Flytt en storyboard-skisse fra PG-blob (image_data) til B2.
 * Idempotent — hvis storyboard allerede har b2_file_id, returnerer
 * { ok: true, alreadyMoved: true } uten å gjøre noe.
 */
export async function moveStoryboardImageToB2(
  pool: Pool,
  opts: { userId: string; storyboardId: string },
): Promise<
  | { ok: true; alreadyMoved: boolean; fileId?: string; freedBytes?: number }
  | { ok: false; reason: string }
> {
  const r = await pool.query<{
    id: string;
    project_id: string;
    scene_id: string | null;
    title: string | null;
    image_data: string | null;
    b2_file_id: string | null;
  }>(
    `SELECT id, project_id, scene_id, title, image_data, b2_file_id
     FROM casting_storyboards
     WHERE id = $1::uuid`,
    [opts.storyboardId],
  );
  const row = r.rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.b2_file_id) return { ok: true, alreadyMoved: true };
  if (!row.image_data) return { ok: false, reason: "no_image_data" };

  const upload = await attachDataUrlToB2(pool, {
    userId: opts.userId,
    dataUrl: row.image_data,
    displayName: `${row.title?.replace(/[^\w-]+/g, '-') || 'storyboard'}-${row.id.slice(0, 8)}.png`,
    sourceModule: 'storyboard',
    context: {
      projectId: row.project_id,
      sceneId: row.scene_id ?? undefined,
      attachedToEntityType: 'storyboard',
      attachedToEntityId: row.id,
      attachmentNote: row.title ?? undefined,
    },
  });

  if (!upload.ok) return { ok: false, reason: upload.reason };

  const freedBytes = row.image_data.length; // base64-størrelse — gir omtrentlig PG-besparelse
  await pool.query(
    `UPDATE casting_storyboards
       SET b2_file_id = $1::uuid, image_data = NULL, updated_at = NOW()
     WHERE id = $2::uuid`,
    [upload.file.id, row.id],
  );

  return { ok: true, alreadyMoved: false, fileId: upload.file.id, freedBytes };
}

/**
 * Batch — flytt alle storyboard-bilder for en bruker som ennå ikke er
 * migrert. Returnerer sammendrag. Brukes fra admin-room eller en cron.
 */
export async function migrateAllStoryboardImagesForUser(
  pool: Pool,
  userId: string,
  opts?: { limit?: number },
): Promise<{
  attempted: number;
  succeeded: number;
  alreadyMoved: number;
  failed: number;
  errors: Array<{ storyboardId: string; reason: string }>;
}> {
  // Finn alle storyboards der brukeren er created_by og image_data finnes
  const r = await pool.query<{ id: string }>(
    `SELECT s.id FROM casting_storyboards s
     WHERE s.image_data IS NOT NULL
       AND s.b2_file_id IS NULL
       AND s.created_by = $1::text
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [userId, opts?.limit ?? 200],
  );
  const ids = r.rows.map((row) => row.id);
  const summary = {
    attempted: ids.length,
    succeeded: 0,
    alreadyMoved: 0,
    failed: 0,
    errors: [] as Array<{ storyboardId: string; reason: string }>,
  };
  for (const id of ids) {
    const result = await moveStoryboardImageToB2(pool, { userId, storyboardId: id });
    if (result.ok) {
      if (result.alreadyMoved) summary.alreadyMoved += 1;
      else summary.succeeded += 1;
    } else {
      summary.failed += 1;
      summary.errors.push({ storyboardId: id, reason: result.reason });
    }
  }
  return summary;
}
