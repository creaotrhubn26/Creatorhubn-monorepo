/**
 * pitch-deck-asset-service.ts
 *
 * Mockup-/logo-/icon-uploads for Pitch Deck Studio. Nye uploads
 * scopes per organisasjon i Leadgrids private AWS-bucket for å
 * holde lagringen ryddig + sikre cross-org-isolasjon:
 *
 *   organizations/{opaque org/project/entity identifiers}/...
 *
 * Sikkerhet:
 *   - requireLeadMapPermission("pitch_deck.edit") på upload + delete
 *   - I tillegg sjekker vi at deck'ets org_id matcher caller's
 *     resolveOrgId — så en pitch_deck.edit i org A ikke kan poke i
 *     org B's slides selv om hen kjenner slide-id'en.
 *   - Signed URLs bygges on-demand (10 min ttl) ved load av slides;
 *     vi lagrer ALDRI public URL'er.
 *
 * Endepunkter (registreres parallelt i index.ts):
 *   POST   /api/admin-room/lead-map/pitch-deck/slides/:id/mockup
 *   DELETE /api/admin-room/lead-map/pitch-deck/slides/:id/mockups/:asset_id
 *   GET    /api/admin-room/lead-map/pitch-deck/decks/:id/asset-urls
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  getLeadgridObjectStorage,
  leadgridStorageKeys,
  type LeadgridStorageProvider,
} from "./leadgrid-s3-storage-service.js";
import { leadgridStoragePersistenceError } from "./leadgrid-org-storage-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const B2_REGION = process.env.B2_REGION || "eu-central-003";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;
const SIGNED_URL_TTL_SEC = 600;          // 10 min — refreshes per request
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB ferdig komprimert
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp",
]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function matchesImageSignature(body: Buffer, mime: string): boolean {
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  if (mime === "image/png") {
    return body.length >= 8 && body.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mime === "image/webp") {
    return body.length >= 12 &&
      body.subarray(0, 4).toString("ascii") === "RIFF" &&
      body.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function getB2(): { client: S3Client; bucket: string } | null {
  const keyId = process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID;
  const appKey = process.env.B2_ROLE_ROOM_APPLICATION_KEY;
  const bucket = process.env.B2_ROLE_ROOM_BUCKET_NAME;
  if (!keyId || !appKey || !bucket) return null;
  return {
    client: new S3Client({
      region: B2_REGION,
      endpoint: B2_ENDPOINT,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      forcePathStyle: true,
    }),
    bucket,
  };
}

// ─────────────────────────────────────────────────────────────────
// Sikkerhetshelper: hent deck + sjekk caller's org-match
// ─────────────────────────────────────────────────────────────────

interface SlideOrgInfo {
  slide_id: string;
  deck_id: string;
  org_id: string;
  mockup_urls: unknown;
}

async function loadSlideOrg(
  pool: Pool, slideId: string,
): Promise<SlideOrgInfo | null> {
  const r = await pool.query<SlideOrgInfo>(
    `SELECT s.id::text AS slide_id, s.deck_id::text, d.org_id::text,
            s.mockup_urls
       FROM pitch_slides s
       JOIN pitch_decks d ON d.id = s.deck_id
      WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [slideId],
  );
  return r.rows[0] ?? null;
}

async function resolveSlideOrgId(_req: Request, pool: Pool, _userId: string): Promise<string | null> {
  const slideId = _req.params.id;
  if (!slideId) return null;
  const result = await pool.query<{ organization_id: string }>(
    `SELECT d.org_id::text AS organization_id
       FROM pitch_slides s
       JOIN pitch_decks d ON d.id = s.deck_id
      WHERE s.id = $1 AND s.deleted_at IS NULL
      LIMIT 1`,
    [slideId],
  );
  return result.rows[0]?.organization_id ?? null;
}

async function resolveDeckOrgId(req: Request, pool: Pool, _userId: string): Promise<string | null> {
  const result = await pool.query<{ organization_id: string }>(
    `SELECT org_id::text AS organization_id
       FROM pitch_decks WHERE id = $1 LIMIT 1`,
    [req.params.id],
  );
  return result.rows[0]?.organization_id ?? null;
}

// ─────────────────────────────────────────────────────────────────
// Public: bygg signed URLs for alle assets i et deck
// Kalles av iPad-Studio etter load slik at AsyncImage får fresh
// URL'er hver gang.
// ─────────────────────────────────────────────────────────────────

export async function buildAssetUrlMap(
  pool: Pool, deckId: string, organizationId: string,
): Promise<Record<string, string>> {
  const b2 = getB2();
  const leadgridStorage = getLeadgridObjectStorage();
  const r = await pool.query<{
    id: string;
    b2_key: string;
    storage_provider: LeadgridStorageProvider;
  }>(
    `SELECT a.id::text, a.b2_key, a.storage_provider
       FROM pitch_deck_assets a
       JOIN pitch_decks d ON d.id = a.deck_id
      WHERE a.deck_id = $1 AND d.org_id = $2::uuid`,
    [deckId, organizationId],
  );
  const out: Record<string, string> = {};
  for (const row of r.rows) {
    try {
      const url = row.storage_provider === "aws_s3"
        ? await leadgridStorage?.createDownloadUrl(row.b2_key, SIGNED_URL_TTL_SEC)
        : b2
          ? await getSignedUrl(
              b2.client,
              new GetObjectCommand({ Bucket: b2.bucket, Key: row.b2_key }),
              { expiresIn: SIGNED_URL_TTL_SEC },
            )
          : null;
      if (!url) continue;
      out[row.id] = url;
    } catch { /* tystefall */ }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Registrering
// ─────────────────────────────────────────────────────────────────

export function registerPitchDeckAssetRoutes({
  app, pool, activeSessions,
}: Deps): void {
  const ROOT = "/api/admin-room/lead-map/pitch-deck";

  // ─── POST /slides/:id/mockup ───────────────────────────────────
  // Body: { mime: "image/jpeg", data_base64: "...", asset_type?: "mockup" }
  app.post(
    `${ROOT}/slides/:id/mockup`,
    requireLeadMapPermission("pitch_deck.edit", {
      pool, activeSessions, resolveOrgId: resolveSlideOrgId,
    }),
    async (req: Request, res: Response) => {
      const storage = getLeadgridObjectStorage();
      if (!storage) {
        return res.status(503).json({ error: "leadgrid_storage_not_configured" });
      }
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      const body = req.body as {
        mime?: string;
        data_base64?: string;
        asset_type?: string;
      };
      const mime = (body.mime ?? "").toLowerCase();
      if (!ALLOWED_MIME.has(mime)) {
        return res.status(400).json({
          error: "ulovlig_mime",
          allowed: Array.from(ALLOWED_MIME),
        });
      }
      if (!body.data_base64 || typeof body.data_base64 !== "string") {
        return res.status(400).json({ error: "mangler_data_base64" });
      }
      // Buffer.from(base64) er tolerant, så syntaksen må valideres først.
      if (
        !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data_base64) ||
        body.data_base64.length % 4 !== 0
      ) {
        return res.status(400).json({ error: "ugyldig_base64" });
      }
      const buf = Buffer.from(body.data_base64, "base64");
      if (buf.byteLength === 0) {
        return res.status(400).json({ error: "tom_payload" });
      }
      if (buf.byteLength > MAX_UPLOAD_BYTES) {
        return res.status(413).json({
          error: "payload_for_stor",
          max_bytes: MAX_UPLOAD_BYTES,
        });
      }
      if (!matchesImageSignature(buf, mime)) {
        return res.status(415).json({ error: "mime_stemmer_ikke_med_fil" });
      }

      // Hent slide + verifiser at caller's org matcher deck.org_id
      const slideOrg = await loadSlideOrg(pool, req.params.id);
      if (!slideOrg) return res.status(404).json({ error: "slide_not_found" });

      // Cross-org-check: requireLeadMapPermission har allerede
      // sjekket pitch_deck.edit i CALLERENS org (via defaultResolveOrgId
      // som faller tilbake til brukerens default-org). Vi må re-sjekke
      // at den orgen er den samme som deck'ets org for å hindre at
      // en admin i org A kan poke i org B's slide.
      const callerOrgRes = await pool.query<{ organization_id: string }>(
        `SELECT organization_id::text
           FROM organization_members
          WHERE user_id = $1 AND organization_id = $2
          LIMIT 1`,
        [session.userId, slideOrg.org_id],
      );
      if (callerOrgRes.rows.length === 0) {
        return res.status(403).json({ error: "feil_org_for_slide" });
      }

      const assetType = body.asset_type === "before_image"
        || body.asset_type === "after_image"
        || body.asset_type === "icon"
        || body.asset_type === "cover_logo"
        ? body.asset_type : "mockup";

      const assetUuid = crypto.randomUUID();
      const objectKey = leadgridStorageKeys.pitchDeckAsset({
        organizationId: slideOrg.org_id,
        deckId: slideOrg.deck_id,
        slideId: slideOrg.slide_id,
        assetId: assetUuid,
      });

      let uploaded;
      try {
        uploaded = await storage.putObject({
          key: objectKey,
          body: buf,
          contentType: mime,
          purpose: "pitch_deck_asset",
        });
      } catch (err) {
        return res.status(502).json({
          error: "leadgrid_storage_upload_failed",
        });
      }

      let assetId: string;
      try {
        const assetRes = await pool.query<{ id: string }>(
          `WITH stored AS (
             INSERT INTO leadgrid_storage_objects
               (id, organization_id, uploaded_by, storage_provider,
                bucket_name, object_key, purpose, display_name, size_bytes,
                content_type, checksum_sha256, metadata)
             VALUES
               ($1::uuid, $2::uuid, $3, 'aws_s3', $4, $5,
                'pitch_deck_asset', $6, $7, $8, $9, $10::jsonb)
             RETURNING id
           )
           INSERT INTO pitch_deck_assets
             (id, deck_id, slide_id, asset_type, b2_key, mime_type,
              uploaded_by, storage_provider, storage_object_id, size_bytes,
              checksum_sha256)
           SELECT $1::uuid, $11::uuid, $12::uuid, $13, $5, $8,
                  $3, 'aws_s3', id, $7, $9
             FROM stored
           RETURNING id::text`,
          [
            assetUuid,
            slideOrg.org_id,
            session.userId,
            uploaded.bucket,
            uploaded.key,
            `${assetType}.${MIME_TO_EXT[mime]}`,
            uploaded.sizeBytes,
            mime,
            uploaded.checksumSha256,
            JSON.stringify({ deckId: slideOrg.deck_id, slideId: slideOrg.slide_id }),
            slideOrg.deck_id,
            slideOrg.slide_id,
            assetType,
          ],
        );
        assetId = assetRes.rows[0].id;
      } catch (error) {
        await storage.deleteObject(uploaded.key).catch(() => undefined);
        const storageError = leadgridStoragePersistenceError(error);
        if (storageError) {
          return res.status(storageError.status).json({ error: storageError.code });
        }
        throw error;
      }

      // Oppdatér pitch_slides.mockup_urls — vi lagrer asset_id som
      // url-referanse + en caption (kan endres senere via PATCH).
      // Når UI laster decket, kaller den buildAssetUrlMap som bytter
      // asset_id ut med en fresh signed URL.
      if (assetType === "mockup") {
        const existing = Array.isArray(slideOrg.mockup_urls)
          ? slideOrg.mockup_urls as Array<Record<string, unknown>>
          : [];
        const newList = [
          ...existing,
          { url: `asset://${assetId}`, caption: body.asset_type ?? null },
        ];
        await pool.query(
          `UPDATE pitch_slides SET mockup_urls = $2::jsonb WHERE id = $1`,
          [slideOrg.slide_id, JSON.stringify(newList)],
        );
      }

      // Bygg én signed URL slik at UI kan vise den umiddelbart uten
      // å re-laste decket
      let signedUrl: string | null = null;
      try {
        signedUrl = await storage.createDownloadUrl(uploaded.key, SIGNED_URL_TTL_SEC);
      } catch { /* tystefall */ }

      return res.status(201).json({
        asset: {
          id: assetId,
          asset_type: assetType,
          mime_type: mime,
          size_bytes: buf.byteLength,
          signed_url: signedUrl,
        },
      });
    },
  );

  // ─── DELETE /slides/:id/mockups/:asset_id ──────────────────────
  app.delete(
    `${ROOT}/slides/:id/mockups/:asset_id`,
    requireLeadMapPermission("pitch_deck.edit", {
      pool, activeSessions, resolveOrgId: resolveSlideOrgId,
    }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      // Hent asset + verifiser org-match
      const assetRes = await pool.query<{
        deck_id: string;
        slide_id: string;
        b2_key: string;
        org_id: string;
        storage_provider: LeadgridStorageProvider;
        storage_object_id: string | null;
      }>(
        `SELECT a.deck_id::text, a.slide_id::text, a.b2_key,
                d.org_id::text, a.storage_provider,
                a.storage_object_id::text
           FROM pitch_deck_assets a
           JOIN pitch_decks d ON d.id = a.deck_id
          WHERE a.id = $1 AND a.slide_id = $2`,
        [req.params.asset_id, req.params.id],
      );
      if (assetRes.rows.length === 0) {
        return res.status(404).json({ error: "asset_not_found" });
      }
      const asset = assetRes.rows[0];

      const callerOrgRes = await pool.query<{ organization_id: string }>(
        `SELECT organization_id::text FROM organization_members
          WHERE user_id = $1 AND organization_id = $2 LIMIT 1`,
        [session.userId, asset.org_id],
      );
      if (callerOrgRes.rows.length === 0) {
        return res.status(403).json({ error: "feil_org_for_asset" });
      }

      if (asset.storage_provider === "aws_s3") {
        const storage = getLeadgridObjectStorage();
        if (!storage) {
          return res.status(503).json({ error: "leadgrid_storage_not_configured" });
        }
        if (asset.storage_object_id) {
          await pool.query(
            `UPDATE leadgrid_storage_objects SET deleted_at = NOW()
              WHERE id = $1::uuid AND deleted_at IS NULL`,
            [asset.storage_object_id],
          );
        }
        try {
          await storage.deleteObject(asset.b2_key);
        } catch {
          if (asset.storage_object_id) {
            await pool.query(
              `UPDATE leadgrid_storage_objects SET deleted_at = NULL
                WHERE id = $1::uuid AND deleted_at IS NOT NULL`,
              [asset.storage_object_id],
            ).catch(() => undefined);
          }
          return res.status(502).json({ error: "leadgrid_storage_delete_failed" });
        }
      } else {
        const b2 = getB2();
        if (!b2) return res.status(503).json({ error: "b2_ikke_konfigurert" });
        try {
          await b2.client.send(new DeleteObjectCommand({
            Bucket: b2.bucket,
            Key: asset.b2_key,
          }));
        } catch {
          return res.status(502).json({ error: "b2_delete_failed" });
        }
      }

      // Slett asset-rad
      await pool.query(
        `DELETE FROM pitch_deck_assets WHERE id = $1`,
        [req.params.asset_id],
      );
      if (asset.storage_object_id) {
        await pool.query(
          `DELETE FROM leadgrid_storage_objects WHERE id = $1::uuid`,
          [asset.storage_object_id],
        );
      }

      // Fjern asset://-referansen fra slide.mockup_urls
      const slideRes = await pool.query<{ mockup_urls: unknown }>(
        `SELECT mockup_urls FROM pitch_slides WHERE id = $1`,
        [req.params.id],
      );
      const current = Array.isArray(slideRes.rows[0]?.mockup_urls)
        ? slideRes.rows[0].mockup_urls as Array<Record<string, unknown>>
        : [];
      const filtered = current.filter((m) =>
        typeof m.url === "string" && m.url !== `asset://${req.params.asset_id}`,
      );
      await pool.query(
        `UPDATE pitch_slides SET mockup_urls = $2::jsonb WHERE id = $1`,
        [req.params.id, JSON.stringify(filtered)],
      );

      return res.json({ ok: true });
    },
  );

  // ─── GET /decks/:id/asset-urls ─────────────────────────────────
  // Returnerer { asset_id: signed_url } for alle assets i decket.
  // UI bytter `asset://{id}`-referanser i mockup_urls med disse URL-ene.
  app.get(
    `${ROOT}/decks/:id/asset-urls`,
    requireLeadMapPermission("pitch_deck.access", {
      pool, activeSessions, resolveOrgId: resolveDeckOrgId,
    }),
    async (req: Request, res: Response) => {
      try {
        const organizationId = await resolveDeckOrgId(req, pool, "");
        if (!organizationId) return res.status(404).json({ error: "deck_not_found" });
        const urls = await buildAssetUrlMap(pool, req.params.id, organizationId);
        return res.json({ urls });
      } catch (err) {
        return res.status(500).json({
          error: "build_urls_failed", detail: String(err),
        });
      }
    },
  );
}
