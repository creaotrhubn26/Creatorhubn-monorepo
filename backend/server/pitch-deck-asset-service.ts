/**
 * pitch-deck-asset-service.ts
 *
 * Mockup-/logo-/icon-uploads for Pitch Deck Studio. Alle uploads
 * scopes per organisasjon i B2-bucket'en (the-role-room-prod) for å
 * holde lagringen ryddig + sikre cross-org-isolasjon:
 *
 *   pitch-decks/{org_id}/{deck_id}/{slide_id}/{uuid}.{ext}
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
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

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

// ─────────────────────────────────────────────────────────────────
// Public: bygg signed URLs for alle assets i et deck
// Kalles av iPad-Studio etter load slik at AsyncImage får fresh
// URL'er hver gang.
// ─────────────────────────────────────────────────────────────────

export async function buildAssetUrlMap(
  pool: Pool, deckId: string,
): Promise<Record<string, string>> {
  const b2 = getB2();
  if (!b2) return {};
  const r = await pool.query<{ id: string; b2_key: string }>(
    `SELECT id::text, b2_key FROM pitch_deck_assets WHERE deck_id = $1`,
    [deckId],
  );
  const out: Record<string, string> = {};
  for (const row of r.rows) {
    try {
      const url = await getSignedUrl(
        b2.client,
        new GetObjectCommand({ Bucket: b2.bucket, Key: row.b2_key }),
        { expiresIn: SIGNED_URL_TTL_SEC },
      );
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
    requireLeadMapPermission("pitch_deck.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const b2 = getB2();
      if (!b2) {
        return res.status(503).json({ error: "b2_ikke_konfigurert" });
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
      // base64-decode + size-sjekk
      let buf: Buffer;
      try {
        buf = Buffer.from(body.data_base64, "base64");
      } catch {
        return res.status(400).json({ error: "ugyldig_base64" });
      }
      if (buf.byteLength === 0) {
        return res.status(400).json({ error: "tom_payload" });
      }
      if (buf.byteLength > MAX_UPLOAD_BYTES) {
        return res.status(413).json({
          error: "payload_for_stor",
          max_bytes: MAX_UPLOAD_BYTES,
        });
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

      const ext = MIME_TO_EXT[mime];
      const assetUuid = crypto.randomUUID();
      // Org-scoped key — gir ryddig struktur + cross-org-isolasjon
      const b2Key =
        `pitch-decks/${slideOrg.org_id}/${slideOrg.deck_id}` +
        `/${slideOrg.slide_id}/${assetUuid}.${ext}`;

      try {
        await b2.client.send(new PutObjectCommand({
          Bucket: b2.bucket,
          Key: b2Key,
          Body: buf,
          ContentType: mime,
          // Ikke offentlig — alltid signed URL on-demand
          ACL: undefined,
        }));
      } catch (err) {
        return res.status(502).json({
          error: "b2_upload_failed",
          detail: String(err),
        });
      }

      // Lagre asset-rad
      const assetRes = await pool.query<{ id: string }>(
        `INSERT INTO pitch_deck_assets
           (deck_id, slide_id, asset_type, b2_key, mime_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id::text`,
        [
          slideOrg.deck_id, slideOrg.slide_id, assetType,
          b2Key, mime, session.userId,
        ],
      );
      const assetId = assetRes.rows[0].id;

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
        signedUrl = await getSignedUrl(
          b2.client,
          new GetObjectCommand({ Bucket: b2.bucket, Key: b2Key }),
          { expiresIn: SIGNED_URL_TTL_SEC },
        );
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
    requireLeadMapPermission("pitch_deck.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const b2 = getB2();
      if (!b2) return res.status(503).json({ error: "b2_ikke_konfigurert" });
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      // Hent asset + verifiser org-match
      const assetRes = await pool.query<{
        deck_id: string; slide_id: string; b2_key: string; org_id: string;
      }>(
        `SELECT a.deck_id::text, a.slide_id::text, a.b2_key,
                d.org_id::text
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

      // Slett B2-objekt (best-effort — DB-raden er sannheten)
      try {
        await b2.client.send(new DeleteObjectCommand({
          Bucket: b2.bucket,
          Key: asset.b2_key,
        }));
      } catch { /* tystefall — vi sletter raden likevel */ }

      // Slett asset-rad
      await pool.query(
        `DELETE FROM pitch_deck_assets WHERE id = $1`,
        [req.params.asset_id],
      );

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
    requireLeadMapPermission("pitch_deck.access", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const urls = await buildAssetUrlMap(pool, req.params.id);
        return res.json({ urls });
      } catch (err) {
        return res.status(500).json({
          error: "build_urls_failed", detail: String(err),
        });
      }
    },
  );
}
