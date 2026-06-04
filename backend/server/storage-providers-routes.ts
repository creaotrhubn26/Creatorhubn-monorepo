// Storage-providers routes — per-bruker S3-kompatible cloud-backup-creds.
//
// Brukes til offsite-backup-destinasjoner i Creatorhub One Desk.
// Fotografen oppretter selv en Backblaze-konto, genererer en
// application key, og limer inn key_id + application_key her. Vi
// validerer (kaller faktisk b2_authorize_account) før vi lagrer
// kryptert, og returnerer ALDRI plaintext til frontend etter
// opprettelse.
//
// Bruk i One Desk: dit-backup-routes.ts har ett endepunkt
// `/api/dit/projects/:id/destinations/with-creds` som autentiseres
// med helper-token og returnerer dekrypterte creds — det er den
// eneste veien plaintext forlater backend.

import express, { Router, Request, Response } from 'express';
import type { Pool } from 'pg';
import * as crypto from 'crypto';
import {
  encryptGoogleToken,
  decryptGoogleToken,
} from './google-oauth-shared.js';

const B2_API_BASE = 'https://api.backblazeb2.com/b2api/v3';

interface ProviderRow {
  id: string;
  user_id: string;
  provider: string;
  account_label: string;
  validated_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
}

interface B2AuthResponse {
  apiInfo?: {
    storageApi?: {
      apiUrl?: string;
      downloadUrl?: string;
      bucketId?: string | null;
      allowed?: {
        bucketId?: string | null;
        bucketName?: string | null;
        capabilities?: string[];
      };
    };
  };
  accountId?: string;
  authorizationToken?: string;
}

/**
 * Kall mot Backblaze for å verifisere at (key_id, app_key) faktisk
 * autoriserer. Returnerer accountId + tillatte capabilities ved suksess.
 */
async function validateB2Creds(
  keyId: string,
  applicationKey: string,
): Promise<{ ok: true; data: B2AuthResponse } | { ok: false; error: string }> {
  const credBytes = Buffer.from(`${keyId}:${applicationKey}`).toString('base64');
  try {
    const resp = await fetch(`${B2_API_BASE}/b2_authorize_account`, {
      method: 'GET',
      headers: { Authorization: `Basic ${credBytes}` },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return {
        ok: false,
        error: `Backblaze avviste credsen (HTTP ${resp.status}): ${body.slice(0, 200)}`,
      };
    }
    const data = (await resp.json()) as B2AuthResponse;
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: `Kunne ikke nå Backblaze: ${err?.message || err}` };
  }
}

export interface StorageProvidersRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}

export function setupStorageProvidersRoutes(deps: StorageProvidersRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // Idempotent schema-ensure — kjøres ved første request hvis migrasjon
  // 232 ikke har kjørt ennå (defensiv mot deploy-rekkefølge).
  let schemaReady: Promise<void> | null = null;
  const ensureSchema = (): Promise<void> => {
    if (!schemaReady) {
      schemaReady = pool
        .query(
          `CREATE TABLE IF NOT EXISTS user_storage_providers (
             id varchar PRIMARY KEY,
             user_id varchar NOT NULL,
             provider varchar(32) NOT NULL,
             account_label text NOT NULL,
             key_id_encrypted text NOT NULL,
             application_key_encrypted text NOT NULL,
             validated_at timestamptz,
             last_used_at timestamptz,
             created_at timestamptz NOT NULL DEFAULT now()
           );
           CREATE UNIQUE INDEX IF NOT EXISTS user_storage_providers_unique
             ON user_storage_providers (user_id, provider, account_label);
           CREATE INDEX IF NOT EXISTS user_storage_providers_user_idx
             ON user_storage_providers (user_id);`,
        )
        .then(() => undefined);
    }
    return schemaReady;
  };

  // POST /api/storage/providers — opprett + validér mot Backblaze
  app.post('/api/storage/providers', async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await ensureSchema();

    const body = (req.body ?? {}) as Record<string, unknown>;
    const provider = String(body.provider ?? '').trim();
    const accountLabel = String(body.account_label ?? '').trim();
    const keyId = String(body.key_id ?? '').trim();
    const applicationKey = String(body.application_key ?? '').trim();

    if (provider !== 'b2') {
      return res.status(400).json({ success: false, error: 'Kun provider="b2" støttes i v1' });
    }
    if (!accountLabel || !keyId || !applicationKey) {
      return res.status(400).json({
        success: false,
        error: 'account_label, key_id og application_key er påkrevd',
      });
    }
    if (accountLabel.length > 100 || keyId.length > 200 || applicationKey.length > 200) {
      return res.status(400).json({ success: false, error: 'For lange verdier' });
    }

    // Steg 1: validér mot Backblaze
    const validation = await validateB2Creds(keyId, applicationKey);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Steg 2: krypter og lagre
    const keyIdEnc = encryptGoogleToken(keyId);
    const appKeyEnc = encryptGoogleToken(applicationKey);
    if (!keyIdEnc || !appKeyEnc) {
      console.error('[storage-providers] encryption failed — sjekk encryption-key env-vars');
      return res
        .status(500)
        .json({ success: false, error: 'Krypteringsnøkkel ikke konfigurert på server' });
    }

    const id = `usp_${crypto.randomUUID()}`;
    try {
      await pool.query(
        `INSERT INTO user_storage_providers
           (id, user_id, provider, account_label, key_id_encrypted, application_key_encrypted, validated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (user_id, provider, account_label)
         DO UPDATE SET
           key_id_encrypted = EXCLUDED.key_id_encrypted,
           application_key_encrypted = EXCLUDED.application_key_encrypted,
           validated_at = now()`,
        [id, session.userId, provider, accountLabel, keyIdEnc, appKeyEnc],
      );
      return res.json({
        success: true,
        provider: {
          id,
          provider,
          account_label: accountLabel,
          validated_at: new Date().toISOString(),
        },
        // Hint til frontend om hva som er tilgjengelig — IKKE selve credsen
        capabilities: validation.data.apiInfo?.storageApi?.allowed?.capabilities ?? [],
      });
    } catch (err: any) {
      console.error('[storage-providers] insert failed:', err?.message || err);
      return res
        .status(500)
        .json({ success: false, error: 'Kunne ikke lagre storage-provider' });
    }
  });

  // GET /api/storage/providers — liste over brukerens providers (uten plaintext-creds)
  app.get('/api/storage/providers', async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await ensureSchema();

    try {
      const result = await pool.query<ProviderRow>(
        `SELECT id, user_id, provider, account_label, validated_at, last_used_at, created_at
           FROM user_storage_providers
          WHERE user_id = $1
          ORDER BY created_at DESC`,
        [session.userId],
      );
      return res.json({
        success: true,
        providers: result.rows.map((r) => ({
          id: r.id,
          provider: r.provider,
          account_label: r.account_label,
          validated_at: r.validated_at?.toISOString() ?? null,
          last_used_at: r.last_used_at?.toISOString() ?? null,
          created_at: r.created_at.toISOString(),
        })),
      });
    } catch (err: any) {
      console.error('[storage-providers] list failed:', err?.message || err);
      return res.status(500).json({ success: false, error: 'Kunne ikke hente providers' });
    }
  });

  // GET /api/storage/providers/:id/buckets — list B2-buckets fra provider
  // Returnerer også region-info så UI kan flagge non-EU-buckets.
  app.get(
    '/api/storage/providers/:id/buckets',
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      await ensureSchema();

      const providerId = String(req.params.id || '').trim();
      if (!providerId) return res.status(400).json({ success: false, error: 'id påkrevd' });

      const provCheck = await pool.query(
        `SELECT id FROM user_storage_providers WHERE id = $1 AND user_id = $2`,
        [providerId, session.userId],
      );
      if (provCheck.rowCount === 0) {
        return res.status(403).json({ success: false, error: 'Provider tilhører ikke deg' });
      }

      const creds = await getDecryptedProviderCreds(pool, providerId);
      if (!creds) {
        return res.status(500).json({ success: false, error: 'Kunne ikke dekryptere creds' });
      }

      const auth = await b2Authorize(creds.key_id, creds.application_key);
      if (!auth.ok) {
        return res.status(500).json({ success: false, error: auth.error });
      }

      try {
        const listResp = await fetch(`${auth.data.apiUrl}/b2api/v3/b2_list_buckets`, {
          method: 'POST',
          headers: {
            Authorization: auth.data.authToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accountId: auth.data.accountId }),
        });
        if (!listResp.ok) {
          const txt = await listResp.text().catch(() => '');
          return res
            .status(500)
            .json({ success: false, error: `B2 list_buckets: ${txt.slice(0, 200)}` });
        }
        const json = (await listResp.json()) as {
          buckets?: Array<{
            bucketId?: string;
            bucketName?: string;
            bucketType?: string;
            bucketInfo?: Record<string, unknown>;
          }>;
        };

        // B2 inkluderer ikke region i bucket-listingen. Vi infererer fra
        // accountAuthorization sin apiUrl — `s3.us-west-001.backblazeb2.com`
        // er US, `s3.eu-central-003.backblazeb2.com` er EU. Hele kontoens
        // buckets ligger i samme region.
        const apiUrl = auth.data.apiUrl;
        const isEuRegion =
          apiUrl.includes('eu-central') || apiUrl.includes('eu-west');
        const inferredRegion = isEuRegion
          ? 'eu-central'
          : apiUrl.includes('us-west')
            ? 'us-west'
            : apiUrl.includes('us-east')
              ? 'us-east'
              : 'unknown';

        const buckets = (json.buckets ?? []).map((b) => ({
          id: b.bucketId ?? '',
          name: b.bucketName ?? '',
          type: b.bucketType ?? '',
          region: inferredRegion,
          is_gdpr_safe: isEuRegion,
        }));

        return res.json({
          success: true,
          buckets,
          account_region: inferredRegion,
          gdpr_warning: !isEuRegion
            ? 'Kontoen din ser ut til å bruke US-region. For GDPR-samsvar anbefales EU Central (Amsterdam).'
            : null,
        });
      } catch (err: any) {
        console.error('[storage-providers] list_buckets failed:', err);
        return res.status(500).json({ success: false, error: err?.message || 'B2-feil' });
      }
    },
  );

  // POST /api/storage/providers/:id/erase-project — slett alle filer for
  // ett prosjekt fra Backblaze. Brukes for right-to-erasure (GDPR Art 17).
  // Iterer over dit_backup_jobs for prosjektet og kaller delete_file_version
  // på Backblaze. Logger alle slettinger i gdpr_deletion_audit.
  app.post(
    '/api/storage/providers/:id/erase-project',
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      await ensureSchema();
      await ensureAuditSchema(pool);

      const providerId = String(req.params.id || '').trim();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const projectId = String(body.project_id ?? '').trim();
      const reason = String(body.reason ?? 'user_request').trim().slice(0, 200);

      if (!providerId || !projectId) {
        return res
          .status(400)
          .json({ success: false, error: 'provider id + project_id påkrevd' });
      }

      // Eier-sjekk: provider må tilhøre denne brukeren
      const provCheck = await pool.query(
        `SELECT id FROM user_storage_providers WHERE id = $1 AND user_id = $2`,
        [providerId, session.userId],
      );
      if (provCheck.rowCount === 0) {
        return res
          .status(403)
          .json({ success: false, error: 'Provider tilhører ikke deg' });
      }

      // Hent alle backup-jobs for prosjektet som ble lastet opp til
      // denne providerens cloud-destinasjoner. dit_backup_jobs har
      // dest_path som inneholder b2://-prefiks for cloud-uploads.
      const jobs = await pool.query<{
        id: string;
        dest_path: string | null;
        cloud_bucket_id: string | null;
      }>(
        `SELECT j.id, j.dest_path, d.cloud_bucket_id
           FROM dit_backup_jobs j
           JOIN dit_destinations d ON j.destination_id = d.id
          WHERE j.project_id = $1
            AND d.cloud_provider_id = $2
            AND j.status = 'verified'
            AND j.dest_path LIKE 'b2://%'`,
        [projectId, providerId],
      );

      const creds = await getDecryptedProviderCreds(pool, providerId);
      if (!creds) {
        return res
          .status(500)
          .json({ success: false, error: 'Kunne ikke dekryptere provider-creds' });
      }

      // Autoriser én gang, bruk samme auth-token for alle slettinger
      const auth = await b2Authorize(creds.key_id, creds.application_key);
      if (!auth.ok) {
        return res.status(500).json({ success: false, error: auth.error });
      }

      let deleted = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const job of jobs.rows) {
        if (!job.dest_path) continue;
        // dest_path format: b2://<bucket_id>/<file_name>
        const match = job.dest_path.match(/^b2:\/\/[^/]+\/(.+)$/);
        if (!match) continue;
        const fileName = match[1];

        // For å slette må vi vite fileId. B2 har b2_list_file_versions for
        // å finne det. For nå lager vi en best-effort tilnærming: kall
        // delete_file_version med fileName + tomt fileId vil ikke virke,
        // så vi kaller list-versions først.
        try {
          const fileId = await b2GetLatestFileId(auth.data, job.dest_path, fileName);
          if (!fileId) {
            errors.push(`${fileName}: ingen versjon funnet`);
            failed++;
            continue;
          }
          const delResult = await b2DeleteFileVersion(auth.data, fileId, fileName);
          if (delResult.ok) {
            deleted++;
            await pool
              .query(
                `INSERT INTO gdpr_deletion_audit
                   (user_id, project_id, provider_id, file_name, file_id, reason)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [session.userId, projectId, providerId, fileName, fileId, reason],
              )
              .catch(() => {});
          } else {
            failed++;
            errors.push(`${fileName}: ${delResult.error}`);
          }
        } catch (err: any) {
          failed++;
          errors.push(`${fileName}: ${err?.message || err}`);
        }
      }

      // C: Unified erasure — slett OGSÅ tilhørende UniversalShowcase-
      // gallerier + items koblet til samme prosjekt-id. Bridge bruker
      // gallery_settings.ditProjectId som dedupe-key.
      let showcaseDeleted = 0;
      try {
        const showcaseRes = await pool.query<{ id: string }>(
          `DELETE FROM photographer_client_galleries
            WHERE photographer_id = $1
              AND gallery_settings ->> 'ditProjectId' = $2
            RETURNING id`,
          [session.userId, projectId],
        );
        showcaseDeleted = showcaseRes.rowCount ?? 0;
        for (const row of showcaseRes.rows) {
          await pool
            .query(
              `INSERT INTO gdpr_deletion_audit
                 (user_id, project_id, provider_id, file_name, file_id, reason)
               VALUES ($1, $2, $3, $4, NULL, $5)`,
              [
                session.userId,
                projectId,
                providerId,
                `showcase-gallery:${row.id}`,
                `${reason} + showcase`,
              ],
            )
            .catch(() => {});
        }
      } catch (err: any) {
        console.error('[storage-providers] showcase-deletion failed:', err?.message || err);
      }

      return res.json({
        success: true,
        deleted,
        failed,
        total: jobs.rows.length,
        showcase_galleries_deleted: showcaseDeleted,
        errors: errors.slice(0, 10),
      });
    },
  );

  // B: POST /api/dit/projects/:projectId/deliver-to-showcase
  // Oppretter (eller gjenoppretter) en photographer_client_gallery for
  // klienten + insert client_gallery_images-rader med b2Source-metadata.
  // INGEN bytes flyttes — Cloudflare Worker generer signed B2-URL
  // just-in-time per request via /api/showcase/items/:id/sign-url.
  app.post(
    '/api/dit/projects/:projectId/deliver-to-showcase',
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const projectId = String(req.params.projectId || '').trim();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const clientName = String(body.client_name ?? '').trim();
      const clientEmail = String(body.client_email ?? '').trim().toLowerCase();
      const galleryLabel = String(body.gallery_label ?? '').trim();
      const sourcePaths = Array.isArray(body.source_paths)
        ? (body.source_paths as unknown[]).map((p) => String(p)).filter(Boolean)
        : [];

      if (!projectId || !clientName || !clientEmail || sourcePaths.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'projectId, client_name, client_email og source_paths påkrevd',
        });
      }
      if (sourcePaths.length > 2000) {
        return res.status(400).json({
          success: false,
          error: 'Maks 2000 filer per leveranse',
        });
      }

      // Eier-sjekk på prosjekt
      const ownerCheck = await pool.query<{ name: string | null; title: string | null }>(
        `SELECT name, title FROM legacy.projects WHERE id = $1 AND user_id = $2`,
        [projectId, session.userId],
      );
      if (ownerCheck.rowCount === 0) {
        return res
          .status(403)
          .json({ success: false, error: 'Prosjekt tilhører ikke deg' });
      }
      const projectTitle =
        galleryLabel ||
        ownerCheck.rows[0]?.name ||
        ownerCheck.rows[0]?.title ||
        'Backup-leveranse';

      // Slå opp jobs med matchende source_path. Krever cloud_provider (B2).
      // Vi lagrer providerId + bucketId + fileName per item så Worker
      // kan signere URL on-demand.
      const jobsRes = await pool.query<{
        source_path: string;
        source_size_bytes: string | null;
        source_hash: string | null;
        dest_path: string | null;
        cloud_provider_id: string | null;
        cloud_bucket_id: string | null;
      }>(
        `SELECT
           j.source_path,
           j.source_size_bytes::text AS source_size_bytes,
           j.source_hash,
           j.dest_path,
           d.cloud_provider_id,
           d.cloud_bucket_id
         FROM dit_backup_jobs j
         JOIN dit_destinations d ON j.destination_id = d.id
         WHERE j.project_id = $1
           AND j.status = 'verified'
           AND d.cloud_provider = 'b2'
           AND j.source_path = ANY($2::text[])`,
        [projectId, sourcePaths],
      );
      if (jobsRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Ingen filer funnet i B2-arkiv for disse stiene',
        });
      }

      // Dedupe på source_path (samme fil kan ha flere cloud-destinasjoner —
      // bruk den nyeste backup-jobben)
      const bySource = new Map<string, typeof jobsRes.rows[number]>();
      for (const row of jobsRes.rows) {
        if (!bySource.has(row.source_path)) {
          bySource.set(row.source_path, row);
        }
      }
      const items = Array.from(bySource.values());

      // Få eller opprett galleri. Idempotent via gallery_settings.ditProjectId
      // (matcher capture-showcase-bridge-pattern).
      const existingGalleryRes = await pool.query<{
        id: string;
        access_token: string;
      }>(
        `SELECT id, access_token FROM photographer_client_galleries
          WHERE photographer_id = $1
            AND gallery_settings ->> 'ditProjectId' = $2
          LIMIT 1`,
        [session.userId, projectId],
      );

      let galleryId: string;
      let accessToken: string;
      let createdNew = false;

      if ((existingGalleryRes.rowCount ?? 0) > 0) {
        galleryId = existingGalleryRes.rows[0].id;
        accessToken = existingGalleryRes.rows[0].access_token;
      } else {
        accessToken = `gly_${crypto
          .randomBytes(24)
          .toString('base64url')
          .slice(0, 32)}`;
        galleryId = crypto.randomUUID();
        try {
          await pool.query(
            `INSERT INTO photographer_client_galleries
               (id, photographer_id, client_name, client_email, project_title,
                access_token, gallery_settings, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active')`,
            [
              galleryId,
              session.userId,
              clientName,
              clientEmail,
              projectTitle,
              accessToken,
              JSON.stringify({
                ditProjectId: projectId,
                source: 'dit-archive',
                createdVia: 'one-desk-deliver',
              }),
            ],
          );
          createdNew = true;
        } catch (err: any) {
          console.error('[deliver-to-showcase] gallery insert failed:', err?.message || err);
          return res
            .status(500)
            .json({ success: false, error: 'Kunne ikke opprette galleri' });
        }
      }

      // Insert items — dedupe via image_metadata.b2Source.fileName
      let inserted = 0;
      const errors: string[] = [];
      for (const item of items) {
        if (!item.dest_path || !item.cloud_provider_id || !item.cloud_bucket_id) {
          errors.push(`${item.source_path}: mangler cloud-metadata`);
          continue;
        }
        // dest_path format: b2://<bucket_id>/<file_name>
        const match = item.dest_path.match(/^b2:\/\/[^/]+\/(.+)$/);
        if (!match) {
          errors.push(`${item.source_path}: kunne ikke parse dest_path`);
          continue;
        }
        const fileName = match[1];
        const filename = item.source_path.split('/').pop() ?? item.source_path;
        const itemId = crypto.randomUUID();

        try {
          // Sjekk for eksisterende item med samme b2-fileName i denne galleri
          const dup = await pool.query(
            `SELECT id FROM client_gallery_images
              WHERE gallery_id = $1
                AND image_metadata ->> 'b2FileName' = $2
              LIMIT 1`,
            [galleryId, fileName],
          );
          if ((dup.rowCount ?? 0) > 0) continue;

          await pool.query(
            `INSERT INTO client_gallery_images
               (id, gallery_id, image_url, thumbnail_url, original_filename,
                image_metadata)
             VALUES ($1, $2, $3, $3, $4, $5::jsonb)`,
            [
              itemId,
              galleryId,
              // Vil bli proxyet av Cloudflare Worker
              `/api/showcase/cdn/${accessToken}/${itemId}`,
              filename,
              JSON.stringify({
                b2ProviderId: item.cloud_provider_id,
                b2BucketId: item.cloud_bucket_id,
                b2FileName: fileName,
                sha1: item.source_hash,
                sizeBytes: item.source_size_bytes
                  ? Number(item.source_size_bytes)
                  : null,
                source: 'dit-archive',
                ditProjectId: projectId,
              }),
            ],
          );
          inserted++;
        } catch (err: any) {
          errors.push(`${item.source_path}: ${err?.message || err}`);
        }
      }

      return res.json({
        success: true,
        gallery_id: galleryId,
        access_token: accessToken,
        gallery_url: `/gallery/${accessToken}`,
        delivered: inserted,
        skipped: items.length - inserted,
        created_new_gallery: createdNew,
        errors: errors.slice(0, 10),
      });
    },
  );

  // B: GET /api/showcase/items/:item_id/sign-url
  // Kalles av Cloudflare Worker (eller direkte av klient ved fallback)
  // for å få en fersk signed B2-download-URL for ett item. Auth via
  // gallery access_token i query-param. Worker har egen rate-limit per
  // token; vi gjør grunn-verifisering her.
  app.get('/api/showcase/items/:itemId/sign-url', async (req, res) => {
    const itemId = String(req.params.itemId || '').trim();
    const accessToken = String(req.query.token || '').trim();
    if (!itemId || !accessToken) {
      return res.status(400).json({ success: false, error: 'itemId + token påkrevd' });
    }

    // Slå opp item + verifisér at access-token matcher galleriet
    const itemRes = await pool.query<{
      image_metadata: Record<string, unknown>;
      photographer_id: string;
    }>(
      `SELECT i.image_metadata, g.photographer_id
         FROM client_gallery_images i
         JOIN photographer_client_galleries g ON i.gallery_id = g.id
        WHERE i.id = $1 AND g.access_token = $2 AND g.status = 'active'
        LIMIT 1`,
      [itemId, accessToken],
    );
    if (itemRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Item ikke funnet' });
    }
    const meta = itemRes.rows[0].image_metadata ?? {};
    const providerId = String(meta.b2ProviderId ?? '');
    const bucketId = String(meta.b2BucketId ?? '');
    const fileName = String(meta.b2FileName ?? '');
    if (!providerId || !bucketId || !fileName) {
      return res.status(400).json({ success: false, error: 'Item er ikke B2-source' });
    }

    const creds = await getDecryptedProviderCreds(pool, providerId);
    if (!creds) {
      return res.status(500).json({ success: false, error: 'Provider-creds ikke tilgjengelig' });
    }

    const auth = await b2Authorize(creds.key_id, creds.application_key);
    if (!auth.ok) {
      return res.status(500).json({ success: false, error: auth.error });
    }

    // b2_get_download_authorization for å lage signed-URL med TTL 1 time
    try {
      const downloadAuthResp = await fetch(
        `${auth.data.apiUrl}/b2api/v3/b2_get_download_authorization`,
        {
          method: 'POST',
          headers: {
            Authorization: auth.data.authToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bucketId,
            fileNamePrefix: fileName,
            validDurationInSeconds: 3600,
          }),
        },
      );
      if (!downloadAuthResp.ok) {
        const txt = await downloadAuthResp.text().catch(() => '');
        return res
          .status(500)
          .json({ success: false, error: `B2 download-auth: ${txt.slice(0, 200)}` });
      }
      const downloadAuthJson = (await downloadAuthResp.json()) as {
        authorizationToken: string;
        bucketName?: string;
      };

      // Slå opp bucketName fra list_buckets så vi kan bygge download-URL
      // (Cloudflare Worker trenger den)
      let bucketName = downloadAuthJson.bucketName;
      if (!bucketName) {
        const lbResp = await fetch(`${auth.data.apiUrl}/b2api/v3/b2_list_buckets`, {
          method: 'POST',
          headers: {
            Authorization: auth.data.authToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: auth.data.accountId,
            bucketId,
          }),
        });
        if (lbResp.ok) {
          const lbJson = (await lbResp.json()) as { buckets?: Array<{ bucketName?: string }> };
          bucketName = lbJson.buckets?.[0]?.bucketName ?? '';
        }
      }

      // Bygg download-URL. B2 download-host kan utledes fra apiUrl
      // (s3.eu-central-003.backblazeb2.com → f003.backblazeb2.com)
      const downloadHost = auth.data.apiUrl
        .replace('https://', '')
        .replace(/^api/, 'f')
        .split('/')[0];
      const signedUrl = `https://${downloadHost}/file/${bucketName}/${encodeURIComponent(
        fileName,
      )}?Authorization=${downloadAuthJson.authorizationToken}`;

      return res.json({
        success: true,
        url: signedUrl,
        expires_in: 3600,
      });
    } catch (err: any) {
      console.error('[sign-url] failed:', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'sign-url-feil' });
    }
  });

  // A: GET /api/dit/projects/:projectId/archive-files — lister verifiserte
  // B2-arkiv-filer for ett prosjekt. Brukes av UI for å vise «X filer i
  // arkiv» + som data-kilde for «Lever til showcase»-pickeren (B).
  app.get('/api/dit/projects/:projectId/archive-files', async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId påkrevd' });

    // Eier-sjekk via legacy.projects.user_id
    const ownerCheck = await pool.query(
      `SELECT id FROM legacy.projects WHERE id = $1 AND user_id = $2`,
      [projectId, session.userId],
    );
    if (ownerCheck.rowCount === 0) {
      return res.status(403).json({ success: false, error: 'Prosjekt tilhører ikke deg' });
    }

    try {
      // Aggregér på source_path så samme fil kopiert til N destinasjoner
      // teller som ÉN. Vis bare verifiserte cloud-uploads.
      const filesRes = await pool.query<{
        source_path: string;
        source_size_bytes: string | null;
        source_hash: string | null;
        camera_id: string | null;
        verified_at: Date | null;
        cloud_providers: string[];
      }>(
        `SELECT
           j.source_path,
           MAX(j.source_size_bytes::text) AS source_size_bytes,
           MAX(j.source_hash) AS source_hash,
           MAX(j.camera_id) AS camera_id,
           MAX(j.completed_at) AS verified_at,
           ARRAY_AGG(DISTINCT d.cloud_provider) FILTER (WHERE d.cloud_provider IS NOT NULL) AS cloud_providers
         FROM dit_backup_jobs j
         JOIN dit_destinations d ON j.destination_id = d.id
         WHERE j.project_id = $1
           AND j.status = 'verified'
           AND d.cloud_provider IS NOT NULL
         GROUP BY j.source_path
         ORDER BY MAX(j.completed_at) DESC NULLS LAST
         LIMIT 1000`,
        [projectId],
      );
      const files = filesRes.rows.map((r) => ({
        source_path: r.source_path,
        filename: r.source_path.split('/').pop() ?? r.source_path,
        size_bytes: r.source_size_bytes ? Number(r.source_size_bytes) : null,
        source_hash: r.source_hash,
        camera_id: r.camera_id,
        verified_at: r.verified_at?.toISOString() ?? null,
        cloud_providers: r.cloud_providers ?? [],
      }));
      return res.json({
        success: true,
        files,
        count: files.length,
        total_bytes: files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0),
      });
    } catch (err: any) {
      console.error('[archive-files] failed:', err?.message || err);
      return res.status(500).json({ success: false, error: 'Kunne ikke hente arkiv' });
    }
  });

  // DELETE /api/storage/providers/:id — fjern provider (sletter ikke filer på Backblaze!)
  app.delete('/api/storage/providers/:id', async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await ensureSchema();

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id påkrevd' });
    try {
      const result = await pool.query(
        `DELETE FROM user_storage_providers WHERE id = $1 AND user_id = $2`,
        [id, session.userId],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Provider ikke funnet' });
      }
      return res.json({
        success: true,
        warning:
          'Provider-en er fjernet fra Creatorhub. Eksisterende filer i Backblaze-bucket er IKKE slettet — administrer dem i Backblaze-konsollen.',
      });
    } catch (err: any) {
      console.error('[storage-providers] delete failed:', err?.message || err);
      return res.status(500).json({ success: false, error: 'Kunne ikke fjerne' });
    }
  });
}

// ── B2 server-side helpers for GDPR right-to-erasure ──────────────

interface B2AuthData {
  apiUrl: string;
  authToken: string;
  accountId: string;
}

async function b2Authorize(
  keyId: string,
  applicationKey: string,
): Promise<{ ok: true; data: B2AuthData } | { ok: false; error: string }> {
  try {
    const credBytes = Buffer.from(`${keyId}:${applicationKey}`).toString('base64');
    const resp = await fetch(`${B2_API_BASE}/b2_authorize_account`, {
      headers: { Authorization: `Basic ${credBytes}` },
    });
    if (!resp.ok) {
      return { ok: false, error: `B2 authorize feilet (HTTP ${resp.status})` };
    }
    const json = (await resp.json()) as any;
    return {
      ok: true,
      data: {
        apiUrl: String(json?.apiInfo?.storageApi?.apiUrl ?? ''),
        authToken: String(json?.authorizationToken ?? ''),
        accountId: String(json?.accountId ?? ''),
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * b2_list_file_versions for å finne fileId av nyeste versjon. Brukes
 * fordi delete_file_version krever fileId, ikke bare fileName.
 */
async function b2GetLatestFileId(
  auth: B2AuthData,
  _destPath: string,
  fileName: string,
): Promise<string | null> {
  try {
    const resp = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
      method: 'POST',
      headers: {
        Authorization: auth.authToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: fileName, maxFileCount: 1 }),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { files?: Array<{ fileId?: string; fileName?: string }> };
    const found = (json.files ?? []).find((f) => f.fileName === fileName);
    return found?.fileId ?? null;
  } catch {
    return null;
  }
}

async function b2DeleteFileVersion(
  auth: B2AuthData,
  fileId: string,
  fileName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resp = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
      method: 'POST',
      headers: {
        Authorization: auth.authToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, fileName }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { ok: false, error: txt.slice(0, 200) };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Ensure gdpr_deletion_audit-tabellen finnes. Migration 233 kjøres
 * normalt ved deploy, men dette er defensiv som ensureSchema.
 */
let auditSchemaReady: Promise<void> | null = null;
async function ensureAuditSchema(pool: Pool): Promise<void> {
  if (!auditSchemaReady) {
    auditSchemaReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS gdpr_deletion_audit (
           id bigserial PRIMARY KEY,
           user_id varchar NOT NULL,
           project_id varchar NOT NULL,
           provider_id varchar NOT NULL,
           file_name text NOT NULL,
           file_id varchar,
           reason text,
           deleted_at timestamptz NOT NULL DEFAULT now()
         );
         CREATE INDEX IF NOT EXISTS gdpr_deletion_audit_user_idx
           ON gdpr_deletion_audit (user_id, deleted_at DESC);
         CREATE INDEX IF NOT EXISTS gdpr_deletion_audit_project_idx
           ON gdpr_deletion_audit (project_id, deleted_at DESC);`,
      )
      .then(() => undefined);
  }
  return auditSchemaReady;
}

/**
 * Henter dekrypterte creds for en spesifikk provider — brukes av
 * dit-backup-routes.ts når One Desk spør om destinasjoner med creds.
 * MÅ kun kalles etter Bearer helper-token-validering.
 */
export async function getDecryptedProviderCreds(
  pool: Pool,
  providerId: string,
): Promise<{ key_id: string; application_key: string } | null> {
  try {
    const result = await pool.query<{
      key_id_encrypted: string;
      application_key_encrypted: string;
    }>(
      `SELECT key_id_encrypted, application_key_encrypted
         FROM user_storage_providers
        WHERE id = $1`,
      [providerId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    const keyId = decryptGoogleToken(row.key_id_encrypted);
    const applicationKey = decryptGoogleToken(row.application_key_encrypted);
    if (!keyId || !applicationKey) return null;
    // Fire-and-forget last_used_at-oppdatering
    pool
      .query(`UPDATE user_storage_providers SET last_used_at = now() WHERE id = $1`, [providerId])
      .catch(() => {});
    return { key_id: keyId, application_key: applicationKey };
  } catch (err) {
    console.error('[storage-providers] decrypt failed:', err);
    return null;
  }
}
