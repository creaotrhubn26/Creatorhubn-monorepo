/**
 * dit-backup-routes.ts
 *
 * Endpoints for DIT-backup-tracking (migrasjon 144). To distinkte
 * auth-soner:
 *
 *   1. Admin (krever requireAdminSession):
 *      - Konfigurer destinations
 *      - Generér helper-tokens
 *      - Se aggregat-status per prosjekt
 *
 *   2. Helper-CLI (krever Bearer helper-token i Authorization):
 *      - Opprett backup-jobs
 *      - Oppdater status (copy progress + verify result)
 *      - Append events
 *
 * Token-auth: helper-CLI sender `Authorization: Bearer <token>`.
 * Vi SHA-256-hasher tokenet og sammenligner med token_hash i DB.
 * Tokenet sjekkes mot revoked_at + expires_at. last_used_at
 * oppdateres ved hver call (best-effort fire-and-forget).
 *
 * Wires inn i `backend/server/index.ts` etter eksisterende
 * `setupCommunityPresenceRoutes`.
 */

import type express from 'express';
import type { Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { signAssetReadUrl } from './capture-upload-service.js';

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface DitBackupRoutesDeps {
  app: express.Express;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

interface DitDestinationRow {
  id: string;
  project_id: string;
  destination_type: string;
  label: string;
  path: string | null;
  storage_type: string;
  priority: number;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DitJobRow {
  id: string;
  project_id: string;
  destination_id: string;
  take_id: string | null;
  source_path: string;
  source_size_bytes: string | null; // bigint kommer som string
  source_hash: string | null;
  dest_path: string | null;
  dest_size_bytes: string | null;
  dest_hash: string | null;
  hash_algorithm: string;
  status: string;
  bytes_copied: string | null;
  queued_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error_code: string | null;
  error_message: string | null;
  helper_token_id: string | null;
  helper_hostname: string | null;
  helper_version: string | null;
  camera_id: string | null;
  reel_id: string | null;
  clip_id: string | null;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isoOrNull(d: Date | null): string | undefined {
  return d ? d.toISOString() : undefined;
}

function serializeDestination(row: DitDestinationRow): Record<string, unknown> {
  return {
    id: row.id,
    project_id: row.project_id,
    destination_type: row.destination_type,
    label: row.label,
    path: row.path ?? undefined,
    storage_type: row.storage_type,
    priority: row.priority,
    status: row.status,
    notes: row.notes ?? undefined,
    created_at: isoOrNull(row.created_at),
    updated_at: isoOrNull(row.updated_at),
  };
}

function serializeJob(row: DitJobRow): Record<string, unknown> {
  return {
    id: row.id,
    project_id: row.project_id,
    destination_id: row.destination_id,
    take_id: row.take_id ?? undefined,
    source_path: row.source_path,
    source_size_bytes: row.source_size_bytes ? Number(row.source_size_bytes) : undefined,
    source_hash: row.source_hash ?? undefined,
    dest_path: row.dest_path ?? undefined,
    dest_size_bytes: row.dest_size_bytes ? Number(row.dest_size_bytes) : undefined,
    dest_hash: row.dest_hash ?? undefined,
    hash_algorithm: row.hash_algorithm,
    status: row.status,
    bytes_copied: row.bytes_copied ? Number(row.bytes_copied) : 0,
    queued_at: isoOrNull(row.queued_at),
    started_at: isoOrNull(row.started_at),
    completed_at: isoOrNull(row.completed_at),
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    helper_hostname: row.helper_hostname ?? undefined,
    helper_version: row.helper_version ?? undefined,
    camera_id: row.camera_id ?? undefined,
    reel_id: row.reel_id ?? undefined,
    clip_id: row.clip_id ?? undefined,
  };
}

/**
 * Verifiser Bearer-token mot dit_helper_tokens. Returnerer
 * { project_id, token_id } ved suksess, ellers null.
 */
async function verifyHelperToken(
  pool: Pool,
  req: express.Request,
): Promise<{ project_id: string; token_id: string } | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token || token.length > 200) return null;
  const tokenHash = hashToken(token);

  try {
    const result = await pool.query<{ id: string; project_id: string }>(
      `SELECT id, project_id FROM dit_helper_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > now()`,
      [tokenHash],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    // Fire-and-forget: oppdater last_used_at uten å vente
    pool.query('UPDATE dit_helper_tokens SET last_used_at = now() WHERE id = $1', [row.id]).catch(() => {});

    return { project_id: row.project_id, token_id: row.id };
  } catch {
    return null;
  }
}

export function setupDitBackupRoutes(deps: DitBackupRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ═══════════════════════════════════════════════════════════
  // DESTINATIONS — admin-konfigurert
  // ═══════════════════════════════════════════════════════════

  app.get('/api/dit/projects/:projectId/destinations', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId påkrevd' });
    try {
      const result = await pool.query<DitDestinationRow>(
        'SELECT * FROM dit_destinations WHERE project_id = $1 ORDER BY priority ASC, label ASC',
        [projectId],
      );
      return res.json({ success: true, destinations: result.rows.map(serializeDestination) });
    } catch (error) {
      console.error('[dit] list destinations failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste destinations', destinations: [] });
    }
  });

  app.post('/api/dit/destinations', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectId = String(body.project_id ?? '').trim();
    const destinationType = String(body.destination_type ?? '').trim();
    const label = String(body.label ?? '').trim();
    if (!projectId || !destinationType || !label) {
      return res.status(400).json({ success: false, error: 'project_id, destination_type, label påkrevd' });
    }
    const validTypes = ['original', 'primary', 'secondary', 'offsite', 'archive'];
    if (!validTypes.includes(destinationType)) {
      return res.status(400).json({ success: false, error: `destination_type må være en av ${validTypes.join(', ')}` });
    }
    const id = `did_${randomUUID()}`;
    try {
      const result = await pool.query<DitDestinationRow>(
        `INSERT INTO dit_destinations (id, project_id, destination_type, label, path, storage_type, priority, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          id, projectId, destinationType, label.slice(0, 200),
          body.path ?? null,
          body.storage_type ?? 'raid',
          Number.isFinite(body.priority) ? body.priority : 1,
          body.status ?? 'configured',
          body.notes ?? null,
        ],
      );
      return res.json({ success: true, destination: serializeDestination(result.rows[0]) });
    } catch (error) {
      console.error('[dit] create destination failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke opprette destination' });
    }
  });

  app.delete('/api/dit/destinations/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || '').trim();
    try {
      const result = await pool.query('DELETE FROM dit_destinations WHERE id = $1 RETURNING id', [id]);
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Destination ikke funnet' });
      return res.json({ success: true });
    } catch (error) {
      console.error('[dit] delete destination failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke slette' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // HELPER TOKENS — admin genererer, CLI bruker
  // ═══════════════════════════════════════════════════════════

  app.post('/api/dit/projects/:projectId/helper-tokens', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const label = String(body.label ?? 'DIT Helper').trim();
    const stationName = body.station_name ? String(body.station_name).trim() : null;
    const expiresInDays = Number.isFinite(body.expires_in_days) ? Number(body.expires_in_days) : 90;

    const tokenId = `dht_${randomUUID()}`;
    // Tokenformat: trr_dit_<random-32-bytes-hex> — prefiks gir typeidentifikasjon
    const rawToken = `trr_dit_${randomBytes(32).toString('hex')}`;
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    try {
      await pool.query(
        `INSERT INTO dit_helper_tokens (id, project_id, token_hash, label, station_name, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tokenId, projectId, tokenHash, label.slice(0, 100), stationName, expiresAt, session.email],
      );
      // Returner KLAR-TEKST kun NÅ — admin må kopiere umiddelbart.
      // Vi har bare hash-en lagret videre, så det vises ALDRI igjen.
      return res.json({
        success: true,
        token: rawToken,
        token_id: tokenId,
        expires_at: expiresAt.toISOString(),
        warning: 'Tokenet vises kun NÅ. Kopiér til DIT-station-config. Det kan ikke gjenfinnes.',
      });
    } catch (error) {
      console.error('[dit] create helper-token failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke opprette token' });
    }
  });

  app.get('/api/dit/projects/:projectId/helper-tokens', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || '').trim();
    try {
      const result = await pool.query(
        `SELECT id, label, station_name, last_used_at, expires_at, created_at, revoked_at
         FROM dit_helper_tokens
         WHERE project_id = $1
         ORDER BY created_at DESC`,
        [projectId],
      );
      return res.json({
        success: true,
        tokens: result.rows.map((r) => ({
          id: r.id,
          label: r.label,
          station_name: r.station_name,
          last_used_at: isoOrNull(r.last_used_at),
          expires_at: isoOrNull(r.expires_at),
          created_at: isoOrNull(r.created_at),
          revoked_at: isoOrNull(r.revoked_at),
        })),
      });
    } catch (error) {
      console.error('[dit] list tokens failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste tokens', tokens: [] });
    }
  });

  app.delete('/api/dit/helper-tokens/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || '').trim();
    try {
      const result = await pool.query(
        'UPDATE dit_helper_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id',
        [id],
      );
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Token ikke funnet eller allerede tilbakekalt' });
      return res.json({ success: true });
    } catch (error) {
      console.error('[dit] revoke token failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke tilbakekalle' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // BACKUP JOBS — CLI-helper-auth (Bearer)
  // ═══════════════════════════════════════════════════════════

  app.post('/api/dit/jobs', async (req, res) => {
    const auth = await verifyHelperToken(pool, req);
    if (!auth) return res.status(401).json({ success: false, error: 'Ugyldig helper-token' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const destinationId = String(body.destination_id ?? '').trim();
    const sourcePath = String(body.source_path ?? '').trim();
    if (!destinationId || !sourcePath) {
      return res.status(400).json({ success: false, error: 'destination_id, source_path påkrevd' });
    }

    // Validér at destinasjonen tilhører samme prosjekt som tokenet
    const dest = await pool.query<{ project_id: string }>(
      'SELECT project_id FROM dit_destinations WHERE id = $1',
      [destinationId],
    );
    if (dest.rows.length === 0) return res.status(404).json({ success: false, error: 'Destination ikke funnet' });
    if (dest.rows[0].project_id !== auth.project_id) {
      return res.status(403).json({ success: false, error: 'Token ikke autorisert for denne destinasjonen' });
    }

    const id = `djb_${randomUUID()}`;
    try {
      const result = await pool.query<DitJobRow>(
        `INSERT INTO dit_backup_jobs (
           id, project_id, destination_id, take_id, source_path, source_size_bytes,
           source_hash, hash_algorithm, status, helper_token_id, helper_hostname,
           helper_version, camera_id, reel_id, clip_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          id, auth.project_id, destinationId,
          body.take_id ?? null,
          sourcePath.slice(0, 2000),
          body.source_size_bytes ?? null,
          body.source_hash ?? null,
          body.hash_algorithm ?? 'xxh64',
          body.status ?? 'queued',
          auth.token_id,
          body.helper_hostname ?? null,
          body.helper_version ?? null,
          body.camera_id ?? null,
          body.reel_id ?? null,
          body.clip_id ?? null,
        ],
      );
      // Append-event for audit
      await pool.query(
        `INSERT INTO dit_backup_events (job_id, event_type, payload)
         VALUES ($1, 'queued', $2::jsonb)`,
        [id, JSON.stringify({ source_path: sourcePath, hostname: body.helper_hostname })],
      );
      return res.json({ success: true, job: serializeJob(result.rows[0]) });
    } catch (error) {
      console.error('[dit] create job failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke opprette job' });
    }
  });

  app.patch('/api/dit/jobs/:id', async (req, res) => {
    const auth = await verifyHelperToken(pool, req);
    if (!auth) return res.status(401).json({ success: false, error: 'Ugyldig helper-token' });

    const id = String(req.params.id || '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const allowed = [
      'status', 'bytes_copied', 'dest_path', 'dest_size_bytes', 'dest_hash',
      'started_at', 'completed_at', 'error_code', 'error_message',
    ] as const;

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (f in body) {
        sets.push(`${f} = $${idx}`);
        params.push(body[f] ?? null);
        idx += 1;
      }
    }
    if (sets.length === 0) return res.status(400).json({ success: false, error: 'Ingen felt' });
    params.push(id);
    params.push(auth.project_id);
    try {
      const result = await pool.query<DitJobRow>(
        `UPDATE dit_backup_jobs SET ${sets.join(', ')}
         WHERE id = $${idx} AND project_id = $${idx + 1} RETURNING *`,
        params,
      );
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Job ikke funnet' });
      // Event-log
      if (body.status) {
        await pool.query(
          `INSERT INTO dit_backup_events (job_id, event_type, payload)
           VALUES ($1, $2, $3::jsonb)`,
          [id, String(body.status), JSON.stringify({ bytes_copied: body.bytes_copied, error: body.error_message })],
        ).catch(() => {});
      }
      return res.json({ success: true, job: serializeJob(result.rows[0]) });
    } catch (error) {
      console.error('[dit] update job failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke oppdatere' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // STATUS-VIEWS — for LiveSetMode-UI (admin-auth)
  // ═══════════════════════════════════════════════════════════

  app.get('/api/dit/projects/:projectId/jobs', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || '').trim();
    const limit = Number.isFinite(req.query.limit) ? Number(req.query.limit) : 200;
    try {
      const result = await pool.query<DitJobRow>(
        `SELECT j.* FROM dit_backup_jobs j
         WHERE j.project_id = $1
         ORDER BY j.queued_at DESC
         LIMIT $2`,
        [projectId, Math.min(limit, 500)],
      );
      return res.json({ success: true, jobs: result.rows.map(serializeJob) });
    } catch (error) {
      console.error('[dit] list jobs failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste jobs', jobs: [] });
    }
  });

  // Per-take aggregert backup-status — brukes av LiveSetMode TakeRow
  app.get('/api/dit/projects/:projectId/take-status', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || '').trim();
    try {
      const result = await pool.query<{ take_id: string; destinations: unknown }>(
        'SELECT take_id, destinations FROM dit_take_backup_status WHERE project_id = $1',
        [projectId],
      );
      return res.json({ success: true, take_status: result.rows });
    } catch (error) {
      console.error('[dit] take-status failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste status', take_status: [] });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // PROJECT INFO — helper-token-gated (Creatorhub One Desk)
  // Returnerer prosjekt-navn + memory-card-configs fra wizard +
  // destinasjoner i én call. Read-only.
  // ═══════════════════════════════════════════════════════════

  // Returnerer signed download-URL for et capture-asset (Creatorhub One Desk
  // F6b mirror). Helper-token-gated; verifiserer at asset's session.project_id
  // matcher token.project_id. Foretrekker fullKey, faller tilbake til
  // previewKey hvis full ikke finnes.
  app.get('/api/dit/assets/:assetId/download-url', async (req, res) => {
    const auth = await verifyHelperToken(pool, req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Ugyldig eller utløpt helper-token' });
    }
    const assetId = String(req.params.assetId || '').trim();
    if (!assetId) {
      return res.status(400).json({ success: false, error: 'assetId påkrevd' });
    }
    try {
      const row = await pool.query<{
        id: string;
        original_filename: string;
        preview_key: string | null;
        full_key: string | null;
        size_bytes: string | null;
        mime: string;
        project_id: string | null;
      }>(
        `SELECT a.id, a.original_filename, a.preview_key, a.full_key,
                a.size_bytes, a.mime, s.project_id
         FROM capture_assets a
         JOIN capture_sessions s ON s.id = a.session_id
         WHERE a.id = $1
         LIMIT 1`,
        [assetId],
      );
      if (row.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Asset ikke funnet' });
      }
      const asset = row.rows[0];
      if (asset.project_id !== auth.project_id) {
        return res.status(403).json({ success: false, error: 'Token gjelder annet prosjekt' });
      }
      const key = asset.full_key ?? asset.preview_key;
      if (!key) {
        return res.status(409).json({
          success: false,
          error: 'Asset har verken full_key eller preview_key (kanskje ikke uploaded ennå)',
        });
      }
      const url = await signAssetReadUrl(key);
      if (!url) {
        return res.status(500).json({ success: false, error: 'Kunne ikke signere download-URL' });
      }
      return res.json({
        success: true,
        url,
        filename: asset.original_filename,
        size_bytes: asset.size_bytes ? Number(asset.size_bytes) : null,
        mime: asset.mime,
        is_full: asset.full_key !== null,
      });
    } catch (error) {
      console.error('[dit] asset download-url failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke hente download-URL' });
    }
  });

  // Lister capture-sessions (iPad CaptureApp) for dette prosjektet. Brukes
  // av Creatorhub One Desk for å vise hvilke sessions Desk kan mirror.
  // Helper-token-gated; samme project_id-isolasjon som /info.
  app.get('/api/dit/projects/:projectId/capture-sessions', async (req, res) => {
    const auth = await verifyHelperToken(pool, req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Ugyldig eller utløpt helper-token' });
    }
    const projectId = String(req.params.projectId || '').trim();
    if (auth.project_id !== projectId) {
      return res.status(403).json({ success: false, error: 'Token gjelder annet prosjekt' });
    }
    try {
      const result = await pool.query<{
        id: string;
        name: string;
        starts_at: Date;
        ends_at: Date | null;
        status: string;
        owner_user_id: string;
      }>(
        `SELECT id, name, starts_at, ends_at, status, owner_user_id
         FROM capture_sessions
         WHERE project_id = $1
         ORDER BY starts_at DESC
         LIMIT 50`,
        [projectId],
      );
      return res.json({
        success: true,
        sessions: result.rows.map((r) => ({
          id: r.id,
          name: r.name ?? '',
          starts_at: r.starts_at ? r.starts_at.toISOString() : null,
          ends_at: r.ends_at ? r.ends_at.toISOString() : null,
          status: r.status,
          owner_user_id: r.owner_user_id,
          is_active: r.ends_at === null && r.status === 'active',
        })),
      });
    } catch (error) {
      console.error('[dit] capture-sessions list failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste capture-sessions', sessions: [] });
    }
  });

  app.get('/api/dit/projects/:projectId/info', async (req, res) => {
    const auth = await verifyHelperToken(pool, req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Ugyldig eller utløpt helper-token' });
    }
    const projectId = String(req.params.projectId || '').trim();
    if (auth.project_id !== projectId) {
      return res.status(403).json({ success: false, error: 'Token gjelder annet prosjekt' });
    }
    try {
      const [projectRes, destRes] = await Promise.all([
        pool.query<{ id: string; name: string | null; title: string | null; metadata: Record<string, unknown> | null }>(
          'SELECT id, name, title, metadata FROM legacy.projects WHERE id = $1 LIMIT 1',
          [projectId],
        ),
        pool.query<DitDestinationRow>(
          'SELECT * FROM dit_destinations WHERE project_id = $1 ORDER BY priority ASC, label ASC',
          [projectId],
        ),
      ]);
      if (projectRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Prosjekt ikke funnet' });
      }
      const project = projectRes.rows[0];
      const metadata = (project.metadata ?? {}) as Record<string, unknown>;
      return res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name || project.title || '',
        },
        memory_card_configs: Array.isArray(metadata.memoryCardConfigs) ? metadata.memoryCardConfigs : [],
        selected_memory_cards: Array.isArray(metadata.selectedMemoryCards) ? metadata.selectedMemoryCards : [],
        destinations: destRes.rows.map(serializeDestination),
      });
    } catch (error) {
      console.error('[dit] project info failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste prosjekt-info' });
    }
  });
}
