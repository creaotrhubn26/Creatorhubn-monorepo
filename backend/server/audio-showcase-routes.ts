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
      const r = await pool.query(
        `INSERT INTO audio_review_members (project_id, user_id, name, role, avatar_color, is_owner, order_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, str(req.body?.userId, 200) || null, name, str(req.body?.role, 80) || null,
         str(req.body?.avatarColor, 40) || PALETTE[n % PALETTE.length], Boolean(req.body?.isOwner), n]);
      return res.status(201).json(r.rows[0]);
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
        await pool.query(
          `INSERT INTO audio_review_members (project_id, name, role, avatar_color, is_owner, order_index)
           SELECT $1::uuid,$2,$3,$4,$5,$6
            WHERE NOT EXISTS (SELECT 1 FROM audio_review_members WHERE project_id = $1::uuid AND name = $2)`,
          [reviewId, m.name, m.role, PALETTE[i % PALETTE.length], m.owner, i]); i++;
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
}
