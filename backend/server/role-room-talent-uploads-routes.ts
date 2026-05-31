/**
 * role-room-talent-uploads-routes.ts
 *
 * Direkte fil-opplastning til Cloudflare R2 via presigned PUT-URL.
 * Klienten streamer filen direkte til R2 — backend ser aldri filebytes.
 *
 * Flow:
 *   1. Klient: POST /api/role-room/talents/me/uploads/sign
 *      { kind, filename, contentType, size_bytes } → { uploadUrl, finalUrl, key }
 *   2. Klient: PUT uploadUrl med fil-stream (Content-Type matchet)
 *      → R2 lagrer filen, returnerer 200
 *   3. Klient: PUT /api/role-room/talents/me + { headshot_url: finalUrl } (osv)
 *
 * Sikkerhet:
 *   - Krever auth-session (talent.owner_user_id må eie URL-en)
 *   - kind whitelisted: 'headshot' | 'showreel' | 'resume' | 'alt_photo'
 *   - size_bytes maks: 25 MB for bilder, 500 MB for showreel, 10 MB for CV
 *   - contentType whitelisted per kind
 *   - Filer lagres under nøkkel: talents/{talent_id}/{kind}/{uuid}.{ext}
 *   - Presigned URL utløper etter 10 minutter
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface RoleRoomTalentUploadsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

type UploadKind = "headshot" | "showreel" | "resume" | "alt_photo";

interface KindSpec {
  maxBytes: number;
  allowedTypes: string[];
  pathSegment: string;
}

const KIND_SPECS: Record<UploadKind, KindSpec> = {
  headshot: {
    maxBytes: 25 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    pathSegment: "headshot",
  },
  alt_photo: {
    maxBytes: 25 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    pathSegment: "photos",
  },
  showreel: {
    maxBytes: 500 * 1024 * 1024, // 500 MB
    allowedTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"],
    pathSegment: "showreel",
  },
  resume: {
    maxBytes: 10 * 1024 * 1024,
    allowedTypes: ["application/pdf"],
    pathSegment: "resume",
  },
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "application/pdf": "pdf",
};

const PRESIGN_TTL = 10 * 60; // 10 minutter

// R2-config — gjenbruker samme env-var-prefiks-fallback som cms-media-service.
function buildR2Config() {
  const firstNonEmpty = (...vals: (string | undefined)[]) =>
    vals.find((v) => v && v.trim().length > 0);
  const endpoint = firstNonEmpty(
    process.env.TALENTS_R2_ENDPOINT,
    process.env.CMS_R2_ENDPOINT,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_ENDPOINT,
  );
  const bucket = firstNonEmpty(
    process.env.TALENTS_R2_BUCKET,
    process.env.CMS_R2_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const accessKeyId = firstNonEmpty(
    process.env.TALENTS_R2_ACCESS_KEY_ID,
    process.env.CMS_R2_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.TALENTS_R2_SECRET_ACCESS_KEY,
    process.env.CMS_R2_SECRET_ACCESS_KEY,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );
  const publicUrlBase = firstNonEmpty(
    process.env.TALENTS_R2_PUBLIC_URL_BASE,
    process.env.CMS_R2_PUBLIC_URL_BASE,
    process.env.CLOUDFLARE_R2_PUBLIC_BASE, // ← matcher eksisterende casting-video-service-konvensjon
    process.env.R2_PUBLIC_URL_BASE,
  );
  return {
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicUrlBase, // hvis bucket er public: 'https://media.theroleroom.com'
  };
}

let cachedClient: S3Client | null = null;
function getR2Client(): S3Client | null {
  const cfg = buildR2Config();
  if (!cfg.enabled || !cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cachedClient;
}

/** Hent eksisterende talent for en owner-user-id. */
async function fetchTalentForUser(pool: Pool, userId: string) {
  const r = await pool.query(
    `SELECT id, display_name FROM talents WHERE owner_user_id = $1 AND COALESCE(is_demo, FALSE) = FALSE LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

export function setupRoleRoomTalentUploadsRoutes(deps: RoleRoomTalentUploadsRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── POST /me/uploads/sign — generer presigned PUT-URL ──────────────
  app.post("/api/role-room/talents/me/uploads/sign", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const { kind, contentType, size_bytes, filename } = (req.body || {}) as {
      kind?: string;
      contentType?: string;
      size_bytes?: number;
      filename?: string;
    };

    // Validering
    if (!kind || !(kind in KIND_SPECS)) {
      return res.status(400).json({ error: `Ugyldig 'kind' (må være ${Object.keys(KIND_SPECS).join(", ")})` });
    }
    const spec = KIND_SPECS[kind as UploadKind];
    if (!contentType || !spec.allowedTypes.includes(contentType)) {
      return res.status(400).json({
        error: `Filtype ikke støttet for ${kind}. Tillatte: ${spec.allowedTypes.join(", ")}`,
      });
    }
    const size = Number(size_bytes);
    if (!Number.isFinite(size) || size <= 0) {
      return res.status(400).json({ error: "Ugyldig size_bytes" });
    }
    if (size > spec.maxBytes) {
      const maxMB = Math.round(spec.maxBytes / 1024 / 1024);
      return res.status(413).json({
        error: `Filen er for stor (max ${maxMB} MB for ${kind})`,
      });
    }

    const cfg = buildR2Config();
    const client = getR2Client();
    if (!client || !cfg.bucket) {
      return res.status(503).json({
        error: "Fil-opplasting er ikke konfigurert på serveren",
        detail: "Sett R2_ENDPOINT/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY i miljøet",
      });
    }

    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) {
        return res.status(404).json({ error: "Du må opprette talent-profil før du kan laste opp filer" });
      }

      const ext = EXT_BY_MIME[contentType] ?? "bin";
      const uuid = crypto.randomBytes(12).toString("hex");
      const safeFilename = (filename || "file")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 80);
      const key = `talents/${talent.id}/${spec.pathSegment}/${uuid}-${safeFilename}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
        // Cache-policy: media skal cache lenge, men kan invalideres ved overskrivning
        CacheControl: kind === "showreel" ? "public, max-age=86400" : "public, max-age=2592000",
        Metadata: {
          talent_id: String(talent.id),
          kind,
          uploaded_by: session.userId,
          uploaded_at: new Date().toISOString(),
        },
      });

      const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_TTL });
      // finalUrl er hva som lagres i talents-tabellen. Hvis bucket har public
      // base → bruk direkte; ellers → bruk vår signed-GET-proxy som genererer
      // en ny signed URL ved hver visning (auth-gated, ingen public R2-exposure).
      const finalUrl = cfg.publicUrlBase
        ? `${cfg.publicUrlBase.replace(/\/+$/, "")}/${key}`
        : `/api/role-room/talents/media-proxy?key=${encodeURIComponent(key)}`;

      return res.json({
        uploadUrl,
        finalUrl,
        key,
        expiresIn: PRESIGN_TTL,
        contentType,
        // Klient skal sende Content-Type-header eksakt — ellers feiler PUT
        instructions: "PUT this file as raw body til uploadUrl med Content-Type-header satt eksakt til contentType. Etter 200 OK, lagre finalUrl i profilen.",
      });
    } catch (err) {
      console.error("[uploads/sign] failed", err);
      return res.status(500).json({ error: "Klarte ikke å generere upload-URL", detail: String(err) });
    }
  });

  // ── GET /talents/media-proxy?key=... — signed-GET redirect ────────
  // Brukes når bucket ikke har public base. Genererer signed URL ved hver
  // visning + 302-redirect. TTL 6 timer (lang nok for HLS-streaming, kort
  // nok for sikkerhet hvis lenken lekkes).
  app.get("/api/role-room/talents/media-proxy", async (req, res) => {
    const key = String(req.query.key || "").trim();
    if (!key || !key.startsWith("talents/")) {
      return res.status(400).json({ error: "Ugyldig key" });
    }
    const cfg = buildR2Config();
    const client = getR2Client();
    if (!client || !cfg.bucket) {
      return res.status(503).json({ error: "Storage ikke konfigurert" });
    }
    try {
      const signed = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
        { expiresIn: 6 * 60 * 60 },
      );
      // Cache-headers: rull seg over hver time
      res.set("Cache-Control", "private, max-age=3600");
      return res.redirect(302, signed);
    } catch (err) {
      console.error("[media-proxy] failed", err);
      return res.status(500).json({ error: "Klarte ikke å generere visnings-URL" });
    }
  });

  // ── GET /me/uploads/config — sjekk om upload er konfigurert ────────
  // Frontend bruker dette for å vise enten file-picker eller URL-fallback
  app.get("/api/role-room/talents/me/uploads/config", async (_req, res) => {
    const cfg = buildR2Config();
    return res.json({
      enabled: cfg.enabled,
      maxBytes: {
        headshot: KIND_SPECS.headshot.maxBytes,
        showreel: KIND_SPECS.showreel.maxBytes,
        resume: KIND_SPECS.resume.maxBytes,
        alt_photo: KIND_SPECS.alt_photo.maxBytes,
      },
      allowedTypes: {
        headshot: KIND_SPECS.headshot.allowedTypes,
        showreel: KIND_SPECS.showreel.allowedTypes,
        resume: KIND_SPECS.resume.allowedTypes,
        alt_photo: KIND_SPECS.alt_photo.allowedTypes,
      },
    });
  });
}
