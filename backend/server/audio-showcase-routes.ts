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

export function setupAudioShowcaseRoutes(deps: AudioShowcaseDeps): void {
  const { app, pool, requireUserSession } = deps;

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
        `INSERT INTO audio_review_projects (owner_user_id, showcase_id, title, artist_name, band_name, genre, bpm, musical_key, deadline)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [s.userId, str(req.body?.showcaseId, 200) || null, title, str(req.body?.artistName, 200) || null,
         str(req.body?.bandName, 200) || null, str(req.body?.genre, 120) || null, num(req.body?.bpm),
         str(req.body?.musicalKey, 40) || null, str(req.body?.deadline, 40) || null],
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
      const v = await pool.query(
        `SELECT * FROM audio_review_versions WHERE project_id = $1::uuid ORDER BY version_number ASC`, [id]);
      return res.json({ project: p.rows[0], versions: v.rows });
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
           (version_id, parent_comment_id, user_id, author, timecode_seconds, body, category, is_decision)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [versionId, str(req.body?.parentCommentId, 64) || null, s.userId, s.name || s.email || "Bruker",
         num(req.body?.timecodeSeconds) ?? num(req.body?.timecode) ?? 0, body,
         str(req.body?.category, 40) || "general", Boolean(req.body?.isDecision)],
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
}
