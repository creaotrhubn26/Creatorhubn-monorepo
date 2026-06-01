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

// ── Cloudflare Stream-config — for showreel-uploads ─────────────────
function buildStreamConfig() {
  const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const apiToken = (process.env.CLOUDFLARE_STREAM_API_TOKEN || "").trim();
  const subdomain = (process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || "").trim();
  return {
    enabled: Boolean(accountId && apiToken && subdomain),
    accountId,
    apiToken,
    subdomain,
  };
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
  // KREVER AUTH + verifiserer eier ELLER aktiv consent.
  //
  // Auth-modell:
  //   - Talent som EIER filen (talents/{talent_id}/...) kan alltid se den
  //   - Partner-user med agency_org_id MÅ ha aktiv consent_registry-rad
  //     for (talent_id, partner_type=agency.type, partner_ref=agency.id)
  //     med scope som matcher kind (headshot/showreel etc → media_portfolio)
  //   - Alle andre: 403
  app.get("/api/role-room/talents/media-proxy", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const key = String(req.query.key || "").trim();
    if (!key || !key.startsWith("talents/")) {
      return res.status(400).json({ error: "Ugyldig key" });
    }

    // Trekk ut talent_id fra key: talents/{talent_id}/{kind}/{uuid}-...
    const m = key.match(/^talents\/([0-9a-f-]{36})\/([a-z_]+)\//);
    if (!m) return res.status(400).json({ error: "Ugyldig key-format" });
    const [, talentId, kindSegment] = m;

    try {
      // Sjekk 1: er session-user eieren av denne talent-profilen?
      const ownerCheck = await pool.query(
        `SELECT 1 FROM talents WHERE id = $1 AND owner_user_id = $2 LIMIT 1`,
        [talentId, session.userId],
      );
      let allowed = ownerCheck.rowCount > 0;

      // Sjekk 2: er session-user member av en agency med aktiv consent?
      if (!allowed) {
        // Map upload-kind → påkrevd consent scope
        const kindToScope: Record<string, string[]> = {
          headshot: ["media_portfolio", "full_profile"],
          alt_photo: ["media_portfolio", "full_profile"],
          showreel: ["self_tape_review", "media_portfolio", "full_profile"],
          resume: ["media_portfolio", "contact_info", "full_profile"],
          photos: ["media_portfolio", "full_profile"],
        };
        const requiredScopes = kindToScope[kindSegment] || ["full_profile"];

        const accessCheck = await pool.query(
          `SELECT 1
             FROM users u
             JOIN agency_orgs a ON a.id = u.agency_org_id
             JOIN talent_consent_registry c
               ON c.partner_type = a.type
              AND c.partner_ref = a.id::text
              AND c.talent_id = $1
              AND c.status = 'granted'
              AND (c.expires_at IS NULL OR c.expires_at > now())
              AND c.scope = ANY($3::text[])
            WHERE u.id = $2
            LIMIT 1`,
          [talentId, session.userId, requiredScopes],
        );
        allowed = accessCheck.rowCount > 0;
      }

      if (!allowed) {
        return res.status(403).json({ error: "Du har ikke tilgang til denne filen" });
      }

      const cfg = buildR2Config();
      const client = getR2Client();
      if (!client || !cfg.bucket) {
        return res.status(503).json({ error: "Storage ikke konfigurert" });
      }
      const signed = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
        { expiresIn: 6 * 60 * 60 },
      );

      // Audit-log: hvis partner-user ser filen, log det
      if (!ownerCheck.rowCount) {
        try {
          await pool.query(
            `INSERT INTO talent_access_audit (talent_id, partner_type, partner_ref, scope, accessed_by, access_context)
             SELECT $1, a.type, a.id::text, $3, $2, $4::jsonb
               FROM agency_orgs a JOIN users u ON u.agency_org_id = a.id
              WHERE u.id = $2 LIMIT 1`,
            [
              talentId,
              session.userId,
              kindSegment,
              JSON.stringify({ endpoint: "/media-proxy", key }),
            ],
          );
        } catch (auditErr) {
          console.warn("[media-proxy audit] failed", auditErr);
        }
      }

      res.set("Cache-Control", "private, max-age=1800");
      return res.redirect(302, signed);
    } catch (err) {
      console.error("[media-proxy] failed", err);
      return res.status(500).json({ error: "Klarte ikke å generere visnings-URL" });
    }
  });

  // ── POST /me/uploads/sign-stream — Cloudflare Stream Direct Upload ─
  // Bytter R2 for showreel: bedre kvalitet via Stream's adaptive bitrate,
  // auto-transcoding, innebygd player, thumbnails. Frontend POSTer
  // direkte til Stream's uploadURL (motstandsdyktig mot avbrudd via TUS).
  app.post("/api/role-room/talents/me/uploads/sign-stream", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const streamCfg = buildStreamConfig();
    if (!streamCfg.enabled) {
      return res.status(503).json({
        error: "Cloudflare Stream ikke konfigurert",
        detail: "Sett CLOUDFLARE_R2_ACCOUNT_ID + CLOUDFLARE_STREAM_API_TOKEN + CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN",
      });
    }

    const { maxDurationSeconds = 7200, allowedOrigins } = (req.body || {}) as {
      maxDurationSeconds?: number;
      allowedOrigins?: string[];
    };

    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) {
        return res.status(404).json({ error: "Opprett talent-profil først" });
      }

      // Direct Creator Upload — Stream genererer en one-shot upload-URL
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 time
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${streamCfg.accountId}/stream/direct_upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${streamCfg.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            maxDurationSeconds: Math.min(Math.max(maxDurationSeconds, 60), 21600), // 1 min – 6 timer
            expiry,
            requireSignedURLs: false, // public playback — partnere kan se uten signing
            creator: String(session.userId),
            meta: {
              talent_id: String(talent.id),
              uploaded_by: String(session.userId),
              kind: "showreel",
            },
            allowedOrigins: allowedOrigins ?? [
              "theroleroom.com",
              "www.theroleroom.com",
              "creatorhubn.com",
              "localhost:5173",
            ],
          }),
        },
      );

      const cfPayload = await cfRes.json().catch(() => null) as {
        success?: boolean;
        errors?: Array<{ message?: string }>;
        result?: { uploadURL?: string; uid?: string };
      } | null;

      if (!cfRes.ok || !cfPayload?.success || !cfPayload.result?.uploadURL || !cfPayload.result?.uid) {
        const errMsg = cfPayload?.errors?.[0]?.message || `Cloudflare HTTP ${cfRes.status}`;
        console.error("[uploads/sign-stream] CF feilet:", errMsg, cfPayload);
        return res.status(502).json({ error: "Cloudflare Stream feil", detail: errMsg });
      }

      const uid = cfPayload.result.uid;
      const subdomain = streamCfg.subdomain;
      const playbackBase = `https://customer-${subdomain}.cloudflarestream.com/${uid}`;
      const iframeUrl = `${playbackBase}/iframe`;
      const hlsUrl = `${playbackBase}/manifest/video.m3u8`;
      const thumbnailUrl = `${playbackBase}/thumbnails/thumbnail.jpg`;

      // Spor upload-progress i talent_stream_uploads for å vise
      // "Transkodes…" → "Klar!" via webhook-oppdateringer.
      try {
        await pool.query(
          `INSERT INTO talent_stream_uploads
             (talent_id, uid, status, iframe_url, thumbnail_url, hls_manifest_url)
           VALUES ($1, $2, 'uploading', $3, $4, $5)
           ON CONFLICT (uid) DO NOTHING`,
          [talent.id, uid, iframeUrl, thumbnailUrl, hlsUrl],
        );
      } catch (e) {
        console.warn("[sign-stream] tracker insert failed:", e);
      }

      return res.json({
        uploadUrl: cfPayload.result.uploadURL,
        uid,
        finalUrl: iframeUrl,
        hlsManifestUrl: hlsUrl,
        dashManifestUrl: `${playbackBase}/manifest/video.mpd`,
        thumbnailUrl,
        previewMp4Url: `${playbackBase}/downloads/default.mp4`,
        expiresAt: expiry,
      });
    } catch (err) {
      console.error("[uploads/sign-stream] failed", err);
      return res.status(500).json({ error: "Klarte ikke å initiere video-opplastning", detail: String(err) });
    }
  });

  // ── GET /me/showreel-status — frontend poller mens video transkodes
  app.get("/api/role-room/talents/me/showreel-status/:uid", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { uid } = req.params;
    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.status(404).json({ error: "Ingen profil" });
      const r = await pool.query(
        `SELECT uid, status, iframe_url, thumbnail_url, hls_manifest_url,
                duration_seconds, width, height, ready_at, error_message,
                created_at, updated_at
           FROM talent_stream_uploads
          WHERE uid = $1 AND talent_id = $2 LIMIT 1`,
        [uid, talent.id],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Video ikke funnet" });
      return res.json({ upload: r.rows[0] });
    } catch (err) {
      console.error("[showreel-status] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente status" });
    }
  });

  // ── POST /webhooks/cloudflare-stream — Cloudflare Stream sender events
  // Webhook-signering: Cloudflare bruker SIG-header med HMAC-SHA256 av
  // body med shared secret. Sett CLOUDFLARE_STREAM_WEBHOOK_SECRET på Render.
  // Hvis ikke satt, aksepteres webhook uten validering (kun for dev).
  app.post("/api/role-room/webhooks/cloudflare-stream", async (req, res) => {
    const secret = (process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET || "").trim();
    // KRITISK: hvis secret ikke satt, REFUSER alle webhooks (ingen insecure default)
    if (!secret) {
      console.error("[webhook] CLOUDFLARE_STREAM_WEBHOOK_SECRET ikke satt — alle webhooks avslås");
      return res.status(503).json({ error: "Webhook ikke konfigurert" });
    }
    const sig = req.header("webhook-signature") || "";
    // Format: 'time=1234567890,sig1=abcdef...' (HMAC-SHA256 av timestamp.body)
    const match = sig.match(/time=(\d+),sig1=([a-f0-9]+)/i);
    if (!match) {
      return res.status(401).json({ error: "Mangler/ugyldig signatur" });
    }
    const [, timestamp, providedSig] = match;
    // Reject replays > 5 min gamle (anti-replay)
    const ageMs = Date.now() - Number(timestamp) * 1000;
    if (Math.abs(ageMs) > 5 * 60 * 1000) {
      return res.status(401).json({ error: "Signatur for gammel (anti-replay)" });
    }
    const rawBody = JSON.stringify(req.body);
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    // Constant-time-compare for å unngå timing-attack
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(providedSig, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "Signatur matcher ikke" });
    }

    const event = req.body as {
      uid?: string;
      status?: { state?: string; errorReasonCode?: string; errorReasonText?: string };
      readyToStream?: boolean;
      duration?: number;
      input?: { width?: number; height?: number };
      size?: number;
      thumbnail?: string;
      preview?: string;
      meta?: Record<string, unknown>;
    };

    if (!event?.uid) {
      return res.status(400).json({ error: "Mangler uid" });
    }

    try {
      const state = event.status?.state || (event.readyToStream ? "ready" : "uploading");
      const isReady = state === "ready";
      const isError = state === "error";

      await pool.query(
        `UPDATE talent_stream_uploads
            SET status = $2,
                ready_at = CASE WHEN $3 THEN now() ELSE ready_at END,
                error_message = $4,
                duration_seconds = COALESCE($5, duration_seconds),
                size_bytes = COALESCE($6, size_bytes),
                width = COALESCE($7, width),
                height = COALESCE($8, height),
                raw_event = $9::jsonb,
                updated_at = now()
          WHERE uid = $1`,
        [
          event.uid,
          state,
          isReady,
          isError ? (event.status?.errorReasonText || event.status?.errorReasonCode || "ukjent feil") : null,
          event.duration ?? null,
          event.size ?? null,
          event.input?.width ?? null,
          event.input?.height ?? null,
          JSON.stringify(event),
        ],
      );
      return res.json({ ok: true, uid: event.uid, state });
    } catch (err) {
      console.error("[webhooks/cloudflare-stream] failed", err);
      return res.status(500).json({ error: "Webhook-prosessering feilet" });
    }
  });

  // ── GET /me/uploads/config — sjekk om upload er konfigurert ────────
  // Frontend bruker dette for å vise enten file-picker eller URL-fallback
  app.get("/api/role-room/talents/me/uploads/config", async (_req, res) => {
    const cfg = buildR2Config();
    const streamCfg = buildStreamConfig();
    return res.json({
      enabled: cfg.enabled,
      streamEnabled: streamCfg.enabled,
      streamSubdomain: streamCfg.subdomain || null,
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
