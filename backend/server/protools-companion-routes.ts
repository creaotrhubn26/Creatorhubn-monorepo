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

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

// ─────────────────────────── Hjelpere ────────────────────────────────────────────────
function hashToken(t: string): string { return crypto.createHash("sha256").update(t).digest("hex"); }
const DEVICE_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const PAIR_TTL_MS = 10 * 60 * 1000;

// Paringskoder i minne (kort levetid). code → { userId, email, name, createdAt }
const pairStore = new Map<string, { userId: string; email: string; name: string; createdAt: number }>();
function prunePairs() { const now = Date.now(); for (const [k, v] of pairStore) if (now - v.createdAt > PAIR_TTL_MS) pairStore.delete(k); }
function genPairCode(): string {
  // 6 sifre, unngå ledende kollisjon med eksisterende aktive koder
  for (let i = 0; i < 20; i++) { const c = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0"); if (!pairStore.has(c)) return c; }
  return String(crypto.randomInt(100000, 999999));
}

let schemaReady: Promise<void> | null = null;
async function ensureSchema(pool: any): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS protools_companion_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(64) NOT NULL,
        name TEXT NOT NULL,
        session_type VARCHAR(30) NOT NULL DEFAULT 'mixing',
        easeverse_track_id VARCHAR(64),
        audio_review_project_id UUID,
        tempo NUMERIC(7,3),
        key_signature VARCHAR(24),
        time_signature VARCHAR(12),
        sample_rate INTEGER,
        bit_depth INTEGER,
        session_format VARCHAR(8) DEFAULT 'ptx',
        ptx_path TEXT,
        bounce_dir TEXT,
        track_count INTEGER DEFAULT 0,
        tracks JSONB DEFAULT '[]'::jsonb,
        playhead JSONB,
        status VARCHAR(20) DEFAULT 'active',
        last_activity TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ptc_sessions_user ON protools_companion_sessions(user_id, last_activity DESC);
      CREATE INDEX IF NOT EXISTS idx_ptc_sessions_review ON protools_companion_sessions(audio_review_project_id);

      CREATE TABLE IF NOT EXISTS protools_companion_markers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL,
        name TEXT NOT NULL,
        start_seconds DOUBLE PRECISION NOT NULL,
        end_seconds DOUBLE PRECISION,
        timecode VARCHAR(24),
        color VARCHAR(16),
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ptc_markers_session ON protools_companion_markers(session_id, order_index);

      CREATE TABLE IF NOT EXISTS protools_companion_bounces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL,
        file_name TEXT,
        file_url TEXT,
        storage_key TEXT,
        size_bytes BIGINT,
        duration_seconds DOUBLE PRECISION,
        review_version_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ptc_bounces_session ON protools_companion_bounces(session_id, created_at DESC);
    `).catch((e: any) => { console.error("[protools-companion] ensureSchema:", e?.message || e); });
  })();
  return schemaReady;
}

export function setupProToolsCompanionRoutes(deps: ProToolsCompanionDeps): void {
  const { app, pool, requireUserSession } = deps;
  ensureSchema(pool);

  // ── Companion device-auth (Bearer trr_desk_…) ────────────────────────────────────
  async function deviceAuth(req: any, res: any): Promise<{ userId: string; email: string } | null> {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "device_token_required" }); return null; }
    const token = auth.slice(7).trim();
    if (!token || token.length > 200) { res.status(401).json({ error: "invalid_token" }); return null; }
    const r = await pool.query(
      `SELECT user_id, user_email FROM desktop_device_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() LIMIT 1`,
      [hashToken(token)],
    ).catch(() => ({ rows: [] as any[] }));
    if (!r.rows.length) { res.status(401).json({ error: "token_expired_or_revoked" }); return null; }
    pool.query(`UPDATE desktop_device_tokens SET last_used_at = now() WHERE token_hash = $1`, [hashToken(token)]).catch(() => {});
    return { userId: r.rows[0].user_id, email: r.rows[0].user_email };
  }

  // Sesjon eid av companion-bruker (eller 404)
  async function ownedSession(uid: string, sessionId: string): Promise<any | null> {
    const r = await pool.query(`SELECT * FROM protools_companion_sessions WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [sessionId, uid]).catch(() => ({ rows: [] }));
    return r.rows[0] || null;
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
  async function currentVersionId(reviewId: string): Promise<string | null> {
    const r = await pool.query(
      `SELECT id FROM audio_review_versions WHERE project_id = $1::uuid
        ORDER BY (status='under_review') DESC, version_number DESC LIMIT 1`, [reviewId],
    ).catch(() => ({ rows: [] }));
    return r.rows[0]?.id || null;
  }

  // Speil session-markører til audio_review_sections på en gitt versjon (full erstatt).
  async function syncMarkersToVersion(sessionId: string, versionId: string): Promise<number> {
    const m = await pool.query(`SELECT name, start_seconds, end_seconds, color, order_index FROM protools_companion_markers WHERE session_id = $1::uuid ORDER BY order_index ASC, start_seconds ASC`, [sessionId]).catch(() => ({ rows: [] }));
    if (!m.rows.length) return 0;
    await pool.query(`DELETE FROM audio_review_sections WHERE version_id = $1::uuid`, [versionId]).catch(() => {});
    let n = 0;
    for (const row of m.rows) {
      const end = row.end_seconds ?? (Number(row.start_seconds) + 0.001);
      await pool.query(
        `INSERT INTO audio_review_sections (version_id, name, start_time_seconds, end_time_seconds, color, order_index)
         VALUES ($1::uuid,$2,$3,$4,$5,$6)`,
        [versionId, row.name || `Markør ${n + 1}`, Number(row.start_seconds) || 0, Number(end), row.color || null, row.order_index ?? n],
      ).catch(() => {}); n++;
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
    prunePairs();
    const code = genPairCode();
    pairStore.set(code, { userId: s.userId, email: s.email, name: s.name, createdAt: Date.now() });
    res.json({ code, expiresInSeconds: Math.floor(PAIR_TTL_MS / 1000) });
  });

  // POST /api/protools/pair/claim — companion bytter koden mot et device-token.
  app.post("/api/protools/pair/claim", async (req, res) => {
    prunePairs();
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "invalid_code" });
    const entry = pairStore.get(code);
    if (!entry) return res.status(404).json({ error: "code_not_found_or_expired" });
    pairStore.delete(code); // engangsbruk
    const rawToken = `trr_desk_${crypto.randomBytes(32).toString("hex")}`;
    const expiresAt = new Date(Date.now() + DEVICE_TOKEN_TTL_MS);
    await pool.query(
      `INSERT INTO desktop_device_tokens (id, user_id, user_email, token_hash, label, expires_at)
       VALUES ($1,$2,$3,$4,'Pro Tools Companion',$5)`,
      [`ptc_${crypto.randomUUID()}`, entry.userId, entry.email, hashToken(rawToken), expiresAt],
    ).catch((e: any) => { console.error("[protools-companion] claim insert:", e?.message); });
    res.json({ token: rawToken, user: { id: entry.userId, email: entry.email, name: entry.name }, apiBase: resolveApiBase(req) });
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
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "name_required" });
    let reviewId: string | null = null;
    const trackId = req.body?.easeverseTrackId ? String(req.body.easeverseTrackId) : null;
    if (req.body?.audioRoomId) {
      const owns = await pool.query(`SELECT id FROM audio_review_projects WHERE id = $1::uuid AND owner_user_id = $2 LIMIT 1`, [String(req.body.audioRoomId), d.userId]).catch(() => ({ rows: [] }));
      reviewId = owns.rows[0]?.id || null;
    } else if (trackId) {
      reviewId = await resolveReviewForTrack(d.userId, trackId);
    }
    const ins = await pool.query(
      `INSERT INTO protools_companion_sessions
         (user_id, name, session_type, easeverse_track_id, audio_review_project_id, sample_rate, bit_depth, session_format, ptx_path, bounce_dir)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [d.userId, name, String(req.body?.sessionType || "mixing"), trackId, reviewId,
       intOrNull(req.body?.sampleRate), intOrNull(req.body?.bitDepth), String(req.body?.sessionFormat || "ptx"),
       req.body?.ptxPath ? String(req.body.ptxPath) : null, req.body?.bounceDir ? String(req.body.bounceDir) : null],
    ).catch((e: any) => { console.error("[protools-companion] create session:", e?.message); return { rows: [] }; });
    if (!ins.rows.length) return res.status(500).json({ error: "create_failed" });
    res.status(201).json({ session: ins.rows[0] });
  });

  // POST /api/protools/sessions/:id/markers — { markers: [{name,startSeconds,endSeconds?,timecode?,color?}], replace?:true }
  app.post("/api/protools/sessions/:id/markers", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const sess = await ownedSession(d.userId, req.params.id); if (!sess) return res.status(404).json({ error: "session_not_found" });
    const markers = Array.isArray(req.body?.markers) ? req.body.markers : [];
    await pool.query(`DELETE FROM protools_companion_markers WHERE session_id = $1::uuid`, [sess.id]).catch(() => {});
    let n = 0;
    for (const m of markers) {
      const start = Number(m?.startSeconds);
      if (!isFinite(start)) continue;
      await pool.query(
        `INSERT INTO protools_companion_markers (session_id, name, start_seconds, end_seconds, timecode, color, order_index)
         VALUES ($1::uuid,$2,$3,$4,$5,$6,$7)`,
        [sess.id, String(m?.name || `Markør ${n + 1}`).slice(0, 200), start,
         isFinite(Number(m?.endSeconds)) ? Number(m.endSeconds) : null,
         m?.timecode ? String(m.timecode).slice(0, 24) : null, m?.color ? String(m.color).slice(0, 16) : null, n],
      ).catch(() => {}); n++;
    }
    await pool.query(`UPDATE protools_companion_sessions SET last_activity = NOW(), updated_at = NOW() WHERE id = $1::uuid`, [sess.id]).catch(() => {});
    // Speil til gjeldende review-versjon hvis koblet.
    let syncedSections = 0;
    if (sess.audio_review_project_id) {
      const vid = await currentVersionId(sess.audio_review_project_id);
      if (vid) syncedSections = await syncMarkersToVersion(sess.id, vid);
    }
    res.json({ markersStored: n, sectionsSynced: syncedSections });
  });

  // POST /api/protools/sessions/:id/metadata — { tempo?, keySignature?, timeSignature?, sampleRate?, bitDepth?, tracks?:[{name,type}] }
  app.post("/api/protools/sessions/:id/metadata", async (req, res) => {
    const d = await deviceAuth(req, res); if (!d) return;
    const sess = await ownedSession(d.userId, req.params.id); if (!sess) return res.status(404).json({ error: "session_not_found" });
    const tracks = Array.isArray(req.body?.tracks) ? req.body.tracks.slice(0, 256).map((t: any) => ({ name: String(t?.name || "").slice(0, 200), type: String(t?.type || "audio").slice(0, 24) })) : null;
    await pool.query(
      `UPDATE protools_companion_sessions SET
         tempo = COALESCE($2, tempo), key_signature = COALESCE($3, key_signature), time_signature = COALESCE($4, time_signature),
         sample_rate = COALESCE($5, sample_rate), bit_depth = COALESCE($6, bit_depth),
         tracks = COALESCE($7::jsonb, tracks), track_count = COALESCE($8, track_count),
         last_activity = NOW(), updated_at = NOW()
       WHERE id = $1::uuid`,
      [sess.id, numOrNull(req.body?.tempo), strOrNull(req.body?.keySignature, 24), strOrNull(req.body?.timeSignature, 12),
       intOrNull(req.body?.sampleRate), intOrNull(req.body?.bitDepth), tracks ? JSON.stringify(tracks) : null, tracks ? tracks.length : null],
    ).catch(() => {});
    // Synk metadata oppover til koblet EaseVerse-track (bpm/key) når satt.
    if (sess.easeverse_track_id && (req.body?.tempo != null || req.body?.keySignature)) {
      await pool.query(
        `UPDATE easeverse_tracks SET bpm = COALESCE($2, bpm), musical_key = COALESCE($3, musical_key), updated_at = NOW() WHERE id = $1::uuid AND user_id = $4`,
        [sess.easeverse_track_id, numOrNull(req.body?.tempo), strOrNull(req.body?.keySignature, 24), d.userId],
      ).catch(() => {});
    }
    res.json({ ok: true });
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
    let reviewId: string | null = sess.audio_review_project_id || null;
    // Hvis sesjonen har track men ikke review ennå (ingen markører er pushet) — finn/opprett nå.
    if (!reviewId && sess.easeverse_track_id) {
      reviewId = await resolveReviewForTrack(d.userId, String(sess.easeverse_track_id));
      if (reviewId) await pool.query(`UPDATE protools_companion_sessions SET audio_review_project_id = $2::uuid WHERE id = $1::uuid`, [sess.id, reviewId]).catch(() => {});
    }
    let versionId: string | null = null;
    let versionNumber: number | null = null;
    let sectionsSynced = 0;
    if (reviewId) {
      // §14 — kun én current review-versjon: sett tidligere under_review → superseded.
      await pool.query(`UPDATE audio_review_versions SET status = 'superseded' WHERE project_id = $1::uuid AND status = 'under_review'`, [reviewId]).catch(() => {});
      const nn = await pool.query(`SELECT COALESCE(MAX(version_number),0)+1 AS n FROM audio_review_versions WHERE project_id = $1::uuid`, [reviewId]).catch(() => ({ rows: [{ n: 1 }] }));
      versionNumber = nn.rows[0]?.n || 1;
      const v = await pool.query(
        `INSERT INTO audio_review_versions
           (project_id, version_label, version_number, file_name, file_url, duration, sample_rate, bit_depth, file_size, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [reviewId, strOrNull(req.body?.versionLabel, 80) || `Mix V${versionNumber}`, versionNumber, fileName, fileUrl,
         numOrNull(req.body?.durationSeconds), intOrNull(req.body?.sampleRate) || sess.sample_rate, intOrNull(req.body?.bitDepth) || sess.bit_depth,
         intOrNull(req.body?.sizeBytes), d.userId],
      ).catch((e: any) => { console.error("[protools-companion] create version:", e?.message); return { rows: [] }; });
      versionId = v.rows[0]?.id || null;
      if (versionId) {
        await pool.query(`UPDATE audio_review_projects SET status='under_review', updated_at=NOW() WHERE id=$1::uuid`, [reviewId]).catch(() => {});
        sectionsSynced = await syncMarkersToVersion(sess.id, versionId);
      }
    }
    const b = await pool.query(
      `INSERT INTO protools_companion_bounces (session_id, file_name, file_url, storage_key, size_bytes, duration_seconds, review_version_id)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [sess.id, fileName, fileUrl, strOrNull(req.body?.storageKey, 500), intOrNull(req.body?.sizeBytes), numOrNull(req.body?.durationSeconds), versionId],
    ).catch(() => ({ rows: [] }));
    await pool.query(`UPDATE protools_companion_sessions SET last_activity = NOW() WHERE id = $1::uuid`, [sess.id]).catch(() => {});
    res.status(201).json({ bounceId: b.rows[0]?.id || null, reviewVersionId: versionId, versionNumber, sectionsSynced, linkedReview: reviewId });
  });

  // ════════════════════════ WEB (Sound Room-panel) ════════════════════════════════

  // GET /api/protools/web/status?audioRoomId= — paret companion? siste playhead? sesjon? markører? bounces?
  app.get("/api/protools/web/status", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const audioRoomId = req.query?.audioRoomId ? String(req.query.audioRoomId) : null;
    // Paret enhet (Pro Tools Companion) finnes?
    const dev = await pool.query(
      `SELECT id, last_used_at, created_at FROM desktop_device_tokens
        WHERE user_id = $1 AND label = 'Pro Tools Companion' AND revoked_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`, [s.userId],
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
    res.json({
      paired: dev.rows.length > 0,
      device: dev.rows[0] || null,
      session, markers, bounces,
      playhead: session?.playhead || null,
    });
  });

  // POST /api/protools/web/unlink-device — revoker companion-enheten (alle Pro Tools Companion-tokens).
  app.post("/api/protools/web/unlink-device", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    await pool.query(`UPDATE desktop_device_tokens SET revoked_at = now() WHERE user_id = $1 AND label = 'Pro Tools Companion' AND revoked_at IS NULL`, [s.userId]).catch(() => {});
    res.json({ ok: true });
  });

  // ── små parser-hjelpere ──
  function intOrNull(v: any): number | null { const n = parseInt(String(v), 10); return isFinite(n) ? n : null; }
  function numOrNull(v: any): number | null { const n = Number(v); return isFinite(n) ? n : null; }
  function strOrNull(v: any, max: number): string | null { if (v == null) return null; const s = String(v).trim(); return s ? s.slice(0, max) : null; }
}
