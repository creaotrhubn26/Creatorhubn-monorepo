/**
 * audio-showcase-routes.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Audio Showcase MVP-API (jf. spec §23/§30): prosjekt → versjoner → tidskodede
 * kommentarer + seksjoner + godkjenninger + leveranser. Et profesjonelt
 * mix/master-review-rom.
 *
 * Eier (produsent) styres av requireUserSession. Kommentarer kan legges av
 * enhver innlogget (band/manager) — rolle-basert tilgang er V2 (spec §31).
 */

import type express from "express";
import { randomUUID } from "node:crypto";

const makeInviteToken = () => "inv_" + randomUUID().replace(/-/g, "");

type AnyPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
};

export interface AudioShowcaseDeps {
  app: express.Application;
  pool: AnyPool;
  requireUserSession: (req: any, res: any) => { userId: string; email?: string | null; name?: string | null } | null;
}

const isMissingTable = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "42P01";
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ── Ekstern EaseVerse-bro (stabil toveis tekst-synk) ───────────────────────
const EV_URL = (process.env.EASEVERSE_API_URL || "").trim().replace(/\/+$/, "");
const EV_KEY = (process.env.EASEVERSE_API_KEY || "").trim();

type EvResult = { configured: boolean; reachable: boolean; status?: number; item?: any; latencyMs?: number; error?: string };

async function evFetch(path: string, init: RequestInit, timeoutMs = 6000): Promise<EvResult> {
  if (!EV_URL) return { configured: false, reachable: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) };
    if (EV_KEY) headers["x-api-key"] = EV_KEY;
    const r = await fetch(`${EV_URL}${path}`, { ...init, headers, signal: ctrl.signal });
    const latencyMs = Date.now() - startedAt;
    const json = await r.json().catch(() => null);
    return { configured: true, reachable: true, status: r.status, item: json?.item ?? null, latencyMs };
  } catch (e: any) {
    return { configured: true, reachable: false, error: String(e?.message || e), latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

// Hent tekst fra EaseVerse med 1 retry på nettverks-/5xx-feil (ikke 4xx).
async function evGetLyrics(externalTrackId: string): Promise<EvResult> {
  let last: EvResult = { configured: Boolean(EV_URL), reachable: false };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await evFetch(`/api/v1/collab/lyrics/${encodeURIComponent(externalTrackId)}`, { method: "GET" });
    if (!res.configured) return res;
    last = res;
    if (res.reachable && res.status && (res.status < 500 || res.status === 404)) return res; // 2xx/4xx er endelig
  }
  return last;
}

async function evPushLyrics(payload: Record<string, unknown>): Promise<EvResult> {
  return evFetch(`/api/v1/collab/lyrics`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
}

// Hent DAW-markører (Pro Tools-seksjoner) fra EaseVerse for en track.
async function evGetProtools(externalTrackId: string): Promise<EvResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await evFetch(`/api/v1/collab/protools/${encodeURIComponent(externalTrackId)}`, { method: "GET" });
    if (!res.configured) return res;
    if (res.reachable && res.status && (res.status < 500 || res.status === 404)) return res;
  }
  return { configured: Boolean(process.env.EASEVERSE_API_URL), reachable: false };
}

// Enkel in-memory rate-limiter (sliding window) for offentlige token-endepunkter.
const rateBuckets = new Map<string, number[]>();
function rateLimited(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  rateBuckets.set(key, arr);
  return arr.length > max;
}
const clientIp = (req: any): string => (req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "?");

// Seksjons-farge per markør-type (matcher frontend SECTION_COLORS-spekteret).
const PT_SECTION_COLOR: Record<string, string> = {
  intro: "#d6457f", verse: "#3fa7d6", "pre-chorus": "#8aa0b6", chorus: "#FF6B35",
  bridge: "#e0a955", "final-chorus": "#e0606a", outro: "#5fb88a",
};

export function setupAudioShowcaseRoutes(deps: AudioShowcaseDeps): void {
  const { app, pool, requireUserSession } = deps;

  // Hent koblet track + lokal tekst-tilstand for et review-rom.
  async function loadLinkedTrack(reviewId: string, userId: string): Promise<any | null> {
    const p = await pool.query(
      `SELECT easeverse_track_id, external_track_id FROM audio_review_projects
        WHERE id = $1::uuid AND owner_user_id = $2 LIMIT 1`, [reviewId, userId]);
    if (p.rowCount === 0) return { notFound: true };
    const trackId = p.rows[0].easeverse_track_id;
    const externalTrackId = p.rows[0].external_track_id || trackId;
    if (!trackId) return null;
    const t = await pool.query(
      `SELECT id, title, artist, bpm, collaborators, lyrics,
              COALESCE(lyrics_updated_at, updated_at) AS lyrics_updated_at
         FROM easeverse_tracks WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [trackId, userId]);
    if (t.rowCount === 0) return null;
    return { ...t.rows[0], externalTrackId };
  }

  // Sjekk at en versjon tilhører innlogget eier (for moderering/godkjenning).
  async function ownsVersion(versionId: string, userId: string): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM audio_review_versions v JOIN audio_review_projects p ON p.id = v.project_id
        WHERE v.id = $1::uuid AND p.owner_user_id = $2 LIMIT 1`,
      [versionId, userId],
    );
    return r.rowCount > 0;
  }

  // ── Prosjekt ────────────────────────────────────────────────────────────
  app.post("/api/audio-showcases", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const title = str(req.body?.title, 200);
    if (!title) return res.status(400).json({ error: "title_required" });
    try {
      const r = await pool.query(
        `INSERT INTO audio_review_projects (owner_user_id, showcase_id, title, artist_name, band_name, genre, bpm, musical_key, deadline, easeverse_track_id, external_track_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [s.userId, str(req.body?.showcaseId, 200) || null, title, str(req.body?.artistName, 200) || null,
         str(req.body?.bandName, 200) || null, str(req.body?.genre, 120) || null, num(req.body?.bpm),
         str(req.body?.musicalKey, 40) || null, str(req.body?.deadline, 40) || null,
         str(req.body?.easeverseTrackId, 64) || null, str(req.body?.externalTrackId, 200) || null],
      );
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] create project failed:", e);
      return res.status(500).json({ error: "create_failed" });
    }
  });

  app.get("/api/audio-showcases", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      const r = await pool.query(
        `SELECT * FROM audio_review_projects WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [s.userId],
      );
      return res.json({ projects: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ projects: [] });
      return res.status(500).json({ error: "list_failed" });
    }
  });

  app.get("/api/audio-showcases/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const p = await pool.query(
        `SELECT * FROM audio_review_projects WHERE id = $1::uuid AND owner_user_id = $2 LIMIT 1`, [id, s.userId]);
      if (p.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const [v, members, tasks] = await Promise.all([
        pool.query(`SELECT * FROM audio_review_versions WHERE project_id = $1::uuid ORDER BY version_number ASC`, [id]),
        pool.query(`SELECT * FROM audio_review_members WHERE project_id = $1::uuid ORDER BY is_owner DESC, order_index ASC, created_at ASC`, [id]).catch(() => ({ rows: [] })),
        pool.query(`SELECT * FROM audio_review_tasks WHERE project_id = $1::uuid ORDER BY order_index ASC, created_at ASC`, [id]).catch(() => ({ rows: [] })),
      ]);
      // Koblet SongFlow/EaseVerse-track → tekst + track-status inn i studioet.
      let easeverseTrack: any = null;
      const linkedTrackId = p.rows[0].easeverse_track_id;
      if (linkedTrackId) {
        const t = await pool.query(
          `SELECT id, title, artist, status, lyrics FROM easeverse_tracks WHERE id = $1::uuid LIMIT 1`, [linkedTrackId],
        ).catch(() => ({ rows: [] as any[] }));
        easeverseTrack = t.rows[0] || null;
      }
      return res.json({ project: p.rows[0], versions: v.rows, members: members.rows, tasks: tasks.rows, easeverseTrack });
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "get_failed" });
    }
  });

  // ── Versjon (bounce) ──────────────────────────────────────────────────────
  app.post("/api/audio-versions", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const projectId = str(req.body?.projectId, 64);
    const fileUrl = str(req.body?.fileUrl, 1000);
    if (!projectId || !fileUrl) return res.status(400).json({ error: "projectId_and_fileUrl_required" });
    try {
      const owns = await pool.query(
        `SELECT 1 FROM audio_review_projects WHERE id = $1::uuid AND owner_user_id = $2 LIMIT 1`, [projectId, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "project_not_found" });

      // §14 — kun én current review-versjon: sett tidligere under_review → superseded.
      await pool.query(
        `UPDATE audio_review_versions SET status = 'superseded'
          WHERE project_id = $1::uuid AND status = 'under_review'`, [projectId]);
      const nextNo = await pool.query(
        `SELECT COALESCE(MAX(version_number),0)+1 AS n FROM audio_review_versions WHERE project_id = $1::uuid`, [projectId]);
      const vn = nextNo.rows[0].n;
      const r = await pool.query(
        `INSERT INTO audio_review_versions
           (project_id, version_label, version_number, file_name, file_url, preview_url, duration, sample_rate, bit_depth, channels, codec, file_size, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [projectId, str(req.body?.versionLabel, 80) || `Mix V${vn}`, vn, str(req.body?.fileName, 300) || null, fileUrl,
         str(req.body?.previewUrl, 1000) || null, num(req.body?.duration), num(req.body?.sampleRate), num(req.body?.bitDepth),
         num(req.body?.channels), str(req.body?.codec, 40) || null, num(req.body?.fileSize), s.userId],
      );
      await pool.query(`UPDATE audio_review_projects SET status='under_review', updated_at=NOW() WHERE id=$1::uuid`, [projectId]);
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] create version failed:", e);
      return res.status(500).json({ error: "create_version_failed" });
    }
  });

  app.get("/api/audio-versions/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const v = await pool.query(`SELECT * FROM audio_review_versions WHERE id = $1::uuid LIMIT 1`, [id]);
      if (v.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const [comments, sections, approvals] = await Promise.all([
        pool.query(`SELECT * FROM audio_review_comments WHERE version_id = $1::uuid ORDER BY timecode_seconds ASC, created_at ASC`, [id]),
        pool.query(`SELECT * FROM audio_review_sections WHERE version_id = $1::uuid ORDER BY order_index ASC, start_time_seconds ASC`, [id]),
        pool.query(`SELECT * FROM audio_review_approvals WHERE version_id = $1::uuid ORDER BY created_at DESC`, [id]),
      ]);
      return res.json({ version: v.rows[0], comments: comments.rows, sections: sections.rows, approvals: approvals.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "get_version_failed" });
    }
  });

  // ── Kommentar (tidskodet) ────────────────────────────────────────────────
  app.post("/api/audio-comments", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const versionId = str(req.body?.versionId, 64);
    const body = str(req.body?.body ?? req.body?.comment, 4000);
    if (!versionId || !body) return res.status(400).json({ error: "versionId_and_body_required" });
    try {
      const r = await pool.query(
        `INSERT INTO audio_review_comments
           (version_id, parent_comment_id, user_id, author, author_role, timecode_seconds, body, category, is_decision, section_ref)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [versionId, str(req.body?.parentCommentId, 64) || null, s.userId, str(req.body?.author, 200) || s.name || s.email || "Bruker",
         str(req.body?.authorRole, 80) || null, num(req.body?.timecodeSeconds) ?? num(req.body?.timecode) ?? 0, body,
         str(req.body?.category, 40) || "general", Boolean(req.body?.isDecision), str(req.body?.sectionRef, 120) || null],
      );
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] create comment failed:", e);
      return res.status(500).json({ error: "create_comment_failed" });
    }
  });

  app.patch("/api/audio-comments/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const sets: string[] = ["updated_at = NOW()"]; const params: unknown[] = [id];
    if (typeof req.body?.status === "string") {
      const st = str(req.body.status, 20);
      if (!["unresolved", "in_progress", "resolved", "decision", "rejected"].includes(st))
        return res.status(400).json({ error: "invalid_status" });
      params.push(st); sets.push(`status = $${params.length}`);
      params.push(st === "decision"); sets.push(`is_decision = $${params.length}`);
    }
    if (typeof req.body?.body === "string") { params.push(str(req.body.body, 4000)); sets.push(`body = $${params.length}`); }
    if (params.length === 1) return res.status(400).json({ error: "nothing_to_update" });
    try {
      const r = await pool.query(`UPDATE audio_review_comments SET ${sets.join(", ")} WHERE id = $1::uuid RETURNING *`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_comment_failed" });
    }
  });

  // ── Seksjoner (låtstruktur, §16) ──────────────────────────────────────────
  app.post("/api/audio-versions/:id/sections", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const versionId = str(req.params.id, 64);
    const sections = Array.isArray(req.body?.sections) ? req.body.sections : [];
    if (!sections.length) return res.status(400).json({ error: "sections_required" });
    try {
      if (!(await ownsVersion(versionId, s.userId))) return res.status(404).json({ error: "not_found" });
      await pool.query(`DELETE FROM audio_review_sections WHERE version_id = $1::uuid`, [versionId]);
      let i = 0;
      for (const sec of sections) {
        await pool.query(
          `INSERT INTO audio_review_sections (version_id, name, start_time_seconds, end_time_seconds, color, order_index)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [versionId, str(sec?.name, 80) || `Del ${i + 1}`, num(sec?.startTimeSeconds) ?? 0, num(sec?.endTimeSeconds) ?? 0, str(sec?.color, 40) || null, i++],
        );
      }
      const r = await pool.query(`SELECT * FROM audio_review_sections WHERE version_id = $1::uuid ORDER BY order_index ASC`, [versionId]);
      return res.json({ sections: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "sections_failed" });
    }
  });

  // ── Godkjenning (§19) ─────────────────────────────────────────────────────
  app.post("/api/audio-versions/:id/approve", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const versionId = str(req.params.id, 64);
    const approvalType = str(req.body?.approvalType, 40) || "mix_approved";
    if (!["mix_approved", "master_approved", "delivery_approved", "changes_requested"].includes(approvalType))
      return res.status(400).json({ error: "invalid_approval_type" });
    try {
      if (!(await ownsVersion(versionId, s.userId))) return res.status(404).json({ error: "not_found" });
      const a = await pool.query(
        `INSERT INTO audio_review_approvals (version_id, approved_by, approval_type, note) VALUES ($1,$2,$3,$4) RETURNING *`,
        [versionId, s.name || s.userId, approvalType, str(req.body?.note, 1000) || null]);
      // Versjon- + prosjekt-status følger godkjenningen.
      const vStatus = approvalType === "changes_requested" ? "under_review" : "approved";
      await pool.query(`UPDATE audio_review_versions SET status = $2 WHERE id = $1::uuid`, [versionId, vStatus]);
      const pStatus = approvalType === "changes_requested" ? "changes_requested"
        : approvalType === "delivery_approved" ? "final_delivered" : "approved";
      await pool.query(
        `UPDATE audio_review_projects SET status = $2, updated_at = NOW()
          WHERE id = (SELECT project_id FROM audio_review_versions WHERE id = $1::uuid)`, [versionId, pStatus]);
      // Synk koblet SongFlow/EaseVerse-track-status (mix_approved→mastering, delivery→completed, changes→mixing).
      const trackStatus = approvalType === "changes_requested" ? "mixing"
        : approvalType === "delivery_approved" ? "completed"
        : approvalType === "master_approved" ? "completed" : "mastering";
      await pool.query(
        `UPDATE easeverse_tracks SET status = $2, updated_at = NOW()
          WHERE id = (SELECT easeverse_track_id FROM audio_review_projects
                      WHERE id = (SELECT project_id FROM audio_review_versions WHERE id = $1::uuid))::uuid`,
        [versionId, trackStatus]).catch(() => { /* ikke koblet / annen DB-state */ });
      return res.status(201).json(a.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] approve failed:", e);
      return res.status(500).json({ error: "approve_failed" });
    }
  });

  // ── Leveranser (§18) ──────────────────────────────────────────────────────
  app.get("/api/audio-showcases/:id/deliverables", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const projectId = str(req.params.id, 64);
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [projectId, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const r = await pool.query(`SELECT * FROM audio_review_deliverables WHERE project_id=$1::uuid ORDER BY created_at DESC`, [projectId]);
      return res.json({ deliverables: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ deliverables: [] });
      return res.status(500).json({ error: "list_deliverables_failed" });
    }
  });

  app.post("/api/audio-deliverables", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const projectId = str(req.body?.projectId, 64);
    const fileUrl = str(req.body?.fileUrl, 1000);
    if (!projectId || !fileUrl) return res.status(400).json({ error: "projectId_and_fileUrl_required" });
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [projectId, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "project_not_found" });
      const r = await pool.query(
        `INSERT INTO audio_review_deliverables (project_id, version_id, type, file_name, file_url, file_size, format, downloadable)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [projectId, str(req.body?.versionId, 64) || null, str(req.body?.type, 60) || null, str(req.body?.fileName, 300) || null,
         fileUrl, num(req.body?.fileSize), str(req.body?.format, 40) || null, Boolean(req.body?.downloadable)]);
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "create_deliverable_failed" });
    }
  });

  // ── Kommentar-reaksjon (👍) ───────────────────────────────────────────────
  app.post("/api/audio-comments/:id/like", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const dir = num(req.body?.delta) === -1 ? -1 : 1;
    try {
      const r = await pool.query(
        `UPDATE audio_review_comments SET like_count = GREATEST(0, like_count + $2), updated_at = NOW()
          WHERE id = $1::uuid RETURNING *`, [id, dir]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "like_failed" });
    }
  });

  // ── Prosjektmedlemmer (band/crew) ─────────────────────────────────────────
  const PALETTE = ["#FF6B35", "#9b59b6", "#3fa7d6", "#e0a955", "#5fb88a", "#e0606a", "#8aa0b6"];
  app.get("/api/audio-showcases/:id/members", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const r = await pool.query(`SELECT * FROM audio_review_members WHERE project_id=$1::uuid ORDER BY is_owner DESC, order_index ASC, created_at ASC`, [id]);
      return res.json({ members: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ members: [] });
      return res.status(500).json({ error: "list_members_failed" });
    }
  });

  app.post("/api/audio-showcases/:id/members", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const name = str(req.body?.name, 200);
    if (!name) return res.status(400).json({ error: "name_required" });
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM audio_review_members WHERE project_id=$1::uuid`, [id]);
      const n = cnt.rows[0].n;
      const isOwner = Boolean(req.body?.isOwner);
      const token = isOwner ? null : makeInviteToken();
      const r = await pool.query(
        `INSERT INTO audio_review_members
           (project_id, user_id, name, role, avatar_color, is_owner, order_index, email, instrument, invite_token, invite_status, invited_at, invite_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $10::text IS NULL THEN NULL ELSE NOW() END, CASE WHEN $10::text IS NULL THEN NULL ELSE NOW() + INTERVAL '90 days' END) RETURNING *`,
        [id, str(req.body?.userId, 200) || null, name, str(req.body?.role, 80) || null,
         str(req.body?.avatarColor, 40) || PALETTE[n % PALETTE.length], isOwner, n,
         str(req.body?.email, 200) || null, str(req.body?.instrument, 120) || null, token, isOwner ? "owner" : "pending"]);
      return res.status(201).json({ ...r.rows[0], inviteToken: token, inviteUrl: token ? `/audio-review/invite/${token}` : null });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "add_member_failed" });
    }
  });

  app.delete("/api/audio-members/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const r = await pool.query(
        `DELETE FROM audio_review_members WHERE id=$1::uuid AND project_id IN
           (SELECT id FROM audio_review_projects WHERE owner_user_id=$2) RETURNING id`, [id, s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "delete_member_failed" });
    }
  });

  // Produsent fyller ut / redigerer en bidragsyters profil (auth, kun eier).
  const PROFILE_FIELDS: Array<[string, string, number]> = [
    ["name", "name", 200], ["role", "role", 80], ["instrument", "instrument", 120],
    ["email", "email", 200], ["phone", "phone", 60], ["bio", "bio", 2000], ["avatarColor", "avatar_color", 40], ["avatarUrl", "avatar_url", 3_000_000],
  ];
  app.patch("/api/audio-members/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const sets: string[] = []; const params: unknown[] = [id, s.userId];
    for (const [body, col, max] of PROFILE_FIELDS) {
      if (typeof req.body?.[body] === "string") { params.push(str(req.body[body], max)); sets.push(`${col} = $${params.length}`); }
    }
    if (typeof req.body?.easeverseAccess === "boolean") { params.push(req.body.easeverseAccess); sets.push(`easeverse_access = $${params.length}`); }
    if (req.body?.links && typeof req.body.links === "object") { params.push(JSON.stringify(req.body.links).slice(0, 4000)); sets.push(`links = $${params.length}::jsonb`); }
    if (Array.isArray(req.body?.contributions)) { params.push(JSON.stringify(req.body.contributions.filter((x: unknown) => typeof x === "string").slice(0, 30))); sets.push(`contributions = $${params.length}::jsonb`); }
    if (!sets.length) return res.status(400).json({ error: "nothing_to_update" });
    sets.push("invite_status = CASE WHEN invite_status = 'pending' THEN 'active' ELSE invite_status END");
    sets.push("profile_completed_at = COALESCE(profile_completed_at, NOW())");
    try {
      const r = await pool.query(
        `UPDATE audio_review_members SET ${sets.join(", ")}
          WHERE id = $1::uuid AND project_id IN (SELECT id FROM audio_review_projects WHERE owner_user_id = $2) RETURNING *`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_member_failed" });
    }
  });

  // ── Offentlig invitasjon: bidragsyter åpner lenke + fyller ut profil ──────
  app.get("/api/audio-review-invite/:token", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const r = await pool.query(
        `SELECT m.id, m.name, m.role, m.instrument, m.email, m.phone, m.bio, m.avatar_color, m.avatar_url, m.invite_status,
                m.easeverse_access, m.links, m.contributions, m.profile_completed_at, p.title AS project_title, p.band_name,
                COALESCE(p.external_track_id, p.easeverse_track_id) AS external_track_id,
                (SELECT name FROM audio_review_members WHERE project_id = m.project_id AND is_owner = TRUE LIMIT 1) AS inviter_name
           FROM audio_review_members m JOIN audio_review_projects p ON p.id = m.project_id
          WHERE m.invite_token = $1 AND (m.invite_expires_at IS NULL OR m.invite_expires_at > NOW()) LIMIT 1`, [token]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "invite_lookup_failed" });
    }
  });

  app.post("/api/audio-review-invite/:token", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    if (rateLimited(`inv:${clientIp(req)}`)) return res.status(429).json({ error: "rate_limited" });
    const name = str(req.body?.name, 200);
    if (!name) return res.status(400).json({ error: "name_required" });
    try {
      const r = await pool.query(
        `UPDATE audio_review_members SET name = $2, role = COALESCE($3, role), instrument = $4, email = $5, phone = $6, bio = $7,
           avatar_url = COALESCE($8, avatar_url), easeverse_access = COALESCE($9, easeverse_access), links = COALESCE($10::jsonb, links),
           contributions = COALESCE($11::jsonb, contributions), invite_status = 'active', profile_completed_at = NOW()
          WHERE invite_token = $1 AND (invite_expires_at IS NULL OR invite_expires_at > NOW()) RETURNING id, name, role, instrument, invite_status, easeverse_access`,
        [token, name, str(req.body?.role, 80) || null, str(req.body?.instrument, 120) || null,
         str(req.body?.email, 200) || null, str(req.body?.phone, 60) || null, str(req.body?.bio, 2000) || null,
         str(req.body?.avatarUrl, 3000000) || null, typeof req.body?.easeverseAccess === "boolean" ? req.body.easeverseAccess : null,
         req.body?.links && typeof req.body.links === "object" ? JSON.stringify(req.body.links).slice(0, 4000) : null,
         Array.isArray(req.body?.contributions) ? JSON.stringify(req.body.contributions.filter((x: unknown) => typeof x === "string").slice(0, 30)) : null]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, member: r.rows[0] });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "complete_profile_failed" });
    }
  });

  // ── Tasks (spec: oppgaver i stedet for AI) ────────────────────────────────
  app.get("/api/audio-showcases/:id/tasks", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const r = await pool.query(`SELECT * FROM audio_review_tasks WHERE project_id=$1::uuid ORDER BY order_index ASC, created_at ASC`, [id]);
      return res.json({ tasks: r.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ tasks: [] });
      return res.status(500).json({ error: "list_tasks_failed" });
    }
  });

  app.post("/api/audio-tasks", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const projectId = str(req.body?.projectId, 64);
    const title = str(req.body?.title, 400);
    if (!projectId || !title) return res.status(400).json({ error: "projectId_and_title_required" });
    try {
      const owns = await pool.query(`SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [projectId, s.userId]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "project_not_found" });
      const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM audio_review_tasks WHERE project_id=$1::uuid`, [projectId]);
      const r = await pool.query(
        `INSERT INTO audio_review_tasks (project_id, version_id, comment_id, title, status, assignee, created_by, order_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [projectId, str(req.body?.versionId, 64) || null, str(req.body?.commentId, 64) || null, title,
         str(req.body?.status, 20) || "todo", str(req.body?.assignee, 200) || str(req.body?.category, 80) || null,
         s.name || s.userId, cnt.rows[0].n]);
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "create_task_failed" });
    }
  });

  app.patch("/api/audio-tasks/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const sets: string[] = ["updated_at = NOW()"]; const params: unknown[] = [id];
    if (typeof req.body?.status === "string") {
      const st = str(req.body.status, 20);
      if (!["todo", "in_progress", "done"].includes(st)) return res.status(400).json({ error: "invalid_status" });
      params.push(st); sets.push(`status = $${params.length}`);
    }
    if (typeof req.body?.title === "string") { params.push(str(req.body.title, 400)); sets.push(`title = $${params.length}`); }
    if (typeof req.body?.assignee === "string") { params.push(str(req.body.assignee, 200)); sets.push(`assignee = $${params.length}`); }
    if (params.length === 1) return res.status(400).json({ error: "nothing_to_update" });
    try {
      const r = await pool.query(
        `UPDATE audio_review_tasks SET ${sets.join(", ")} WHERE id = $1::uuid AND project_id IN
           (SELECT id FROM audio_review_projects WHERE owner_user_id = $${params.push(s.userId)}) RETURNING *`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_task_failed" });
    }
  });

  // ── SongFlow/EaseVerse-track → Audio Showcase review-rom (Fase 1) ──────────
  // Idempotent: én aktiv review per track. Forhåndsutfyller fra track-meta +
  // collaborators → medlemmer. Tekst leses live fra easeverse_tracks (egen GET).
  app.post("/api/easeverse-tracks/:trackId/send-to-review", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const trackId = str(req.params.trackId, 64);
    try {
      const t = await pool.query(
        `SELECT * FROM easeverse_tracks WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [trackId, s.userId]);
      if (t.rowCount === 0) return res.status(404).json({ error: "track_not_found" });
      const track = t.rows[0];

      // Finn eksisterende review for denne tracken (idempotent).
      const existing = await pool.query(
        `SELECT id FROM audio_review_projects WHERE easeverse_track_id = $1 AND owner_user_id = $2
           AND status <> 'archived' ORDER BY created_at DESC LIMIT 1`, [trackId, s.userId]);
      if (existing.rowCount > 0) {
        return res.json({ reviewProjectId: existing.rows[0].id, created: false });
      }

      const keyMap: Record<string, string> = {};
      const created = await pool.query(
        `INSERT INTO audio_review_projects
           (owner_user_id, title, artist_name, band_name, genre, bpm, musical_key, status, easeverse_track_id, external_track_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$8) RETURNING id`,
        [s.userId, track.title || "Uten tittel", track.artist || null, track.artist || null,
         track.genre || null, track.bpm || null, track.musical_key || null, trackId]);
      const reviewId = created.rows[0].id;

      // Eier (produsent) + collaborators → medlemmer (idempotent på navn).
      const PALETTE = ["#FF6B35", "#9b59b6", "#3fa7d6", "#e0a955", "#5fb88a", "#e0606a", "#8aa0b6"];
      const collaborators: string[] = Array.isArray(track.collaborators)
        ? track.collaborators
        : (() => { try { return JSON.parse(track.collaborators || "[]"); } catch { return []; } })();
      const names = [{ name: s.name || "Produsent", role: "Produsent", owner: true }];
      collaborators.forEach((c) => { const nm = String(c).trim(); if (nm) names.push({ name: nm, role: "Bidragsyter", owner: false }); });
      let i = 0;
      for (const m of names) {
        const token = m.owner ? null : makeInviteToken();
        await pool.query(
          `INSERT INTO audio_review_members (project_id, name, role, avatar_color, is_owner, order_index, invite_token, invite_status, invited_at, invite_expires_at)
           SELECT $1::uuid,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $7::text IS NULL THEN NULL ELSE NOW() END, CASE WHEN $7::text IS NULL THEN NULL ELSE NOW() + INTERVAL '90 days' END
            WHERE NOT EXISTS (SELECT 1 FROM audio_review_members WHERE project_id = $1::uuid AND name = $2)`,
          [reviewId, m.name, m.role, PALETTE[i % PALETTE.length], m.owner, i, token, m.owner ? "owner" : "pending"]); i++;
      }
      keyMap; // (reservert for fremtidig seksjons-map)
      return res.status(201).json({ reviewProjectId: reviewId, created: true });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] send-to-review failed:", e);
      return res.status(500).json({ error: "send_to_review_failed" });
    }
  });

  // ── Rediger tekst fra studioet → lokal + push til EaseVerse (toveis) ───────
  app.put("/api/audio-showcases/:id/lyrics", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const lyrics = typeof req.body?.lyrics === "string" ? req.body.lyrics : null;
    if (lyrics === null) return res.status(400).json({ error: "lyrics_required" });
    try {
      const track = await loadLinkedTrack(id, s.userId);
      if (track?.notFound) return res.status(404).json({ error: "not_found" });
      if (!track) return res.status(409).json({ error: "no_linked_track" });
      const r = await pool.query(
        `UPDATE easeverse_tracks SET lyrics = $2, lyrics_updated_at = NOW(), updated_at = NOW()
           WHERE id = $1::uuid AND user_id = $3 RETURNING lyrics, lyrics_updated_at`,
        [track.id, lyrics.slice(0, 20000), s.userId]);
      if (r.rowCount === 0) return res.status(404).json({ error: "track_not_found" });
      const updatedAt = new Date(r.rows[0].lyrics_updated_at).toISOString();
      // Push til EaseVerse (toveis). Blokkerer ikke svaret på ekstern feil.
      const collaborators = Array.isArray(track.collaborators) ? track.collaborators
        : (() => { try { return JSON.parse(track.collaborators || "[]"); } catch { return []; } })();
      const push = await evPushLyrics({
        externalTrackId: track.externalTrackId, title: track.title || "Uten tittel",
        artist: track.artist || undefined, bpm: track.bpm || undefined,
        lyrics: lyrics.slice(0, 20000), collaborators, source: "creatorhub", updatedAt,
      });
      return res.json({
        ok: true, lyrics: r.rows[0].lyrics, updatedAt,
        connection: { easeverseConfigured: push.configured, reachable: push.reachable, latencyMs: push.latencyMs ?? null },
      });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_lyrics_failed" });
    }
  });

  // ── Synk-status: lokal tekst + EaseVerse-tilkobling + om ekstern er nyere ──
  app.get("/api/audio-showcases/:id/lyrics-sync", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const track = await loadLinkedTrack(id, s.userId);
      if (track?.notFound) return res.status(404).json({ error: "not_found" });
      if (!track) return res.json({ linked: false, connection: { easeverseConfigured: Boolean(EV_URL), reachable: false } });
      const localUpdatedAt = track.lyrics_updated_at ? new Date(track.lyrics_updated_at).toISOString() : null;
      const remote = await evGetLyrics(track.externalTrackId);
      const remoteUpdatedAt = remote.item?.updatedAt || null;
      const remoteNewer = Boolean(remoteUpdatedAt && (!localUpdatedAt || Date.parse(remoteUpdatedAt) > Date.parse(localUpdatedAt)));
      return res.json({
        linked: true, lyrics: track.lyrics || "", updatedAt: localUpdatedAt, title: track.title,
        connection: { easeverseConfigured: remote.configured, reachable: remote.reachable, latencyMs: remote.latencyMs ?? null, lastCheckedAt: new Date().toISOString() },
        remote: { present: Boolean(remote.item), updatedAt: remoteUpdatedAt, newer: remoteNewer },
      });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "lyrics_sync_status_failed" });
    }
  });

  // ── Reconcile nå (last-write-wins): pull hvis ekstern nyere, ellers push ───
  app.post("/api/audio-showcases/:id/lyrics-sync", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const track = await loadLinkedTrack(id, s.userId);
      if (track?.notFound) return res.status(404).json({ error: "not_found" });
      if (!track) return res.status(409).json({ error: "no_linked_track" });
      const localUpdatedAt = track.lyrics_updated_at ? new Date(track.lyrics_updated_at).toISOString() : null;
      const remote = await evGetLyrics(track.externalTrackId);
      const remoteUpdatedAt = remote.item?.updatedAt || null;
      const collaborators = Array.isArray(track.collaborators) ? track.collaborators
        : (() => { try { return JSON.parse(track.collaborators || "[]"); } catch { return []; } })();

      if (remote.configured && !remote.reachable) {
        return res.json({ applied: "offline", lyrics: track.lyrics || "", updatedAt: localUpdatedAt,
          connection: { easeverseConfigured: true, reachable: false, latencyMs: remote.latencyMs ?? null } });
      }
      // Ekstern nyere → pull inn lokalt.
      if (remoteUpdatedAt && (!localUpdatedAt || Date.parse(remoteUpdatedAt) > Date.parse(localUpdatedAt))) {
        const r = await pool.query(
          `UPDATE easeverse_tracks SET lyrics = $2, lyrics_updated_at = $3::timestamptz, updated_at = NOW()
             WHERE id = $1::uuid AND user_id = $4 RETURNING lyrics, lyrics_updated_at`,
          [track.id, String(remote.item.lyrics || "").slice(0, 20000), remoteUpdatedAt, s.userId]);
        return res.json({ applied: "pulled", lyrics: r.rows[0].lyrics, updatedAt: new Date(r.rows[0].lyrics_updated_at).toISOString(),
          connection: { easeverseConfigured: true, reachable: true, latencyMs: remote.latencyMs ?? null } });
      }
      // Lokal nyere / ekstern mangler → push ut.
      const push = await evPushLyrics({
        externalTrackId: track.externalTrackId, title: track.title || "Uten tittel", artist: track.artist || undefined,
        bpm: track.bpm || undefined, lyrics: String(track.lyrics || ""), collaborators, source: "creatorhub",
        updatedAt: localUpdatedAt || new Date().toISOString(),
      });
      return res.json({ applied: push.reachable ? "pushed" : "offline", lyrics: track.lyrics || "", updatedAt: localUpdatedAt,
        connection: { easeverseConfigured: push.configured, reachable: push.reachable, latencyMs: push.latencyMs ?? null } });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "lyrics_sync_failed" });
    }
  });

  // ── Live tekst-strøm (SSE) — auto-reconnect, heartbeat, graceful offline ───
  app.get("/api/audio-showcases/:id/lyrics-stream", async (req, res) => {
    // EventSource kan ikke sette headere → token via query.
    const qToken = typeof req.query.token === "string" ? req.query.token : "";
    const authedReq = qToken ? { ...req, headers: { ...req.headers, authorization: `Bearer ${qToken}` } } : req;
    const s = requireUserSession(authedReq as any, res); if (!s) return;
    const id = str(req.params.id, 64);
    const track = await loadLinkedTrack(id, s.userId).catch(() => null);
    if (!track || track.notFound) { res.status(404).json({ error: "not_found" }); return; }

    res.writeHead(200, {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive", "X-Accel-Buffering": "no",
    });
    const send = (event: string, data: unknown) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* socket lukket */ } };

    let lastUpdatedAt = track.lyrics_updated_at ? new Date(track.lyrics_updated_at).toISOString() : null;
    send("snapshot", { lyrics: track.lyrics || "", updatedAt: lastUpdatedAt, title: track.title });

    let closed = false;
    const poll = async () => {
      if (closed) return;
      try {
        const t = await loadLinkedTrack(id, s.userId);
        if (!t || t.notFound) return;
        const remote = await evGetLyrics(t.externalTrackId);
        if (!remote.configured) { send("status", { easeverseConfigured: false, reachable: false }); return; }
        if (!remote.reachable) { send("status", { easeverseConfigured: true, reachable: false }); return; }
        const remoteUpdatedAt = remote.item?.updatedAt || null;
        const localUpdatedAt = t.lyrics_updated_at ? new Date(t.lyrics_updated_at).toISOString() : null;
        // Ekstern nyere → pull inn lokalt + push til klient.
        if (remoteUpdatedAt && (!localUpdatedAt || Date.parse(remoteUpdatedAt) > Date.parse(localUpdatedAt))) {
          await pool.query(
            `UPDATE easeverse_tracks SET lyrics = $2, lyrics_updated_at = $3::timestamptz, updated_at = NOW() WHERE id = $1::uuid AND user_id = $4`,
            [t.id, String(remote.item.lyrics || "").slice(0, 20000), remoteUpdatedAt, s.userId]).catch(() => {});
          lastUpdatedAt = remoteUpdatedAt;
          send("update", { lyrics: String(remote.item.lyrics || ""), updatedAt: remoteUpdatedAt, source: "easeverse", reachable: true });
        } else {
          send("status", { easeverseConfigured: true, reachable: true });
        }
      } catch { send("status", { easeverseConfigured: Boolean(EV_URL), reachable: false }); }
    };
    const pollTimer = setInterval(() => { void poll(); }, 4000);
    const beat = setInterval(() => send("ping", { t: Date.now() }), 15000);
    void poll();
    req.on("close", () => { closed = true; clearInterval(pollTimer); clearInterval(beat); try { res.end(); } catch { /* */ } });
  });

  // ── Prosjekt-redigering (cover-bilde + meta) ──────────────────────────────
  app.patch("/api/audio-showcases/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const map: Array<[string, string, number]> = [
      ["coverUrl", "cover_url", 3_000_000], ["title", "title", 200], ["bandName", "band_name", 200],
      ["artistName", "artist_name", 200], ["genre", "genre", 120], ["musicalKey", "musical_key", 40],
    ];
    const sets: string[] = ["updated_at = NOW()"]; const params: unknown[] = [id, s.userId];
    for (const [body, col, max] of map) {
      if (typeof req.body?.[body] === "string") { params.push(str(req.body[body], max)); sets.push(`${col} = $${params.length}`); }
    }
    if (typeof req.body?.bpm !== "undefined") { params.push(num(req.body.bpm)); sets.push(`bpm = $${params.length}`); }
    if (params.length === 2) return res.status(400).json({ error: "nothing_to_update" });
    try {
      const r = await pool.query(
        `UPDATE audio_review_projects SET ${sets.join(", ")} WHERE id = $1::uuid AND owner_user_id = $2 RETURNING *`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "update_project_failed" });
    }
  });

  // ── Profil → Split Sheet: generer royalty-splitt fra review-medlemmene ─────
  // Les koblet splittark + parter (for redigering i studioet).
  app.get("/api/audio-showcases/:id/split-sheet", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const ss = await pool.query(
        `SELECT id, status, total_percentage FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]);
      if (ss.rowCount === 0) return res.json({ exists: false });
      const c = await pool.query(
        `SELECT id, name, email, role, percentage, signed_at, custom_fields FROM split_sheet_contributors WHERE split_sheet_id=$1 ORDER BY order_index ASC`, [ss.rows[0].id]);
      const signedCount = c.rows.filter((r) => r.signed_at).length;
      return res.json({ exists: true, splitSheetId: ss.rows[0].id, status: ss.rows[0].status, totalPercentage: Number(ss.rows[0].total_percentage),
        contributors: c.rows, signedCount, allSigned: signedCount === c.rowCount && c.rowCount > 0, url: `/crm?splitSheet=${ss.rows[0].id}` });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ exists: false });
      return res.status(500).json({ error: "split_sheet_read_failed" });
    }
  });

  // Oppdater avtale-vilkår (master/komposisjon-royalty + sats) på koblet splittark.
  // Master-% = split_sheet_contributors.percentage (trigger 0–100); komposisjon
  // + honorar lagres i custom_fields. Låst hvis noen har signert.
  app.patch("/api/audio-showcases/:id/split-sheet", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const splits: any[] = Array.isArray(req.body?.contributors) ? req.body.contributors : [];
    if (!splits.length) return res.status(400).json({ error: "contributors_required" });
    try {
      const ss = await pool.query(
        `SELECT id FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]);
      if (ss.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const ssId = ss.rows[0].id;
      // Lås: kan ikke endre vilkår etter at noen har signert (juridisk integritet).
      const signed = await pool.query(`SELECT COUNT(*)::int AS n FROM split_sheet_contributors WHERE split_sheet_id=$1 AND signed_at IS NOT NULL`, [ssId]);
      if (signed.rows[0].n > 0) return res.status(409).json({ error: "locked_signed", message: "Avtalen er signert av minst én part og er låst. Lås opp for å endre (krever ny signering)." });

      const clean = splits.map((c) => ({
        id: str(c.id, 64),
        master: Math.max(0, Math.min(100, Number(c.masterPct ?? c.percentage) || 0)),
        comp: Math.max(0, Math.min(100, Number(c.compositionPct) || 0)),
        feeAmount: Number(c.feeAmount) > 0 ? Number(c.feeAmount) : null,
        feeCurrency: str(c.feeCurrency, 8) || "NOK",
        feeType: ["royalty", "session", "buyout", "hourly"].includes(c.feeType) ? c.feeType : "royalty",
      }));
      const masterTotal = Math.round(clean.reduce((a, c) => a + c.master, 0) * 100) / 100;
      const compTotal = Math.round(clean.reduce((a, c) => a + c.comp, 0) * 100) / 100;
      if (masterTotal > 100.01) return res.status(400).json({ error: "master_exceeds_100", total: masterTotal });
      await pool.query(`UPDATE split_sheet_contributors SET percentage=0 WHERE split_sheet_id=$1::uuid`, [ssId]);
      for (const c of clean) {
        await pool.query(
          `UPDATE split_sheet_contributors
             SET percentage=$2, updated_at=NOW(),
                 custom_fields = COALESCE(custom_fields,'{}'::jsonb) || $4::jsonb
           WHERE id=$1::uuid AND split_sheet_id=$3::uuid`,
          [c.id, c.master, ssId, JSON.stringify({ compositionPct: c.comp, feeAmount: c.feeAmount, feeCurrency: c.feeCurrency, feeType: c.feeType })]);
      }
      return res.json({ ok: true, masterTotal, compTotal, masterBalanced: Math.abs(masterTotal - 100) < 0.01, compBalanced: Math.abs(compTotal - 100) < 0.01 });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] split-sheet patch failed:", e);
      return res.status(500).json({ error: "split_sheet_update_failed" });
    }
  });

  // Lås opp (fjern alle signaturer) for å kunne endre vilkår på nytt.
  app.post("/api/audio-showcases/:id/split-sheet/unlock", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const ss = await pool.query(`SELECT id FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]);
      if (ss.rowCount === 0) return res.status(404).json({ error: "not_found" });
      await pool.query(`UPDATE split_sheet_contributors SET signed_at=NULL, signature_data=NULL, updated_at=NOW() WHERE split_sheet_id=$1`, [ss.rows[0].id]);
      await pool.query(`UPDATE split_sheets SET status='draft', updated_at=NOW() WHERE id=$1`, [ss.rows[0].id]);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "unlock_failed" });
    }
  });

  // Juridisk signering av en part: samtykke + revisjonslogg (IP/tid) + snapshot
  // av nøyaktig hva som ble signert. Setter status når alle har signert.
  async function signContributor(ssId: string, contributorId: string, signerName: string, ip: string, ua: string): Promise<any | null> {
    const cur = await pool.query(`SELECT id, name, percentage, custom_fields FROM split_sheet_contributors WHERE id=$1::uuid AND split_sheet_id=$2::uuid LIMIT 1`, [contributorId, ssId]);
    if (cur.rowCount === 0) return null;
    const c = cur.rows[0];
    const snapshot = { masterPct: Number(c.percentage), compositionPct: c.custom_fields?.compositionPct ?? null, feeAmount: c.custom_fields?.feeAmount ?? null, feeCurrency: c.custom_fields?.feeCurrency ?? null, feeType: c.custom_fields?.feeType ?? null, contributions: c.custom_fields?.contributions ?? [] };
    const sig = { name: signerName, consent: true, at: new Date().toISOString(), ip, userAgent: (ua || "").slice(0, 300), snapshot };
    const r = await pool.query(`UPDATE split_sheet_contributors SET signed_at=NOW(), signature_data=$3::jsonb, updated_at=NOW() WHERE id=$1::uuid AND split_sheet_id=$2::uuid RETURNING id, name, signed_at`, [contributorId, ssId, JSON.stringify(sig)]);
    // Sett status når alle har signert.
    const counts = await pool.query(`SELECT COUNT(*)::int total, COUNT(signed_at)::int signed FROM split_sheet_contributors WHERE split_sheet_id=$1`, [ssId]);
    const { total, signed } = counts.rows[0];
    await pool.query(`UPDATE split_sheets SET status=$2, updated_at=NOW() WHERE id=$1`, [ssId, signed >= total ? "completed" : "pending_signatures"]);
    return { ...r.rows[0], allSigned: signed >= total };
  }

  app.post("/api/audio-showcases/:id/split-sheet/sign", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    const contributorId = str(req.body?.contributorId, 64);
    const signature = str(req.body?.signature, 200);
    if (!contributorId || !signature) return res.status(400).json({ error: "contributorId_and_signature_required" });
    if (req.body?.consent !== true) return res.status(400).json({ error: "consent_required" });
    try {
      const ss = await pool.query(`SELECT id FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]);
      if (ss.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const out = await signContributor(ss.rows[0].id, contributorId, signature, clientIp(req), String(req.headers["user-agent"] || ""));
      if (!out) return res.status(404).json({ error: "contributor_not_found" });
      return res.json({ ok: true, signed: out });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "sign_failed" });
    }
  });

  app.post("/api/audio-showcases/:id/split-sheet", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const id = str(req.params.id, 64);
    try {
      const p = await pool.query(
        `SELECT id, title, easeverse_track_id FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [id, s.userId]);
      if (p.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const project = p.rows[0];
      const m = await pool.query(
        `SELECT name, email, role, contributions FROM audio_review_members WHERE project_id=$1::uuid ORDER BY is_owner DESC, order_index ASC`, [id]);
      const members = m.rows;
      if (members.length === 0) return res.status(409).json({ error: "no_members" });

      // Idempotent: gjenbruk eksisterende split sheet for denne reviewen.
      const existing = await pool.query(
        `SELECT id FROM split_sheets WHERE user_id=$1 AND metadata->>'sourceReviewId'=$2 LIMIT 1`, [s.userId, id]).catch(() => ({ rows: [] as any[] }));
      if (existing.rows && existing.rows.length) return res.json({ splitSheetId: existing.rows[0].id, created: false, url: `/crm?splitSheet=${existing.rows[0].id}` });

      // Lik fordeling, rest til første.
      const base = Math.floor((10000 / members.length)) / 100; // 2 desimaler
      const pcts = members.map(() => base);
      pcts[0] = Math.round((100 - base * (members.length - 1)) * 100) / 100;

      // Map fri-tekst medlems-rolle → gyldig split_sheet_contributors-rolle.
      const mapRole = (r: string): string => {
        const x = (r || "").toLowerCase();
        if (/produsent|producer/.test(x)) return "producer";
        if (/vokal|vocal|sang/.test(x)) return "vocalist";
        if (/tekst|lyric/.test(x)) return "lyricist";
        if (/kompon|compos/.test(x)) return "composer";
        if (/mastering|master\b/.test(x)) return "mastering_engineer";
        if (/mix/.test(x)) return "mix_engineer";
        if (/arrang/.test(x)) return "arranger";
        if (/gitar|bass|trommer|instrument|guitar|drum|piano|keys|synth/.test(x)) return "instrumentalist";
        if (/manager|label/.test(x)) return "label";
        if (/artist/.test(x)) return "artist";
        return "collaborator";
      };
      const ssId = randomUUID();
      await pool.query(
        `INSERT INTO split_sheets (id, user_id, project_id, track_id, title, description, status, total_percentage, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,'draft',100,$7::jsonb)`,
        [ssId, s.userId, null, project.easeverse_track_id || null, `${project.title} — splittark`,
         "Generert fra Audio Showcase review-medlemmer", JSON.stringify({ sourceReviewId: id })]);
      let i = 0;
      for (const mem of members) {
        await pool.query(
          `INSERT INTO split_sheet_contributors (id, split_sheet_id, name, email, role, percentage, order_index, user_id, custom_fields)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [randomUUID(), ssId, mem.name, mem.email || null, mapRole(mem.role), pcts[i], i, null,
           JSON.stringify({ memberRole: mem.role || null, contributions: Array.isArray(mem.contributions) ? mem.contributions : [] })]); i++;
      }
      return res.status(201).json({ splitSheetId: ssId, created: true, contributors: members.length, url: `/crm?splitSheet=${ssId}` });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] split-sheet gen failed:", e);
      return res.status(500).json({ error: "split_sheet_failed" });
    }
  });

  // ── DAW-markører fra EaseVerse → seksjoner på en versjon (Fase 2) ─────────
  app.post("/api/audio-versions/:id/pull-sections", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    const versionId = str(req.params.id, 64);
    try {
      const own = await pool.query(
        `SELECT v.id, v.duration, p.external_track_id, p.easeverse_track_id
           FROM audio_review_versions v JOIN audio_review_projects p ON p.id = v.project_id
          WHERE v.id = $1::uuid AND p.owner_user_id = $2 LIMIT 1`, [versionId, s.userId]);
      if (own.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const extId = own.rows[0].external_track_id || own.rows[0].easeverse_track_id;
      if (!extId) return res.status(409).json({ error: "no_linked_track" });
      const remote = await evGetProtools(extId);
      if (!remote.configured) return res.status(503).json({ error: "easeverse_not_configured" });
      if (!remote.reachable) return res.status(502).json({ error: "easeverse_unreachable" });
      const markers: any[] = Array.isArray(remote.item?.markers) ? remote.item.markers : [];
      if (!markers.length) return res.json({ applied: "no_markers", sections: [] });
      const sorted = [...markers].filter((m) => Number.isFinite(Number(m?.positionMs))).sort((a, b) => a.positionMs - b.positionMs);
      const dur = Number(own.rows[0].duration) || (sorted.length ? sorted[sorted.length - 1].positionMs / 1000 + 30 : 0);
      await pool.query(`DELETE FROM audio_review_sections WHERE version_id = $1::uuid`, [versionId]);
      let i = 0;
      for (const m of sorted) {
        const startSec = Number(m.positionMs) / 1000;
        const endSec = i < sorted.length - 1 ? Number(sorted[i + 1].positionMs) / 1000 : dur;
        const type = String(m.sectionType || "").toLowerCase();
        await pool.query(
          `INSERT INTO audio_review_sections (version_id, name, start_time_seconds, end_time_seconds, color, order_index)
           VALUES ($1::uuid,$2,$3,$4,$5,$6)`,
          [versionId, str(m.label, 80) || `Del ${i + 1}`, startSec, endSec, PT_SECTION_COLOR[type] || null, i]); i++;
      }
      const out = await pool.query(`SELECT * FROM audio_review_sections WHERE version_id = $1::uuid ORDER BY order_index ASC`, [versionId]);
      return res.json({ applied: "pulled", count: out.rowCount, sections: out.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      console.error("[audio-showcase] pull-sections failed:", e);
      return res.status(500).json({ error: "pull_sections_failed" });
    }
  });

  // ── Member-tilgang via invite-token: se review + kommenter (ikke eier) ─────
  // Token = tilgang. Bidragsyteren kan se versjoner/waveform/tekst + kommentere,
  // men ikke godkjenne/laste opp/invitere.
  async function resolveSharedMember(token: string): Promise<any | null> {
    const r = await pool.query(
      `SELECT m.id AS member_id, m.name, m.role, m.project_id, p.* FROM audio_review_members m
         JOIN audio_review_projects p ON p.id = m.project_id
        WHERE m.invite_token = $1 AND (m.invite_expires_at IS NULL OR m.invite_expires_at > NOW()) LIMIT 1`, [token]);
    return r.rows[0] || null;
  }

  app.get("/api/audio-review-shared/:token", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const [v, members, tasks] = await Promise.all([
        pool.query(`SELECT * FROM audio_review_versions WHERE project_id = $1::uuid ORDER BY version_number ASC`, [ctx.project_id]),
        pool.query(`SELECT id, name, role, instrument, avatar_color, avatar_url, is_owner, invite_status, contributions FROM audio_review_members WHERE project_id = $1::uuid ORDER BY is_owner DESC, order_index ASC`, [ctx.project_id]),
        pool.query(`SELECT * FROM audio_review_tasks WHERE project_id = $1::uuid ORDER BY order_index ASC`, [ctx.project_id]).catch(() => ({ rows: [] })),
      ]);
      let easeverseTrack: any = null;
      if (ctx.easeverse_track_id) {
        const t = await pool.query(`SELECT id, title, status, lyrics FROM easeverse_tracks WHERE id = $1::uuid LIMIT 1`, [ctx.easeverse_track_id]).catch(() => ({ rows: [] as any[] }));
        easeverseTrack = t.rows[0] || null;
      }
      const project = { id: ctx.id, title: ctx.title, band_name: ctx.band_name, artist_name: ctx.artist_name, genre: ctx.genre, bpm: ctx.bpm, musical_key: ctx.musical_key, status: ctx.status, cover_url: ctx.cover_url, created_at: ctx.created_at, easeverse_track_id: ctx.easeverse_track_id };
      return res.json({ project, versions: v.rows, members: members.rows, tasks: tasks.rows, easeverseTrack, viewer: { memberId: ctx.member_id, name: ctx.name, role: ctx.role }, readonly: true });
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "shared_get_failed" });
    }
  });

  app.get("/api/audio-review-shared/:token/version/:vid", async (req, res) => {
    const token = str(req.params.token, 80); const vid = str(req.params.vid, 64);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const v = await pool.query(`SELECT * FROM audio_review_versions WHERE id = $1::uuid AND project_id = $2::uuid LIMIT 1`, [vid, ctx.project_id]);
      if (v.rowCount === 0) return res.status(404).json({ error: "version_not_found" });
      const [comments, sections] = await Promise.all([
        pool.query(`SELECT * FROM audio_review_comments WHERE version_id = $1::uuid ORDER BY timecode_seconds ASC, created_at ASC`, [vid]),
        pool.query(`SELECT * FROM audio_review_sections WHERE version_id = $1::uuid ORDER BY order_index ASC`, [vid]),
      ]);
      return res.json({ version: v.rows[0], comments: comments.rows, sections: sections.rows });
    } catch (e) {
      if (isMissingTable(e)) return res.status(404).json({ error: "not_found" });
      return res.status(500).json({ error: "shared_version_failed" });
    }
  });

  app.post("/api/audio-review-shared/:token/comments", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    if (rateLimited(`shc:${clientIp(req)}`)) return res.status(429).json({ error: "rate_limited" });
    const versionId = str(req.body?.versionId, 64);
    const body = str(req.body?.body, 4000);
    if (!versionId || !body) return res.status(400).json({ error: "versionId_and_body_required" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const owns = await pool.query(`SELECT 1 FROM audio_review_versions WHERE id=$1::uuid AND project_id=$2::uuid LIMIT 1`, [versionId, ctx.project_id]);
      if (owns.rowCount === 0) return res.status(404).json({ error: "version_not_found" });
      const r = await pool.query(
        `INSERT INTO audio_review_comments (version_id, user_id, author, author_role, timecode_seconds, body, category, section_ref)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [versionId, `member:${ctx.member_id}`, ctx.name, ctx.role, num(req.body?.timecodeSeconds) ?? 0, body,
         str(req.body?.category, 40) || "general", str(req.body?.sectionRef, 120) || null]);
      return res.status(201).json(r.rows[0]);
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "shared_comment_failed" });
    }
  });

  app.post("/api/audio-review-shared/:token/comments/:id/like", async (req, res) => {
    const token = str(req.params.token, 80); const id = str(req.params.id, 64);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const r = await pool.query(
        `UPDATE audio_review_comments SET like_count = like_count + 1, updated_at = NOW()
          WHERE id = $1::uuid AND version_id IN (SELECT id FROM audio_review_versions WHERE project_id = $2::uuid) RETURNING *`, [id, ctx.project_id]);
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json(r.rows[0]);
    } catch (e) {
      return res.status(500).json({ error: "shared_like_failed" });
    }
  });

  // Member: se din egen avtale-andel (vilkår) + signér den selv (juridisk).
  app.get("/api/audio-review-shared/:token/agreement", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const ss = await pool.query(`SELECT id, status FROM split_sheets WHERE metadata->>'sourceReviewId'=$1 LIMIT 1`, [ctx.project_id]);
      if (ss.rowCount === 0) return res.json({ exists: false });
      const all = await pool.query(`SELECT id, name, role, percentage, signed_at, custom_fields FROM split_sheet_contributors WHERE split_sheet_id=$1 ORDER BY order_index ASC`, [ss.rows[0].id]);
      const mine = all.rows.find((r) => r.name === ctx.name) || null;
      return res.json({ exists: true, status: ss.rows[0].status, contributors: all.rows, mine, viewer: { name: ctx.name } });
    } catch (e) {
      if (isMissingTable(e)) return res.json({ exists: false });
      return res.status(500).json({ error: "agreement_read_failed" });
    }
  });

  app.post("/api/audio-review-shared/:token/sign", async (req, res) => {
    const token = str(req.params.token, 80);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    if (rateLimited(`sign:${clientIp(req)}`)) return res.status(429).json({ error: "rate_limited" });
    const signature = str(req.body?.signature, 200);
    if (!signature) return res.status(400).json({ error: "signature_required" });
    if (req.body?.consent !== true) return res.status(400).json({ error: "consent_required" });
    try {
      const ctx = await resolveSharedMember(token);
      if (!ctx) return res.status(404).json({ error: "not_found" });
      const ss = await pool.query(`SELECT id FROM split_sheets WHERE metadata->>'sourceReviewId'=$1 LIMIT 1`, [ctx.project_id]);
      if (ss.rowCount === 0) return res.status(409).json({ error: "no_split_sheet" });
      const c = await pool.query(`SELECT id FROM split_sheet_contributors WHERE split_sheet_id=$1 AND name=$2 LIMIT 1`, [ss.rows[0].id, ctx.name]);
      if (c.rowCount === 0) return res.status(404).json({ error: "not_a_party" });
      const out = await signContributor(ss.rows[0].id, c.rows[0].id, signature, clientIp(req), String(req.headers["user-agent"] || ""));
      return res.json({ ok: true, signed: out });
    } catch (e) {
      if (isMissingTable(e)) return res.status(503).json({ error: "migration_pending" });
      return res.status(500).json({ error: "shared_sign_failed" });
    }
  });
}
