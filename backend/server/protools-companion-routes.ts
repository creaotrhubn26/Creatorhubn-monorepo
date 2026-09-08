/**
 * protools-companion-routes.ts — Pro Tools Companion (native desktop-agent) + EaseVerse-kobling
 *
 * Den native Tauri-companionen (apps/creatorhub-protools-companion) kjører ved
 * siden av Pro Tools på produsentens maskin, overvåker «Export Session Info as
 * Text»-eksporter (markører + metadata) og «Bounced Files»-mappen (ferdige WAV),
 * og pusher dette inn i CreatorHub via disse endepunktene. Når companion-sesjonen
 * er koblet til en EaseVerse-track / Sound Room (audio_review_project):
 *   - markører  → audio_review_sections på gjeldende review-versjon
 *   - bounce    → ny audio_review_versjon (review starter automatisk)
 *   - playhead  → lagres for live-visning i Sound Room-panelet (best-effort)
 *
 * NB: De gamle `protools_*`-tabellene har dobbel skjema-drift (id:uuid+id:varchar,
 * sessionid+session_id) fra motstridende migrasjoner og er ikke brukbare. Vi bruker
 * derfor rene, dedikerte `protools_companion_*`-tabeller. Companion-auth gjenbruker
 * `desktop_device_tokens` (samme som One Desk) via en kort paringskode.
 *
 * Endepunkter:
 *   Web (requireUserSession):
 *     POST /api/protools/pair/start                  → 6-sifret paringskode
 *     GET  /api/protools/web/status?audioRoomId=     → companion-status for Sound Room-panelet
 *     POST /api/protools/web/unlink-device           → revoker companion-device
 *   Companion (Bearer device-token):
 *     POST /api/protools/pair/claim   { code }       → bytter kode mot device-token
 *     GET  /api/protools/me                          → bruker + koblingsbare Sound Rooms
 *     GET  /api/protools/sessions                    → companion-sesjoner
 *     POST /api/protools/sessions     { ... }        → opprett/koble sesjon
 *     POST /api/protools/sessions/:id/markers        → markører (→ review-seksjoner)
 *     POST /api/protools/sessions/:id/metadata       → tempo/key/spor
 *     POST /api/protools/sessions/:id/playhead       → playhead (best-effort)
 *     POST /api/protools/sessions/:id/bounce/presign → presignert opplastings-URL
 *     POST /api/protools/sessions/:id/bounce/complete→ registrer bounce → review-versjon
 */



import type express from "express";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  type EaseVerseProToolsMarker,
  type EaseVerseProToolsSyncResult,
} from "./easeverse-protools-sync.js";
import {
  claimPairingCode,
  createPairingCode,
  databaseRateLimited,
  enqueueEaseVerseSync,
  ensureProToolsCompanionSchema,
  retryEaseVerseSync,
} from "./protools-companion-persistence.js";
import { broadcastSoundRoomUpdated } from "./sound-room-events.js";

export interface ProToolsCompanionDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (
    req: any,
    res: any,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// ─────────────────────────── R2/B2 presign (samme mønster som coverage-take-service) ──
interface R2Config { endpoint: string; bucket: string; region: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl: string | null; }
const UPLOAD_URL_TTL_SEC = 3600;
function getR2Config(): R2Config | null {
  const endpoint = process.env.CAPTURE_R2_ENDPOINT ?? process.env.CLOUDFLARE_R2_ENDPOINT ?? process.env.R2_ENDPOINT;
  const bucket = process.env.CASTING_R2_BUCKET ?? process.env.CAPTURE_R2_BUCKET ?? process.env.CLOUDFLARE_R2_BUCKET ?? process.env.R2_BUCKET;
  const accessKeyId = process.env.CAPTURE_R2_ACCESS_KEY_ID ?? process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CAPTURE_R2_SECRET_ACCESS_KEY ?? process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint, bucket, region: process.env.R2_REGION ?? "auto", accessKeyId, secretAccessKey,
    publicBaseUrl: process.env.CASTING_R2_PUBLIC_BASE ?? process.env.CLOUDFLARE_R2_PUBLIC_BASE ?? null,
  };
}
let _r2: { client: S3Client; cfg: R2Config } | null | undefined;
function getR2(): { client: S3Client; cfg: R2Config } | null {
  if (_r2 !== undefined) return _r2;
  const cfg = getR2Config();
  if (!cfg) { _r2 = null; return null; }
  _r2 = { client: new S3Client({ region: cfg.region, endpoint: cfg.endpoint, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } }), cfg };
  return _r2;
}
function sanitizeName(v: string): string { return String(v || "bounce").replace(/[^A-Za-z0-9.\-_]/g, "_").slice(0, 120); }

function isUuid(v: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
// ─────────────────────────── Hjelpere ────────────────────────────────────────────────
function hashToken(t: string): string { return crypto.createHash("sha256").update(t).digest("hex"); }
const DEVICE_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;
function _pairClientIp(req: any): string {
  return (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket?.remoteAddress ?? "?";
}

let schemaReady: Promise<void> | null = null;
async function ensureSchema(pool: any): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = ensureProToolsCompanionSchema(pool).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export function setupProToolsCompanionRoutes(deps: ProToolsCompanionDeps): void {
  const { app, pool, requireUserSession } = deps;
  void ensureSchema(pool).catch((error) => console.error("[protools-companion] schema init:", error));

  // ── Companion device-auth (Bearer trr_desk_…) ────────────────────────────────────
  async function deviceAuth(req: any, res: any): Promise<{ userId: string; email: string; deviceId: string } | null> {
    try { await ensureSchema(pool); }
    catch (error) {
      console.error("[protools-companion] schema unavailable:", error);
      res.status(503).json({ error: "companion_schema_unavailable" });
      return null;
    }
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "device_token_required" }); return null; }
    const token = auth.slice(7).trim();
    if (!token || token.length > 200) { res.status(401).json({ error: "invalid_token" }); return null; }
    const r = await pool.query(
      `SELECT id, user_id, user_email FROM desktop_device_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() LIMIT 1`,
      [hashToken(token)],
    ).catch(() => ({ rows: [] as any[] }));
    if (!r.rows.length) { res.status(401).json({ error: "token_expired_or_revoked" }); return null; }
    pool.query(`UPDATE desktop_device_tokens SET last_used_at = now() WHERE token_hash = $1`, [hashToken(token)]).catch(() => {});
    return { userId: r.rows[0].user_id, email: r.rows[0].user_email, deviceId: r.rows[0].id };
  }

  // Sesjon eid av companion-bruker (eller 404)
  async function ownedSession(uid: string, sessionId: string): Promise<any | null> {
    const r = await pool.query(
      `SELECT s.*, COALESCE(ar.external_track_id, s.easeverse_track_id) AS easeverse_external_track_id,
              COALESCE(s.tempo, t.bpm) AS easeverse_bpm
         FROM protools_companion_sessions s
         LEFT JOIN audio_review_projects ar ON ar.id = s.audio_review_project_id
         LEFT JOIN easeverse_tracks t ON t.id::text = s.easeverse_track_id AND t.user_id = s.user_id
        WHERE s.id = $1::uuid AND s.user_id = $2 LIMIT 1`,
      [sessionId, uid],
    ).catch(() => ({ rows: [] }));
    return r.rows[0] || null;
  }

  async function mirrorSessionToEaseVerse(
    sess: any,
    markers?: EaseVerseProToolsMarker[],
    bpm?: number | null,
    eventType = "snapshot",
    eventId?: string | null,
  ): Promise<EaseVerseProToolsSyncResult & { eventId?: string; revision?: number; queued?: boolean }> {
    if (!sess.easeverse_track_id) {
      return { configured: false, synced: false, reason: "track_not_linked" };
    }
    let snapshot = markers;
    if (!snapshot) {
      const rows = await pool.query(
        `SELECT name, start_seconds, end_seconds, timecode, color
           FROM protools_companion_markers
          WHERE session_id = $1::uuid ORDER BY order_index ASC, start_seconds ASC`,
        [sess.id],
      ).catch(() => ({ rows: [] }));
      snapshot = rows.rows.map((row: any) => ({
        name: String(row.name || "Markør"),
        startSeconds: Number(row.start_seconds) || 0,
        ...(Number.isFinite(Number(row.end_seconds)) ? { endSeconds: Number(row.end_seconds) } : {}),
        ...(row.timecode ? { timecode: String(row.timecode) } : {}),
        ...(row.color ? { color: String(row.color) } : {}),
      }));
    }
    return enqueueEaseVerseSync({
      pool,
      sessionId: String(sess.id),
      userId: String(sess.user_id),
      eventType,
      eventId: eventId || undefined,
      payload: {
        externalTrackId: String(sess.easeverse_external_track_id || sess.easeverse_track_id),
        workspaceProjectId: strOrNull(sess.workspace_project_id, 160) || undefined,
        audioReviewProjectId: sess.audio_review_project_id ? String(sess.audio_review_project_id) : undefined,
        easeverseProjectId: strOrNull(sess.easeverse_project_id, 160) || undefined,
        bpm: bpm ?? numOrNull(sess.easeverse_bpm) ?? numOrNull(sess.tempo) ?? undefined,
        keySignature: strOrNull(sess.key_signature, 24) || undefined,
        timeSignature: strOrNull(sess.time_signature, 12) || undefined,
        markers: snapshot ?? [],
      },
    });
  }

  // Finn-eller-opprett audio_review_project for en EaseVerse-track (speiler link-easeverse).
  async function resolveReviewForTrack(uid: string, trackId: string): Promise<string | null> {
    const tr = await pool.query(`SELECT id, title, artist, genre, bpm, musical_key FROM easeverse_tracks WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [trackId, uid]).catch(() => ({ rows: [] }));
    const track = tr.rows[0];
    if (!track) return null;
    const exist = await pool.query(`SELECT id FROM audio_review_projects WHERE easeverse_track_id = $1 AND owner_user_id = $2 AND status <> 'archived' ORDER BY created_at DESC LIMIT 1`, [trackId, uid]).catch(() => ({ rows: [] }));
    if (exist.rows.length) return exist.rows[0].id;
    const ins = await pool.query(
      `INSERT INTO audio_review_projects (owner_user_id, title, artist_name, genre, bpm, musical_key, status, easeverse_track_id, external_track_id)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$7) RETURNING id`,
      [uid, track.title || "EaseVerse-låt", track.artist || null, track.genre || null, track.bpm || null, track.musical_key || null, trackId],
    ).catch(() => ({ rows: [] }));
    return ins.rows[0]?.id || null;
  }

  // Gjeldende review-versjon (under_review eller siste) for et review-prosjekt.
  async function currentVersionId(reviewId: string, db: any = pool): Promise<string | null> {
    const r = await db.query(
      `SELECT id FROM audio_review_versions WHERE project_id = $1::uuid
        ORDER BY (status='under_review') DESC, version_number DESC LIMIT 1`, [reviewId],
    ).catch(() => ({ rows: [] }));
    return r.rows[0]?.id || null;
  }

  // Speil session-markører til audio_review_sections på en gitt versjon (full erstatt).
  async function syncMarkersToVersion(sessionId: string, versionId: string, db: any = pool): Promise<number> {
    const m = await db.query(`SELECT name, start_seconds, end_seconds, color, order_index FROM protools_companion_markers WHERE session_id = $1::uuid ORDER BY order_index ASC, start_seconds ASC`, [sessionId]);
    await db.query(`DELETE FROM audio_review_sections WHERE version_id = $1::uuid`, [versionId]);
    let n = 0;
    for (const row of m.rows) {
      const end = row.end_seconds ?? (Number(row.start_seconds) + 0.001);
      await db.query(
        `INSERT INTO audio_review_sections (version_id, name, start_time_seconds, end_time_seconds, color, order_index)
         VALUES ($1::uuid,$2,$3,$4,$5,$6)`,
        [versionId, row.name || `Markør ${n + 1}`, Number(row.start_seconds) || 0, Number(end), row.color || null, row.order_index ?? n],
      ); n++;
    }
    return n;
  }

  // ════════════════════════ NEDLASTING (release-info) ═════════════════════════════

  // Auto-oppdager companion-installerene fra GitHub-release-en `protools-companion-v*`.
  // Klassifiserer assets på filnavn (mac arm/intel .dmg, Windows .msi/.exe). Nye
  // plattformer (Windows) dukker opp automatisk når CI har bygget dem. 5 min cache.
  const REPO_SLUG = "creaotrhubn26/Creatorhubn-monorepo";
  const MAC_ARM_FALLBACK = "https://github.com/creaotrhubn26/Creatorhubn-monorepo/releases/download/protools-companion-v0.1.0/CreatorHub-ProTools-Companion_0.1.0_aarch64.dmg";
  let releaseCache: { at: number; data: any } | null = null;

  function classifyAsset(name: string): { os: string; arch: string } | null {
    const n = name.toLowerCase();
    if (n.endsWith(".dmg")) {
      if (n.includes("aarch64") || n.includes("arm64")) return { os: "macOS", arch: "Apple Silicon" };
      if (n.includes("x64") || n.includes("x86_64") || n.includes("intel")) return { os: "macOS", arch: "Intel" };
      return { os: "macOS", arch: "Universal" };
    }
    if (n.endsWith(".msi") || n.endsWith("-setup.exe") || n.endsWith(".exe")) return { os: "Windows", arch: "x64" };
    return null;
  }

  async function resolveCompanionRelease(): Promise<any> {
    if (releaseCache && Date.now() - releaseCache.at < 5 * 60 * 1000) return releaseCache.data;
    const data: any = { version: "0.1.0", downloads: [] };
    try {
      const resp = await fetch(`https://api.github.com/repos/${REPO_SLUG}/releases?per_page=30`, {
        headers: { "User-Agent": "creatorhub-protools", Accept: "application/vnd.github+json" },
      });
      if (resp.ok) {
        const rels: any[] = await resp.json();
        const rel = rels.find((r) => String(r.tag_name || "").startsWith("protools-companion-") && !r.draft);
        if (rel) {
          data.version = String(rel.tag_name).replace("protools-companion-v", "");
          for (const a of rel.assets || []) {
            const c = classifyAsset(String(a.name || ""));
            if (!c) continue;
            data.downloads.push({ os: c.os, arch: c.arch, url: a.browser_download_url, sizeBytes: a.size, signed: false });
          }
        }
      }
    } catch { /* faller til fallback under */ }
    if (!data.downloads.length) data.downloads.push({ os: "macOS", arch: "Apple Silicon", url: MAC_ARM_FALLBACK, sizeBytes: 4867544, signed: false });
    releaseCache = { at: Date.now(), data };
    return data;
  }

  // GET /api/protools/companion/release — versjon, ikon, og nedlastinger pr plattform.
  app.get("/api/protools/companion/release", async (_req, res) => {
    const r = await resolveCompanionRelease();
    res.json({ ...r, icon: "/protools-companion-icon.png" });
  });

  // ════════════════════════ PARING ════════════════════════════════════════════════

  // POST /api/protools/pair/start — web (innlogget) genererer en kort paringskode.
  app.post("/api/protools/pair/start", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      await ensureSchema(pool);
      const workspaceProjectId = strOrNull(req.body?.workspaceProjectId, 160);
      const audioReviewProjectId = strOrNull(req.body?.audioRoomId, 160);
      const easeverseTrackId = strOrNull(req.body?.easeverseTrackId, 160);
      const projectName = strOrNull(req.body?.projectName, 200);
      if (workspaceProjectId) {
        const owns = await pool.query(
          `SELECT 1 FROM projects WHERE id::text=$1 AND user_id=$2 LIMIT 1`,
          [workspaceProjectId, s.userId],
        );
        if (!owns.rows.length) return res.status(403).json({ error: "workspace_project_not_accessible" });
      }
      if (audioReviewProjectId) {
        if (!isUuid(audioReviewProjectId)) return res.status(400).json({ error: "invalid_audio_room_id" });
        const owns = await pool.query(
          `SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`,
          [audioReviewProjectId, s.userId],
        );
        if (!owns.rows.length) return res.status(403).json({ error: "audio_room_not_accessible" });
      }
      if (easeverseTrackId) {
        if (!isUuid(easeverseTrackId)) return res.status(400).json({ error: "invalid_easeverse_track_id" });
        const owns = await pool.query(
          `SELECT 1 FROM easeverse_tracks WHERE id=$1::uuid AND user_id=$2 LIMIT 1`,
          [easeverseTrackId, s.userId],
        );
        if (!owns.rows.length) return res.status(403).json({ error: "easeverse_track_not_accessible" });
      }
      const pairing = await createPairingCode(pool, s, {
        workspaceProjectId: workspaceProjectId || undefined,
        audioReviewProjectId: audioReviewProjectId || undefined,
        easeverseTrackId: easeverseTrackId || undefined,
        projectName: projectName || undefined,
      });
      res.json(pairing);
    } catch (error) {
      console.error("[protools-companion] pair start:", error);
      res.status(503).json({ error: "pairing_unavailable" });
    }
  });

  // POST /api/protools/pair/claim — companion bytter koden mot et device-token.
  app.post("/api/protools/pair/claim", async (req, res) => {
    try {
      await ensureSchema(pool);
      if (await databaseRateLimited(pool, "pair-claim", _pairClientIp(req), 10)) {
        return res.status(429).json({ error: "too_many_requests" });
      }
      const code = String(req.body?.code || "").trim();
      if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "invalid_code" });
      const entry = await claimPairingCode(pool, code);
      if (!entry) return res.status(404).json({ error: "code_not_found_or_expired" });
      const rawToken = `trr_desk_${crypto.randomBytes(32).toString("hex")}`;
      const expiresAt = new Date(Date.now() + DEVICE_TOKEN_TTL_MS);
      const deviceId = `ptc_${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO desktop_device_tokens (id, user_id, user_email, token_hash, label, expires_at)
         VALUES ($1,$2,$3,$4,'Pro Tools Companion',$5)`,
        [deviceId, entry.userId, entry.email, hashToken(rawToken), expiresAt],
      );
      res.json({
        token: rawToken,
        deviceId,
        user: { id: entry.userId, email: entry.email, name: entry.name },
        context: entry.context,
        apiBase: resolveApiBase(req),
      });
    } catch (error) {
      console.error("[protools-companion] pair claim:", error);
      res.status(503).json({ error: "pairing_unavailable" });
    }
  });

  function resolveApiBase(req: any): string {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
    return `${proto}://${host}`;
  }

  // ════════════════════════ COMPANION (device-token) ═══════════════════════════════

  // GET /api/protools/me — bruker + koblingsbare Sound Rooms (EaseVerse-tracks).
  app.get("/api/protools/me", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const tracks = await pool.query(
      `SELECT t.id, t.title, t.artist, t.status, t.bpm, t.musical_key,
              (SELECT ar.id FROM audio_review_projects ar WHERE ar.easeverse_track_id = t.id::text AND ar.owner_user_id = $1 AND ar.status <> 'archived' ORDER BY ar.created_at DESC LIMIT 1) AS review_id
         FROM easeverse_tracks t WHERE t.user_id = $1 ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC LIMIT 100`,
      [d.userId],
    ).catch(() => ({ rows: [] }));
    res.json({ user: { id: d.userId, email: d.email }, tracks: tracks.rows });
  });

  // GET /api/protools/sessions — companion-sesjoner + koblet review-tittel.
  app.get("/api/protools/sessions", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const r = await pool.query(
      `SELECT s.*, ar.title AS review_title, ar.status AS review_status,
              (SELECT count(*) FROM protools_companion_markers m WHERE m.session_id = s.id) AS marker_count,
              (SELECT count(*) FROM protools_companion_bounces b WHERE b.session_id = s.id) AS bounce_count
         FROM protools_companion_sessions s
         LEFT JOIN audio_review_projects ar ON ar.id = s.audio_review_project_id
        WHERE s.user_id = $1 ORDER BY s.last_activity DESC LIMIT 50`,
      [d.userId],
    ).catch(() => ({ rows: [] }));
    res.json({ sessions: r.rows });
  });

  // POST /api/protools/sessions — opprett/koble en companion-sesjon.
  // body: { name, sessionType?, easeverseTrackId?, audioRoomId?, ptxPath?, bounceDir?, sampleRate?, bitDepth?, sessionFormat? }
  app.post("/api/protools/sessions", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const name = String(req.body?.name || "").trim().slice(0, 200);
    if (!name) return res.status(400).json({ error: "name_required" });
    const workspaceProjectId = strOrNull(req.body?.workspaceProjectId, 160);
    const audioRoomId = strOrNull(req.body?.audioRoomId, 160);
    const trackId = strOrNull(req.body?.easeverseTrackId, 160);
    const easeverseProjectId = strOrNull(req.body?.easeverseProjectId, 160);
    try {
      if (workspaceProjectId) {
        const owns = await pool.query(`SELECT 1 FROM projects WHERE id::text=$1 AND user_id=$2 LIMIT 1`, [workspaceProjectId, d.userId]);
        if (!owns.rows.length) return res.status(403).json({ error: "workspace_project_not_accessible" });
      }
      if (trackId) {
        if (!isUuid(trackId)) return res.status(400).json({ error: "invalid_easeverse_track_id" });
        const owns = await pool.query(`SELECT 1 FROM easeverse_tracks WHERE id=$1::uuid AND user_id=$2 LIMIT 1`, [trackId, d.userId]);
        if (!owns.rows.length) return res.status(403).json({ error: "easeverse_track_not_accessible" });
      }
      let reviewId: string | null = null;
      if (audioRoomId) {
        if (!isUuid(audioRoomId)) return res.status(400).json({ error: "invalid_audio_room_id" });
        const owns = await pool.query(
          `SELECT id,easeverse_track_id FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`,
          [audioRoomId, d.userId],
        );
        if (!owns.rows.length) return res.status(403).json({ error: "audio_room_not_accessible" });
        if (trackId && owns.rows[0].easeverse_track_id && String(owns.rows[0].easeverse_track_id) !== trackId) {
          return res.status(409).json({ error: "track_audio_room_mismatch" });
        }
        reviewId = String(owns.rows[0].id);
      } else if (trackId) {
        reviewId = await resolveReviewForTrack(d.userId, trackId);
      }
      const sessionType = ["recording", "editing", "mixing", "mastering"].includes(String(req.body?.sessionType))
        ? String(req.body.sessionType) : "mixing";
      const ins = await pool.query(
        `INSERT INTO protools_companion_sessions
           (user_id,name,session_type,easeverse_track_id,audio_review_project_id,workspace_project_id,easeverse_project_id,
            device_token_id,sample_rate,bit_depth,session_format,ptx_path,bounce_dir)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [d.userId, name, sessionType, trackId, reviewId, workspaceProjectId, easeverseProjectId, d.deviceId,
         intOrNull(req.body?.sampleRate), intOrNull(req.body?.bitDepth), strOrNull(req.body?.sessionFormat, 8) || "ptx",
         strOrNull(req.body?.ptxPath, 2000), strOrNull(req.body?.bounceDir, 2000)],
      );
      res.status(201).json({ session: ins.rows[0] });
    } catch (error) {
      console.error("[protools-companion] create session:", error);
      res.status(503).json({ error: "create_failed" });
    }
  });

  // POST /api/protools/sessions/:id/markers — { markers: [{name,startSeconds,endSeconds?,timecode?,color?}], replace?:true }
  app.post("/api/protools/sessions/:id/markers", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const sess = await ownedSession(d.userId, req.params.id); if (!sess) return res.status(404).json({ error: "session_not_found" });
    const markers = Array.isArray(req.body?.markers) ? req.body.markers : [];
    if (markers.length > 1000) return res.status(413).json({ error: "too_many_markers" });
    const markerSnapshot: EaseVerseProToolsMarker[] = [];
    for (let index = 0; index < markers.length; index += 1) {
      const m = markers[index];
      const start = Number(m?.startSeconds);
      const end = m?.endSeconds == null ? undefined : Number(m.endSeconds);
      if (!Number.isFinite(start) || start < 0 || (end != null && (!Number.isFinite(end) || end < start))) {
        return res.status(400).json({ error: "invalid_marker", index });
      }
      const marker: EaseVerseProToolsMarker = {
        id: strOrNull(m?.id, 160) || `marker-${index + 1}`,
        name: String(m?.name || `Markør ${index + 1}`).slice(0, 200),
        startSeconds: start,
        ...(end != null ? { endSeconds: end } : {}),
        ...(m?.timecode ? { timecode: String(m.timecode).slice(0, 24) } : {}),
        ...(m?.color ? { color: String(m.color).slice(0, 16) } : {}),
        ...(m?.sectionType ? { sectionType: String(m.sectionType).slice(0, 40) } : {}),
      };
      markerSnapshot.push(marker);
    }
    const client = typeof pool.connect === "function" ? await pool.connect() : pool;
    let syncedSections = 0;
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM protools_companion_markers WHERE session_id=$1::uuid`, [sess.id]);
      for (let index = 0; index < markerSnapshot.length; index += 1) {
        const marker = markerSnapshot[index];
        await client.query(
          `INSERT INTO protools_companion_markers (session_id,name,start_seconds,end_seconds,timecode,color,order_index)
           VALUES ($1::uuid,$2,$3,$4,$5,$6,$7)`,
          [sess.id, marker.name, marker.startSeconds, marker.endSeconds ?? null,
           marker.timecode ?? null, marker.color ?? null, index],
        );
      }
      await client.query(`UPDATE protools_companion_sessions SET last_activity=NOW(),updated_at=NOW() WHERE id=$1::uuid`, [sess.id]);
      if (sess.audio_review_project_id) {
        const versionId = await currentVersionId(sess.audio_review_project_id, client);
        if (versionId) syncedSections = await syncMarkersToVersion(sess.id, versionId, client);
      }
      await client.query("COMMIT");
      if (sess.audio_review_project_id) {
        void broadcastSoundRoomUpdated(pool, String(sess.audio_review_project_id), "version");
      }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[protools-companion] marker transaction:", error);
      return res.status(503).json({ error: "marker_sync_failed" });
    } finally {
      if (client !== pool && typeof client.release === "function") client.release();
    }
    const clientEventId = strOrNull(req.body?.eventId, 225);
    const easeverseSync = await mirrorSessionToEaseVerse(
      sess, markerSnapshot, undefined, "markers", clientEventId ? `${clientEventId}:markers` : undefined,
    );
    res.json({ markersStored: markerSnapshot.length, sectionsSynced: syncedSections, easeverseSync });
  });

  // POST /api/protools/sessions/:id/metadata — { tempo?, keySignature?, timeSignature?, sampleRate?, bitDepth?, tracks?:[{name,type}] }
  app.post("/api/protools/sessions/:id/metadata", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const sess = await ownedSession(d.userId, req.params.id); if (!sess) return res.status(404).json({ error: "session_not_found" });
    const tracks = Array.isArray(req.body?.tracks) ? req.body.tracks.slice(0, 256).map((t: any) => ({ name: String(t?.name || "").slice(0, 200), type: String(t?.type || "audio").slice(0, 24) })) : null;
    const tempo = numOrNull(req.body?.tempo);
    const sampleRate = intOrNull(req.body?.sampleRate);
    const bitDepth = intOrNull(req.body?.bitDepth);
    const keySignature = strOrNull(req.body?.keySignature, 24);
    const timeSignature = strOrNull(req.body?.timeSignature, 12);
    if (tempo != null && (tempo < 20 || tempo > 400)) return res.status(400).json({ error: "invalid_tempo" });
    if (sampleRate != null && (sampleRate < 8000 || sampleRate > 768000)) return res.status(400).json({ error: "invalid_sample_rate" });
    if (bitDepth != null && (bitDepth < 8 || bitDepth > 64)) return res.status(400).json({ error: "invalid_bit_depth" });
    const client = typeof pool.connect === "function" ? await pool.connect() : pool;
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE protools_companion_sessions SET
           tempo=COALESCE($2,tempo),key_signature=COALESCE($3,key_signature),time_signature=COALESCE($4,time_signature),
           sample_rate=COALESCE($5,sample_rate),bit_depth=COALESCE($6,bit_depth),
           tracks=COALESCE($7::jsonb,tracks),track_count=COALESCE($8,track_count),
           last_activity=NOW(),updated_at=NOW()
         WHERE id=$1::uuid`,
        [sess.id, tempo, keySignature, timeSignature, sampleRate, bitDepth,
         tracks ? JSON.stringify(tracks) : null, tracks ? tracks.length : null],
      );
      if (sess.easeverse_track_id && (tempo != null || keySignature)) {
        await client.query(
          `UPDATE easeverse_tracks SET bpm=COALESCE($2,bpm),musical_key=COALESCE($3,musical_key),updated_at=NOW()
            WHERE id=$1::uuid AND user_id=$4`,
          [sess.easeverse_track_id, tempo, keySignature, d.userId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[protools-companion] metadata transaction:", error);
      return res.status(503).json({ error: "metadata_sync_failed" });
    } finally {
      if (client !== pool && typeof client.release === "function") client.release();
    }
    // Session Info-watcher sender metadata rett etter markørene. Speil bare på
    // nytt når tempo faktisk endres, så én filendring ikke gir doble API-kall.
    const easeverseSync = tempo != null || keySignature != null || timeSignature != null
      ? await mirrorSessionToEaseVerse(
          { ...sess, tempo: tempo ?? sess.tempo, key_signature: keySignature ?? sess.key_signature,
            time_signature: timeSignature ?? sess.time_signature },
          undefined,
          tempo,
          "metadata",
          strOrNull(req.body?.eventId, 223) ? `${strOrNull(req.body.eventId, 223)}:metadata` : undefined,
        )
      : undefined;
    res.json({ ok: true, ...(easeverseSync ? { easeverseSync } : {}) });
  });

  // POST /api/protools/sessions/:id/playhead — { timecode?, seconds?, isPlaying? } (best-effort live)
  app.post("/api/protools/sessions/:id/playhead", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const sess = await ownedSession(d.userId, req.params.id); if (!sess) return res.status(404).json({ error: "session_not_found" });
    const ph = { timecode: strOrNull(req.body?.timecode, 24), seconds: numOrNull(req.body?.seconds), isPlaying: !!req.body?.isPlaying, at: new Date().toISOString() };
    await pool.query(`UPDATE protools_companion_sessions SET playhead = $2::jsonb, last_activity = NOW() WHERE id = $1::uuid`, [sess.id, JSON.stringify(ph)]).catch(() => {});
    res.json({ ok: true });
  });

  // POST /api/protools/sessions/:id/bounce/presign — { fileName, sizeBytes?, mimeType? } → presignert PUT
  app.post("/api/protools/sessions/:id/bounce/presign", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const sess = await ownedSession(d.userId, req.params.id); if (!sess) return res.status(404).json({ error: "session_not_found" });
    const fileName = sanitizeName(String(req.body?.fileName || "bounce.wav"));
    const key = `protools-bounces/${d.userId}/${sess.id}/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
    const r2 = getR2();
    if (!r2) return res.status(503).json({ error: "storage_not_configured" });
    const { client, cfg } = r2;
    const finalUrl = cfg.publicBaseUrl ? `${cfg.publicBaseUrl.replace(/\/+$/, "")}/${key}` : `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}/${key}`;
    const cmd = new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: String(req.body?.mimeType || "audio/wav"), ContentLength: intOrNull(req.body?.sizeBytes) || undefined });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: UPLOAD_URL_TTL_SEC }).catch(() => null);
    if (!uploadUrl) return res.status(500).json({ error: "presign_failed" });
    res.json({ uploadUrl, fileUrl: finalUrl, storageKey: key, expiresInSeconds: UPLOAD_URL_TTL_SEC });
  });

  // POST /api/protools/sessions/:id/bounce/complete — { fileUrl, storageKey?, fileName?, versionLabel?, sizeBytes?, durationSeconds?, sampleRate?, bitDepth? }
  // Oppretter en ny audio_review_versjon på koblet review + speiler markører som seksjoner.
  app.post("/api/protools/sessions/:id/bounce/complete", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const sess = await ownedSession(d.userId, req.params.id); if (!sess) return res.status(404).json({ error: "session_not_found" });
    const fileUrl = String(req.body?.fileUrl || "").trim();
    if (!fileUrl) return res.status(400).json({ error: "fileUrl_required" });
    const fileName = req.body?.fileName ? String(req.body.fileName).slice(0, 300) : null;
    const clientEventId = strOrNull(req.body?.clientEventId, 240);
    const contentFingerprint = strOrNull(req.body?.contentFingerprint, 400);
    const storageKey = strOrNull(req.body?.storageKey, 500);
    if (storageKey && !storageKey.startsWith(`protools-bounces/${d.userId}/${sess.id}/`)) {
      return res.status(403).json({ error: "invalid_storage_key" });
    }
    if (clientEventId) {
      const existing = await pool.query(
        `SELECT b.id,b.review_version_id,v.version_number,s.audio_review_project_id
           FROM protools_companion_bounces b
           JOIN protools_companion_sessions s ON s.id=b.session_id
           LEFT JOIN audio_review_versions v ON v.id=b.review_version_id
          WHERE b.session_id=$1::uuid AND b.client_event_id=$2 AND s.user_id=$3 LIMIT 1`,
        [sess.id, clientEventId, d.userId],
      );
      if (existing.rows[0]) return res.json({
        bounceId: existing.rows[0].id,
        reviewVersionId: existing.rows[0].review_version_id,
        versionNumber: existing.rows[0].version_number,
        sectionsSynced: 0,
        linkedReview: existing.rows[0].audio_review_project_id,
        idempotent: true,
      });
    }
    let reviewId: string | null = sess.audio_review_project_id || null;
    // Hvis sesjonen har track men ikke review ennå (ingen markører er pushet) — finn/opprett nå.
    if (!reviewId && sess.easeverse_track_id) {
      reviewId = await resolveReviewForTrack(d.userId, String(sess.easeverse_track_id));
    }
    let versionId: string | null = null;
    let versionNumber: number | null = null;
    let sectionsSynced = 0;
    const client = typeof pool.connect === "function" ? await pool.connect() : pool;
    try {
      await client.query("BEGIN");
      if (reviewId) {
        await client.query(`SELECT id FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 FOR UPDATE`, [reviewId, d.userId]);
        await client.query(`UPDATE audio_review_versions SET status='superseded' WHERE project_id=$1::uuid AND status='under_review'`, [reviewId]);
        const next = await client.query(`SELECT COALESCE(MAX(version_number),0)+1 AS n FROM audio_review_versions WHERE project_id=$1::uuid`, [reviewId]);
        versionNumber = Number(next.rows[0]?.n || 1);
        const version = await client.query(
          `INSERT INTO audio_review_versions
             (project_id,version_label,version_number,file_name,file_url,duration,sample_rate,bit_depth,file_size,uploaded_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [reviewId, strOrNull(req.body?.versionLabel, 80) || `Mix V${versionNumber}`, versionNumber, fileName, fileUrl,
           numOrNull(req.body?.durationSeconds), intOrNull(req.body?.sampleRate) || sess.sample_rate,
           intOrNull(req.body?.bitDepth) || sess.bit_depth, intOrNull(req.body?.sizeBytes), d.userId],
        );
        versionId = String(version.rows[0].id);
        await client.query(`UPDATE audio_review_projects SET status='under_review',updated_at=NOW() WHERE id=$1::uuid`, [reviewId]);
        sectionsSynced = await syncMarkersToVersion(sess.id, versionId, client);
      }
      const bounce = await client.query(
        `INSERT INTO protools_companion_bounces
           (session_id,file_name,file_url,storage_key,size_bytes,duration_seconds,review_version_id,client_event_id,content_fingerprint)
         VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [sess.id, fileName, fileUrl, storageKey, intOrNull(req.body?.sizeBytes),
         numOrNull(req.body?.durationSeconds), versionId, clientEventId, contentFingerprint],
      );
      await client.query(
        `UPDATE protools_companion_sessions SET audio_review_project_id=COALESCE($2::uuid,audio_review_project_id),last_activity=NOW(),updated_at=NOW() WHERE id=$1::uuid`,
        [sess.id, reviewId],
      );
      await client.query("COMMIT");
      if (reviewId) void broadcastSoundRoomUpdated(pool, reviewId, "version");
      res.status(201).json({ bounceId: bounce.rows[0].id, reviewVersionId: versionId, versionNumber, sectionsSynced, linkedReview: reviewId });
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error?.code === "23505" && clientEventId) {
        const existing = await pool.query(`SELECT id,review_version_id FROM protools_companion_bounces WHERE session_id=$1::uuid AND client_event_id=$2 LIMIT 1`, [sess.id, clientEventId]);
        return res.json({ bounceId: existing.rows[0]?.id, reviewVersionId: existing.rows[0]?.review_version_id, linkedReview: reviewId, idempotent: true });
      }
      console.error("[protools-companion] bounce complete:", error);
      res.status(503).json({ error: "bounce_registration_failed" });
    } finally {
      if (client !== pool && typeof client.release === "function") client.release();
    }
  });

  // ════════════════════════ WEB (Sound Room-panel) ════════════════════════════════

  // GET /api/protools/web/status?audioRoomId= — paret companion? siste playhead? sesjon? markører? bounces?
  app.get("/api/protools/web/status", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const audioRoomId = req.query?.audioRoomId ? String(req.query.audioRoomId) : null;
    if (audioRoomId && !isUuid(audioRoomId)) return res.status(400).json({ error: "invalid_audio_room_id" });
    const dev = await pool.query(
      `SELECT id, last_used_at, created_at FROM desktop_device_tokens
        WHERE user_id = $1 AND label = 'Pro Tools Companion' AND revoked_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 10`, [s.userId],
    ).catch(() => ({ rows: [] }));
    let session: any = null; let markers: any[] = []; let bounces: any[] = [];
    const sq = audioRoomId
      ? await pool.query(`SELECT * FROM protools_companion_sessions WHERE user_id = $1 AND audio_review_project_id = $2::uuid ORDER BY last_activity DESC LIMIT 1`, [s.userId, audioRoomId]).catch(() => ({ rows: [] }))
      : await pool.query(`SELECT * FROM protools_companion_sessions WHERE user_id = $1 ORDER BY last_activity DESC LIMIT 1`, [s.userId]).catch(() => ({ rows: [] }));
    session = sq.rows[0] || null;
    if (session) {
      markers = (await pool.query(`SELECT name, start_seconds, end_seconds, timecode, color FROM protools_companion_markers WHERE session_id = $1::uuid ORDER BY order_index ASC, start_seconds ASC`, [session.id]).catch(() => ({ rows: [] }))).rows;
      bounces = (await pool.query(`SELECT id, file_name, file_url, duration_seconds, review_version_id, created_at FROM protools_companion_bounces WHERE session_id = $1::uuid ORDER BY created_at DESC LIMIT 10`, [session.id]).catch(() => ({ rows: [] }))).rows;
    }
    const sync = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status='pending')::int AS pending_count,
              MAX(delivered_at) AS last_delivered_at,MAX(last_error) FILTER (WHERE status='pending') AS last_error
         FROM protools_easeverse_sync_outbox WHERE user_id=$1`, [s.userId],
    ).catch(() => ({ rows: [{ pending_count: 0, last_delivered_at: null, last_error: null }] }));
    res.json({
      paired: dev.rows.length > 0,
      device: dev.rows[0] || null,
      devices: dev.rows,
      session, markers, bounces,
      playhead: session?.playhead || null,
      sync: sync.rows[0] || { pending_count: 0, last_delivered_at: null, last_error: null },
    });
  });

  // POST /api/protools/web/unlink-device — revoker kun valgt companion-enhet.
  app.post("/api/protools/web/unlink-device", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const deviceId = strOrNull(req.body?.deviceId, 160);
    if (!deviceId) return res.status(400).json({ error: "deviceId_required" });
    const result = await pool.query(
      `UPDATE desktop_device_tokens SET revoked_at=NOW()
        WHERE id=$1 AND user_id=$2 AND label='Pro Tools Companion' AND revoked_at IS NULL RETURNING id`,
      [deviceId, s.userId],
    );
    if (!result.rows.length) return res.status(404).json({ error: "device_not_found" });
    res.json({ ok: true, deviceId });
  });

  app.post("/api/protools/web/retry-sync", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      res.json(await retryEaseVerseSync(pool, s.userId, intOrNull(req.body?.limit) || 10));
    } catch (error) {
      console.error("[protools-companion] retry sync:", error);
      res.status(503).json({ error: "sync_retry_failed" });
    }
  });

  app.post("/api/protools/device/revoke", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    try {
      await pool.query(
        `UPDATE desktop_device_tokens SET revoked_at=NOW() WHERE id=$1 AND user_id=$2 AND label='Pro Tools Companion'`,
        [d.deviceId, d.userId],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[protools-companion] device revoke:", error);
      res.status(503).json({ error: "device_revoke_failed" });
    }
  });

  // ── små parser-hjelpere ──
  function intOrNull(v: any): number | null { const n = parseInt(String(v), 10); return isFinite(n) ? n : null; }
  function numOrNull(v: any): number | null { const n = Number(v); return isFinite(n) ? n : null; }
  function strOrNull(v: any, max: number): string | null { if (v == null) return null; const s = String(v).trim(); return s ? s.slice(0, max) : null; }
}
