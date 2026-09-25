import crypto from 'node:crypto';
import type express from 'express';
import { canAccessProject, canEditProject } from './project-team-routes';
import { getCreatorHubMediaAccess, getProjectOwnerMediaAccess } from './creatorhub-media-access';
import { signAssetReadUrl } from './capture-upload-service';
import { presignCreatorHubObjectDownload } from './creatorhub-object-storage';

type Session = { userId: string; email?: string; name?: string; role?: string };

export interface CreatorHubMediaPortabilityRoutesDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (req: any, res: any) => Session | null | Promise<Session | null>;
}

type LedgerItem = {
  stableId: string;
  mediaType: 'photo' | 'video' | 'audio';
  source: string;
  filename: string;
  sizeBytes: number;
  checksumSha256: string | null;
  storageState: string | null;
  createdAt: string | null;
  downloadPath: string;
};

const normalizeItem = (row: any, mediaType: LedgerItem['mediaType'], source: string, projectId: string): LedgerItem => ({
  stableId: String(row.id),
  mediaType,
  source,
  filename: String(row.filename || row.original_filename || row.version_label || 'media'),
  sizeBytes: Math.max(0, Number(row.size_bytes || 0)),
  checksumSha256: typeof row.checksum_sha256 === 'string' && row.checksum_sha256.length === 64
    ? row.checksum_sha256 : null,
  storageState: row.storage_state ? String(row.storage_state) : null,
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  downloadPath: `/api/projects/${encodeURIComponent(projectId)}/media-ledger/${mediaType}/${encodeURIComponent(String(row.id))}/download?source=${encodeURIComponent(source)}`,
});

async function buildProjectLedger(pool: any, projectId: string): Promise<LedgerItem[]> {
  const [photo, video, audio, lightroom] = await Promise.all([
    pool.query(
      `SELECT asset.id, asset.original_filename AS filename, asset.size_bytes,
              asset.checksum_sha256, asset.state AS storage_state, asset.created_at
         FROM capture_assets asset
         JOIN capture_sessions session ON session.id=asset.session_id
    LEFT JOIN lightroom_classic_exports lightroom ON lightroom.asset_id=asset.id
        WHERE session.project_id::text=$1 AND lightroom.id IS NULL`, [projectId],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, original_filename AS filename, size_bytes, checksum_sha256,
              capture_state AS storage_state, created_at
         FROM project_video_assets WHERE project_id::text=$1`, [projectId],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT version.id, COALESCE(version.file_name, version.version_label) AS filename,
              version.file_size AS size_bytes, version.checksum_sha256,
              version.storage_state, version.created_at
         FROM project_audio_rooms link
         JOIN audio_review_versions version ON version.project_id=link.audio_review_project_id
        WHERE link.project_id::text=$1`, [projectId],
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, filename, size_bytes, checksum_sha256, status AS storage_state, created_at
         FROM lightroom_classic_exports WHERE project_id::text=$1`, [projectId],
    ).catch(() => ({ rows: [] })),
  ]);
  return [
    ...photo.rows.map((row: any) => normalizeItem(row, 'photo', 'capture', projectId)),
    ...video.rows.map((row: any) => normalizeItem(row, 'video', 'creatorhub_one', projectId)),
    ...audio.rows.map((row: any) => normalizeItem(row, 'audio', 'sound_room', projectId)),
    ...lightroom.rows.map((row: any) => normalizeItem(row, 'photo', 'lightroom_classic', projectId)),
  ];
}

export function setupCreatorHubMediaPortabilityRoutes(deps: CreatorHubMediaPortabilityRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  app.get('/api/creatorhub/media-access', async (req, res) => {
    const session = await requireUserSession(req, res); if (!session) return;
    try {
      res.json(await getCreatorHubMediaAccess(pool, session.userId));
    } catch (error) {
      console.error('[creatorhub-media-access] status failed', error);
      res.status(503).json({ error: 'media_access_unavailable' });
    }
  });

  const authorizeProject = async (req: any, res: any, requireEdit = false) => {
    const session = await requireUserSession(req, res); if (!session) return null;
    const projectId = String(req.params.projectId || '');
    const allowed = requireEdit
      ? await canEditProject(pool, session.userId, projectId)
      : await canAccessProject(pool, session.userId, projectId);
    if (!allowed) {
      res.status(403).json({ error: requireEdit ? 'read_only_access' : 'no_access' }); return null;
    }
    return session;
  };

  app.get('/api/projects/:projectId/media-access', async (req, res) => {
    const session = await authorizeProject(req, res); if (!session) return;
    try {
      const access = await getProjectOwnerMediaAccess(pool, req.params.projectId);
      res.json({
        ...access,
        canExport: await canEditProject(pool, session.userId, req.params.projectId),
        canManageSubscription: access.ownerUserId === session.userId,
      });
    } catch (error) {
      console.error('[creatorhub-media-access] project status failed', error);
      res.status(503).json({ error: 'media_access_unavailable' });
    }
  });

  app.get('/api/projects/:projectId/media-ledger', async (req, res) => {
    const session = await authorizeProject(req, res); if (!session) return;
    try {
      const access = await getProjectOwnerMediaAccess(pool, req.params.projectId);
      const items = await buildProjectLedger(pool, req.params.projectId);
      const counts = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.mediaType] = (acc[item.mediaType] || 0) + 1; return acc;
      }, {});
      res.json({
        projectId: req.params.projectId,
        access,
        summary: {
          itemCount: items.length,
          totalBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
          verifiedChecksumCount: items.filter((item) => item.checksumSha256).length,
          counts,
        },
        items,
      });
    } catch (error) {
      console.error('[creatorhub-media-ledger] failed', error);
      res.status(500).json({ error: 'media_ledger_failed' });
    }
  });

  app.get('/api/projects/:projectId/media-ledger/:mediaType/:assetId/download', async (req, res) => {
    const session = await authorizeProject(req, res, true); if (!session) return;
    try {
      const access = await getProjectOwnerMediaAccess(pool, req.params.projectId);
      if (!access.canDownload) return res.status(403).json({
        error: 'download_window_expired', downloadOnlyUntil: access.downloadOnlyUntil, automaticDeletion: false,
      });
      const mediaType = String(req.params.mediaType || '');
      const assetId = String(req.params.assetId || '');
      const source = String(req.query.source || '');
      let row: any = null;
      let url: string | null = null;

      if (mediaType === 'photo' && source === 'lightroom_classic') {
        row = (await pool.query(
          `SELECT filename,object_key FROM lightroom_classic_exports
            WHERE id=$1::uuid AND project_id::text=$2 AND status='verified' LIMIT 1`,
          [assetId, req.params.projectId],
        )).rows[0];
        if (row) url = await presignCreatorHubObjectDownload(row.object_key, row.filename, 300);
      } else if (mediaType === 'photo') {
        row = (await pool.query(
          `SELECT asset.original_filename AS filename,
                  COALESCE(asset.raw_key,asset.full_key,asset.preview_key) AS object_key
             FROM capture_assets asset
             JOIN capture_sessions session ON session.id=asset.session_id
            WHERE asset.id=$1::uuid AND session.project_id::text=$2 LIMIT 1`,
          [assetId, req.params.projectId],
        )).rows[0];
        if (row) url = await signAssetReadUrl(row.object_key);
      } else if (mediaType === 'video') {
        row = (await pool.query(
          `SELECT asset.original_filename AS filename,stored.object_key
             FROM project_video_assets asset
             JOIN role_room_storage_objects stored ON stored.id=asset.storage_object_id
            WHERE asset.id=$1::uuid AND asset.project_id::text=$2
              AND stored.status='active' AND stored.deleted_at IS NULL LIMIT 1`,
          [assetId, req.params.projectId],
        )).rows[0];
        if (row) url = await presignCreatorHubObjectDownload(row.object_key, row.filename, 300);
      } else if (mediaType === 'audio') {
        row = (await pool.query(
          `SELECT COALESCE(version.file_name,version.version_label) AS filename,
                  stored.object_key,version.file_url
             FROM project_audio_rooms link
             JOIN audio_review_versions version ON version.project_id=link.audio_review_project_id
        LEFT JOIN role_room_storage_objects stored ON stored.id=version.storage_object_id
            WHERE version.id=$1::uuid AND link.project_id::text=$2 LIMIT 1`,
          [assetId, req.params.projectId],
        )).rows[0];
        if (row?.object_key) url = await presignCreatorHubObjectDownload(row.object_key, row.filename, 300);
        else if (/^https:\/\//i.test(String(row?.file_url || ''))) url = String(row.file_url);
      } else {
        return res.status(400).json({ error: 'unsupported_media_type' });
      }
      if (!row) return res.status(404).json({ error: 'media_not_found' });
      if (!url) return res.status(503).json({ error: 'download_unavailable' });
      if (req.query.format === 'json') return res.json({ url });
      return res.redirect(url);
    } catch (error) {
      console.error('[creatorhub-media-download] failed', error);
      return res.status(500).json({ error: 'media_download_failed' });
    }
  });

  app.post('/api/projects/:projectId/media-export/manifest', async (req, res) => {
    const session = await authorizeProject(req, res, true); if (!session) return;
    try {
      const project = await pool.query(`SELECT id, name, title, user_id FROM projects WHERE id::text=$1 LIMIT 1`, [req.params.projectId]);
      if (!project.rows[0]) return res.status(404).json({ error: 'project_not_found' });
      const access = await getProjectOwnerMediaAccess(pool, req.params.projectId);
      if (!access.canDownload) {
        return res.status(403).json({
          error: 'download_window_expired', downloadOnlyUntil: access.downloadOnlyUntil,
          message: '30-dagers nedlastingsvindu er utløpt. Mediene er beholdt og åpnes igjen når abonnementet reaktiveres.',
        });
      }
      const items = await buildProjectLedger(pool, req.params.projectId);
      const counts = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.mediaType] = (acc[item.mediaType] || 0) + 1; return acc;
      }, {});
      const generatedAt = new Date().toISOString();
      const manifest = {
        schema: 'creatorhub.media-portability.v1',
        project: { id: String(project.rows[0].id), name: project.rows[0].title || project.rows[0].name || 'CreatorHub project' },
        generatedAt,
        retention: { automaticDeletion: false, accessState: access.state, downloadOnlyUntil: access.downloadOnlyUntil },
        summary: {
          itemCount: items.length,
          totalBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
          verifiedChecksumCount: items.filter((item) => item.checksumSha256).length,
          counts,
        },
        items,
      };
      const body = JSON.stringify(manifest, null, 2);
      const manifestSha256 = crypto.createHash('sha256').update(body).digest('hex');
      const receipt = await pool.query(
        `INSERT INTO creatorhub_media_export_receipts
           (user_id,project_id,requested_by,manifest_sha256,item_count,total_bytes,
            verified_checksum_count,media_counts,access_state)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING id,created_at`,
        [project.rows[0].user_id, req.params.projectId, session.userId, manifestSha256,
         manifest.summary.itemCount, manifest.summary.totalBytes, manifest.summary.verifiedChecksumCount,
         JSON.stringify(counts), access.state],
      );
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="creatorhub-${req.params.projectId}-media-manifest.json"`);
      res.setHeader('X-CreatorHub-Manifest-SHA256', manifestSha256);
      res.setHeader('X-CreatorHub-Export-Receipt', String(receipt.rows[0]?.id || ''));
      res.send(body);
    } catch (error) {
      console.error('[creatorhub-media-export] failed', error);
      res.status(500).json({ error: 'media_export_failed' });
    }
  });
}
