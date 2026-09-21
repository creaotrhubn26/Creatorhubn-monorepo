import type { Pool } from 'pg';

type QueryablePool = Pick<Pool, 'query'>;

export interface CreateCaptureRevisionInput {
  projectId: string;
  ownerUserId: string;
  assetId: string | null;
  originalFilename: string;
  clientEmail: string | null;
  note: string;
  source: string;
}

/**
 * Insert only when the authenticated photographer owns the project. When an
 * asset is supplied, it must also belong to a Capture session linked to that
 * same project and owner. This keeps a known asset UUID from becoming an IDOR.
 */
export async function createCaptureRevision(
  pool: QueryablePool,
  input: CreateCaptureRevisionInput,
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO capture_revision_requests
       (project_id, asset_id, original_filename, client_email, note, source)
     SELECT $1, $3::uuid, $4, $5, $6, $7
      WHERE EXISTS (
        SELECT 1 FROM projects p
         WHERE p.id = $1 AND p.user_id = $2
      )
        AND (
          $3::uuid IS NULL OR EXISTS (
            SELECT 1
              FROM capture_assets a
              JOIN capture_sessions s ON s.id = a.session_id
             WHERE a.id = $3::uuid
               AND s.project_id = $1
               AND s.owner_user_id = $2
          )
        )
     RETURNING id`,
    [
      input.projectId,
      input.ownerUserId,
      input.assetId,
      input.originalFilename,
      input.clientEmail,
      input.note,
      input.source,
    ],
  );
  return result.rows[0]?.id ?? null;
}

export async function listCaptureRevisions(
  pool: QueryablePool,
  ownerUserId: string,
  projectId: string,
  status: string,
): Promise<Record<string, unknown>[] | null> {
  const project = await pool.query<{ owned: boolean }>(
    `SELECT TRUE AS owned FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [projectId, ownerUserId],
  );
  if (project.rows.length === 0) return null;

  const result = await pool.query<Record<string, unknown>>(
    `SELECT id, project_id AS "projectId", asset_id AS "assetId",
            original_filename AS "originalFilename", client_email AS "clientEmail",
            note, status, source, created_at AS "createdAt", resolved_at AS "resolvedAt"
       FROM capture_revision_requests
      WHERE project_id = $1 AND ($2 = 'all' OR status = $2)
      ORDER BY created_at DESC`,
    [projectId, status],
  );
  return result.rows;
}

export async function updateCaptureRevisionStatus(
  pool: QueryablePool,
  ownerUserId: string,
  revisionId: string,
  status: 'open' | 'in_progress' | 'resolved',
): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `UPDATE capture_revision_requests revision
        SET status = $2,
            resolved_at = CASE
              WHEN $2 = 'resolved' THEN now()
              WHEN $2 IN ('open', 'in_progress') THEN NULL
              ELSE revision.resolved_at
            END
       FROM projects project
      WHERE revision.id = $1::uuid
        AND project.id = revision.project_id
        AND project.user_id = $3
      RETURNING revision.id`,
    [revisionId, status, ownerUserId],
  );
  return result.rows.length > 0;
}
