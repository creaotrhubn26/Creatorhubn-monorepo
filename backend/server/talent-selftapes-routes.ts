/**
 * talent-selftapes-routes.ts
 *
 * Self-Tape Studio backend (Fase A av spec).
 *
 * Datamodell (migrate 234-236):
 *   talent_selftape_projects, talent_selftape_takes,
 *   talent_selftape_ai_feedback, talent_selftape_submissions,
 *   talent_selftape_submission_events
 *
 * Demo-modus: ?demo=1 → demo-talent (Ingrid Nilsen) Northern Lights-prosjekt
 * med 5 takes, AI-feedback for take 3, 3 submission-targets (mockup #15).
 *
 * Spec: docs/specs/SELF_TAPE_STUDIO_SPEC.md
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface TalentSelftapesRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

const DEMO_TALENT_ID = "11111111-1111-1111-1111-111111111111";

function isDemoRequest(req: express.Request): boolean {
  return req.query?.demo === "1" || req.query?.demo === "true";
}

/** Hent talent_id for innlogget bruker (eller demo-talent ved ?demo=1). */
async function resolveTalentId(
  pool: Pool,
  req: express.Request,
  session: SessionLike | null,
): Promise<string | null> {
  if (isDemoRequest(req)) return DEMO_TALENT_ID;
  if (!session?.userId) return null;
  const r = await pool.query(
    `SELECT id::text FROM talents WHERE user_id = $1 LIMIT 1`,
    [session.userId],
  );
  return r.rows[0]?.id ?? null;
}

export function setupTalentSelftapesRoutes(deps: TalentSelftapesRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET /projects — alle mine self-tape-prosjekter ──────────────
  app.get("/api/role-room/talents/selftapes/projects", async (req, res) => {
    const session = getActiveSession(req);
    const talentId = await resolveTalentId(pool, req, session);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
    const demo = isDemoRequest(req);
    try {
      const r = await pool.query(
        `SELECT p.id::text, p.name, p.poster_url, p.poster_color, p.status,
                p.role_name, p.role_type, p.scene_label, p.sides_pages,
                p.current_take_id::text, p.created_at, p.updated_at,
                (SELECT COUNT(*)::int FROM talent_selftape_takes t
                  WHERE t.project_id = p.id AND t.status = 'ready') AS takes_count
           FROM talent_selftape_projects p
          WHERE p.talent_id = $1::uuid
            AND COALESCE(p.is_demo, FALSE) = ${demo ? "TRUE" : "FALSE"}
          ORDER BY p.updated_at DESC`,
        [talentId],
      );
      return res.json({ projects: r.rows });
    } catch (err) {
      console.error("[selftapes/projects GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente prosjekter" });
    }
  });

  // ── GET /projects/:id — full prosjekt-state ──────────────────────
  app.get("/api/role-room/talents/selftapes/projects/:id", async (req, res) => {
    const session = getActiveSession(req);
    const talentId = await resolveTalentId(pool, req, session);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const proj = await pool.query(
        `SELECT p.*, p.id::text AS id, p.current_take_id::text AS current_take_id
           FROM talent_selftape_projects p
          WHERE p.id = $1::uuid AND p.talent_id = $2::uuid LIMIT 1`,
        [req.params.id, talentId],
      );
      const project = proj.rows[0];
      if (!project) return res.status(404).json({ error: "Prosjekt ikke funnet" });

      // Hent takes, current feedback, submissions parallelt
      const [takesR, feedbackR, subsR] = await Promise.all([
        pool.query(
          `SELECT t.id::text, t.take_number, t.duration_ms, t.thumbnail_url,
                  t.video_url, t.stream_uid, t.hls_manifest, t.status, t.notes,
                  t.metadata, t.ai_feedback_id::text, t.recorded_at, t.created_at
             FROM talent_selftape_takes t
            WHERE t.project_id = $1::uuid
            ORDER BY t.take_number ASC`,
          [project.id],
        ),
        project.current_take_id
          ? pool.query(
              `SELECT f.*, f.id::text, f.take_id::text
                 FROM talent_selftape_ai_feedback f
                 JOIN talent_selftape_takes t ON t.ai_feedback_id = f.id
                WHERE t.id = $1::uuid LIMIT 1`,
              [project.current_take_id],
            )
          : Promise.resolve({ rows: [] }),
        pool.query(
          `SELECT s.id::text, s.target_type, s.enabled, s.status, s.deadline_at,
                  s.agency_org_id::text, s.agency_preferred, s.private_token,
                  s.casting_project_id, s.casting_role_id, s.submitted_at,
                  s.viewed_at, s.metadata,
                  a.name AS agency_name, a.logo_url AS agency_logo_url
             FROM talent_selftape_submissions s
             LEFT JOIN agency_orgs a ON a.id = s.agency_org_id
            WHERE s.project_id = $1::uuid AND s.enabled = TRUE
            ORDER BY s.created_at ASC`,
          [project.id],
        ),
      ]);

      return res.json({
        project,
        takes: takesR.rows,
        feedback: feedbackR.rows[0] ?? null,
        submissions: subsR.rows,
      });
    } catch (err) {
      console.error("[selftapes/projects/:id GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente prosjekt" });
    }
  });

  // ── POST /projects — opprett nytt prosjekt ───────────────────────
  app.post("/api/role-room/talents/selftapes/projects", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const talentId = await resolveTalentId(pool, req, session);
    if (!talentId) return res.status(403).json({ error: "Du har ingen talent-profil" });
    const { name, role_name, role_type, scene_label, sides_pages, sides_content,
            source_casting_project_id, source_partnership_id } =
      (req.body || {}) as Record<string, unknown>;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name er påkrevd" });
    }
    try {
      const r = await pool.query(
        `INSERT INTO talent_selftape_projects
           (talent_id, name, role_name, role_type, scene_label, sides_pages,
            sides_content, source_casting_project_id, source_partnership_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid)
         RETURNING *`,
        [talentId, name, role_name ?? null, role_type ?? null,
         scene_label ?? null, sides_pages ?? null, sides_content ?? null,
         source_casting_project_id ?? null, source_partnership_id ?? null],
      );
      return res.status(201).json({ project: r.rows[0] });
    } catch (err) {
      console.error("[selftapes/projects POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å opprette", detail: String(err) });
    }
  });

  // ── PATCH /projects/:id ──────────────────────────────────────────
  app.patch("/api/role-room/talents/selftapes/projects/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const talentId = await resolveTalentId(pool, req, session);
    if (!talentId) return res.status(403).json({ error: "Du har ingen talent-profil" });

    const allowed = ["name", "role_name", "role_type", "scene_label",
                     "sides_pages", "sides_content", "status", "poster_url",
                     "current_take_id"];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    for (const k of allowed) {
      const v = (req.body || {})[k];
      if (v !== undefined) {
        if (k === "current_take_id") {
          sets.push(`${k} = $${p++}::uuid`);
        } else {
          sets.push(`${k} = $${p++}`);
        }
        vals.push(v);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "Ingen felter å oppdatere" });
    vals.push(req.params.id, talentId);
    try {
      const r = await pool.query(
        `UPDATE talent_selftape_projects SET ${sets.join(", ")}
          WHERE id = $${p}::uuid AND talent_id = $${p + 1}::uuid
          RETURNING *`,
        vals,
      );
      if (!r.rowCount) return res.status(404).json({ error: "Prosjekt ikke funnet" });
      return res.json({ project: r.rows[0] });
    } catch (err) {
      console.error("[selftapes/projects PATCH] failed", err);
      return res.status(500).json({ error: "Kunne ikke oppdatere", detail: String(err) });
    }
  });

  // ── DELETE /projects/:id — soft delete ───────────────────────────
  app.delete("/api/role-room/talents/selftapes/projects/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const talentId = await resolveTalentId(pool, req, session);
    if (!talentId) return res.status(403).json({ error: "Du har ingen talent-profil" });
    try {
      const r = await pool.query(
        `UPDATE talent_selftape_projects
            SET status = 'archived'
          WHERE id = $1::uuid AND talent_id = $2::uuid RETURNING id::text`,
        [req.params.id, talentId],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Prosjekt ikke funnet" });
      return res.json({ archived: true });
    } catch (err) {
      console.error("[selftapes/projects DELETE] failed", err);
      return res.status(500).json({ error: "Sletting feilet" });
    }
  });

  // ── GET /projects/:projectId/takes — liste takes ────────────────
  app.get("/api/role-room/talents/selftapes/projects/:projectId/takes", async (req, res) => {
    const session = getActiveSession(req);
    const talentId = await resolveTalentId(pool, req, session);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      // Verifiser eierskap
      const owner = await pool.query(
        `SELECT 1 FROM talent_selftape_projects
          WHERE id = $1::uuid AND talent_id = $2::uuid LIMIT 1`,
        [req.params.projectId, talentId],
      );
      if (!owner.rowCount) return res.status(404).json({ error: "Prosjekt ikke funnet" });

      const r = await pool.query(
        `SELECT t.id::text, t.take_number, t.duration_ms, t.thumbnail_url,
                t.video_url, t.stream_uid, t.status, t.notes, t.metadata,
                t.ai_feedback_id::text, t.recorded_at, t.created_at
           FROM talent_selftape_takes t
          WHERE t.project_id = $1::uuid
          ORDER BY t.take_number ASC`,
        [req.params.projectId],
      );
      return res.json({ takes: r.rows });
    } catch (err) {
      console.error("[selftapes/takes GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente takes" });
    }
  });

  // ── POST /takes/init-upload — opprett rad + returner upload-info ─
  // Per Fase A: bare DB-rad. CF Stream-integrasjon kommer i Fase C.
  app.post("/api/role-room/talents/selftapes/projects/:projectId/takes/init-upload",
    async (req, res) => {
      const session = getActiveSession(req);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const talentId = await resolveTalentId(pool, req, session);
      if (!talentId) return res.status(403).json({ error: "Du har ingen talent-profil" });
      try {
        const owner = await pool.query(
          `SELECT 1 FROM talent_selftape_projects
            WHERE id = $1::uuid AND talent_id = $2::uuid LIMIT 1`,
          [req.params.projectId, talentId],
        );
        if (!owner.rowCount) return res.status(404).json({ error: "Prosjekt ikke funnet" });

        // Hent neste take_number
        const next = await pool.query(
          `SELECT COALESCE(MAX(take_number), 0) + 1 AS n
             FROM talent_selftape_takes WHERE project_id = $1::uuid`,
          [req.params.projectId],
        );
        const takeNumber = next.rows[0].n;

        const ins = await pool.query(
          `INSERT INTO talent_selftape_takes
             (project_id, take_number, status, duration_ms)
           VALUES ($1::uuid, $2, 'uploading', 0)
           RETURNING id::text, take_number, status`,
          [req.params.projectId, takeNumber],
        );

        // Fase A: returner take-id. Fase C legger til CF Stream signed URL.
        return res.status(201).json({
          take: ins.rows[0],
          upload: {
            // TODO Fase C: signed CF Stream upload URL
            provider: "stub",
            note: "Stream-integrasjon kommer i Fase C",
          },
        });
      } catch (err) {
        console.error("[selftapes/takes init-upload] failed", err);
        return res.status(500).json({ error: "Init feilet", detail: String(err) });
      }
    },
  );

  // ── POST /takes/finalize — marker som ready ──────────────────────
  app.post("/api/role-room/talents/selftapes/projects/:projectId/takes/finalize",
    async (req, res) => {
      const session = getActiveSession(req);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const { take_id, duration_ms, video_url, stream_uid, hls_manifest,
              thumbnail_url, metadata } = (req.body || {}) as Record<string, unknown>;
      if (!take_id) return res.status(400).json({ error: "take_id er påkrevd" });
      try {
        const r = await pool.query(
          `UPDATE talent_selftape_takes
              SET status = 'ready',
                  duration_ms = COALESCE($1, duration_ms),
                  video_url = COALESCE($2, video_url),
                  stream_uid = COALESCE($3, stream_uid),
                  hls_manifest = COALESCE($4, hls_manifest),
                  thumbnail_url = COALESCE($5, thumbnail_url),
                  metadata = COALESCE($6::jsonb, metadata)
            WHERE id = $7::uuid
            RETURNING *`,
          [duration_ms ?? null, video_url ?? null, stream_uid ?? null,
           hls_manifest ?? null, thumbnail_url ?? null,
           metadata ? JSON.stringify(metadata) : null, take_id],
        );
        if (!r.rowCount) return res.status(404).json({ error: "Take ikke funnet" });
        // Sett som current_take_id på prosjektet
        await pool.query(
          `UPDATE talent_selftape_projects
              SET current_take_id = $1::uuid
            WHERE id = (SELECT project_id FROM talent_selftape_takes WHERE id = $1::uuid)`,
          [take_id],
        );
        return res.json({ take: r.rows[0] });
      } catch (err) {
        console.error("[selftapes/takes finalize] failed", err);
        return res.status(500).json({ error: "Finalize feilet", detail: String(err) });
      }
    },
  );

  // ── POST /takes/:takeId/select — bytt current take ───────────────
  app.post("/api/role-room/talents/selftapes/takes/:takeId/select", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `UPDATE talent_selftape_projects
            SET current_take_id = $1::uuid
          WHERE id = (SELECT project_id FROM talent_selftape_takes WHERE id = $1::uuid)
          RETURNING id::text, current_take_id::text`,
        [req.params.takeId],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Take ikke funnet" });
      return res.json({ project: r.rows[0] });
    } catch (err) {
      console.error("[selftapes/takes select] failed", err);
      return res.status(500).json({ error: "Select feilet" });
    }
  });

  // ── PATCH /takes/:takeId — oppdater notes/metadata ───────────────
  app.patch("/api/role-room/talents/selftapes/takes/:takeId", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { notes, metadata } = (req.body || {}) as Record<string, unknown>;
    try {
      const r = await pool.query(
        `UPDATE talent_selftape_takes
            SET notes = COALESCE($1, notes),
                metadata = COALESCE($2::jsonb, metadata)
          WHERE id = $3::uuid RETURNING *`,
        [notes ?? null, metadata ? JSON.stringify(metadata) : null, req.params.takeId],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Take ikke funnet" });
      return res.json({ take: r.rows[0] });
    } catch (err) {
      console.error("[selftapes/takes PATCH] failed", err);
      return res.status(500).json({ error: "Oppdatering feilet" });
    }
  });

  // ── DELETE /takes/:takeId ─────────────────────────────────────────
  app.delete("/api/role-room/talents/selftapes/takes/:takeId", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `DELETE FROM talent_selftape_takes WHERE id = $1::uuid RETURNING id::text`,
        [req.params.takeId],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Take ikke funnet" });
      return res.json({ deleted: true });
    } catch (err) {
      console.error("[selftapes/takes DELETE] failed", err);
      return res.status(500).json({ error: "Sletting feilet" });
    }
  });

  // ── GET /takes/:takeId/feedback ─────────────────────────────────
  app.get("/api/role-room/talents/selftapes/takes/:takeId/feedback", async (req, res) => {
    const session = getActiveSession(req);
    const talentId = await resolveTalentId(pool, req, session);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `SELECT f.* FROM talent_selftape_ai_feedback f
           JOIN talent_selftape_takes t ON t.ai_feedback_id = f.id
          WHERE t.id = $1::uuid LIMIT 1`,
        [req.params.takeId],
      );
      return res.json({ feedback: r.rows[0] ?? null });
    } catch (err) {
      console.error("[selftapes/feedback GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente feedback" });
    }
  });

  // ── POST /takes/:takeId/feedback/regenerate ─────────────────────
  // Fase A: stub-respons. Fase D integrerer Claude Opus.
  app.post("/api/role-room/talents/selftapes/takes/:takeId/feedback/regenerate",
    async (req, res) => {
      const session = getActiveSession(req);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        // Sett feedback til generating-status så UI kan polle
        const r = await pool.query(
          `INSERT INTO talent_selftape_ai_feedback (take_id, status)
           VALUES ($1::uuid, 'generating')
           RETURNING id::text, status`,
          [req.params.takeId],
        );
        await pool.query(
          `UPDATE talent_selftape_takes SET ai_feedback_id = $1::uuid WHERE id = $2::uuid`,
          [r.rows[0].id, req.params.takeId],
        );
        return res.json({ feedback: r.rows[0], note: "AI-integrasjon kommer i Fase D" });
      } catch (err) {
        console.error("[selftapes/feedback regenerate] failed", err);
        return res.status(500).json({ error: "Regenerate feilet" });
      }
    },
  );

  // ── GET /projects/:projectId/submissions ─────────────────────────
  app.get("/api/role-room/talents/selftapes/projects/:projectId/submissions",
    async (req, res) => {
      const session = getActiveSession(req);
      const talentId = await resolveTalentId(pool, req, session);
      if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query(
          `SELECT s.id::text, s.target_type, s.enabled, s.status, s.deadline_at,
                  s.agency_org_id::text, s.agency_preferred, s.private_token,
                  s.private_expires_at, s.casting_project_id, s.casting_role_id,
                  s.submitted_at, s.viewed_at, s.metadata,
                  a.name AS agency_name, a.logo_url AS agency_logo_url,
                  cp.name AS casting_project_name
             FROM talent_selftape_submissions s
             LEFT JOIN agency_orgs a ON a.id = s.agency_org_id
             LEFT JOIN casting_projects cp ON cp.id = s.casting_project_id
            WHERE s.project_id = $1::uuid
            ORDER BY s.created_at ASC`,
          [req.params.projectId],
        );
        return res.json({ submissions: r.rows });
      } catch (err) {
        console.error("[selftapes/submissions GET] failed", err);
        return res.status(500).json({ error: "Klarte ikke å hente submissions" });
      }
    },
  );

  // ── POST /projects/:projectId/submissions — add target ───────────
  app.post("/api/role-room/talents/selftapes/projects/:projectId/submissions",
    async (req, res) => {
      const session = getActiveSession(req);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const { take_id, target_type, agency_org_id, casting_project_id,
              casting_role_id, deadline_at } = (req.body || {}) as Record<string, unknown>;
      if (!take_id || !target_type) {
        return res.status(400).json({ error: "take_id og target_type påkrevd" });
      }
      try {
        // Generer private_token for private_link-type
        const privateToken = target_type === "private_link"
          ? crypto.randomBytes(24).toString("base64url")
          : null;
        const r = await pool.query(
          `INSERT INTO talent_selftape_submissions
             (project_id, take_id, target_type, agency_org_id, casting_project_id,
              casting_role_id, deadline_at, private_token, status)
           VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, 'ready')
           RETURNING *`,
          [req.params.projectId, take_id, target_type, agency_org_id ?? null,
           casting_project_id ?? null, casting_role_id ?? null,
           deadline_at ?? null, privateToken],
        );
        return res.status(201).json({ submission: r.rows[0] });
      } catch (err) {
        console.error("[selftapes/submissions POST] failed", err);
        return res.status(500).json({ error: "Klarte ikke å lage target", detail: String(err) });
      }
    },
  );

  // ── PATCH /submissions/:id — toggle, deadline, etc. ──────────────
  app.patch("/api/role-room/talents/selftapes/submissions/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const allowed = ["enabled", "deadline_at", "status", "agency_preferred"];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    for (const k of allowed) {
      const v = (req.body || {})[k];
      if (v !== undefined) { sets.push(`${k} = $${p++}`); vals.push(v); }
    }
    if (sets.length === 0) return res.status(400).json({ error: "Ingen felter" });
    vals.push(req.params.id);
    try {
      const r = await pool.query(
        `UPDATE talent_selftape_submissions SET ${sets.join(", ")}, status_updated_at = now()
          WHERE id = $${p}::uuid RETURNING *`,
        vals,
      );
      if (!r.rowCount) return res.status(404).json({ error: "Submission ikke funnet" });
      return res.json({ submission: r.rows[0] });
    } catch (err) {
      console.error("[selftapes/submissions PATCH] failed", err);
      return res.status(500).json({ error: "Oppdatering feilet" });
    }
  });

  // ── POST /submissions/:id/send — submit ──────────────────────────
  app.post("/api/role-room/talents/selftapes/submissions/:id/send", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `UPDATE talent_selftape_submissions
            SET status = 'submitted', submitted_at = now(), status_updated_at = now()
          WHERE id = $1::uuid AND status IN ('draft','ready')
          RETURNING *`,
        [req.params.id],
      );
      if (!r.rowCount) {
        return res.status(409).json({ error: "Submission kan ikke sendes (allerede sendt eller ikke klar)" });
      }
      await pool.query(
        `INSERT INTO talent_selftape_submission_events (submission_id, event_type, actor_user_id, details)
         VALUES ($1::uuid, 'submitted', $2, '{}'::jsonb)`,
        [req.params.id, session.userId],
      );
      // TODO Fase D: send e-post via Resend
      return res.json({ submission: r.rows[0] });
    } catch (err) {
      console.error("[selftapes/submissions send] failed", err);
      return res.status(500).json({ error: "Send feilet" });
    }
  });

  // ── POST /submissions/:id/rotate-link — ny private_token ─────────
  app.post("/api/role-room/talents/selftapes/submissions/:id/rotate-link",
    async (req, res) => {
      const session = getActiveSession(req);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const newToken = crypto.randomBytes(24).toString("base64url");
      try {
        const r = await pool.query(
          `UPDATE talent_selftape_submissions
              SET private_token = $1, status_updated_at = now()
            WHERE id = $2::uuid AND target_type = 'private_link'
            RETURNING id::text, private_token`,
          [newToken, req.params.id],
        );
        if (!r.rowCount) return res.status(404).json({ error: "Submission ikke funnet" });
        return res.json({ submission: r.rows[0] });
      } catch (err) {
        console.error("[selftapes/rotate-link] failed", err);
        return res.status(500).json({ error: "Roter feilet" });
      }
    },
  );

  // ── GET /submissions/:id/history — events ────────────────────────
  app.get("/api/role-room/talents/selftapes/submissions/:id/history", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id::text, event_type, actor_label, details, created_at::text
           FROM talent_selftape_submission_events
          WHERE submission_id = $1::uuid
          ORDER BY created_at DESC LIMIT 50`,
        [req.params.id],
      );
      return res.json({ events: r.rows });
    } catch (err) {
      console.error("[selftapes/history] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente history" });
    }
  });

  // ── Public viewing via private_token ─────────────────────────────
  // Ingen auth — token er bæreren.
  app.get("/api/public/selftape/:token", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT s.id::text, s.status, s.private_expires_at,
                t.video_url, t.hls_manifest, t.stream_uid, t.duration_ms,
                p.name AS project_name, p.role_name, p.scene_label,
                tal.display_name AS talent_name
           FROM talent_selftape_submissions s
           JOIN talent_selftape_takes t ON t.id = s.take_id
           JOIN talent_selftape_projects p ON p.id = s.project_id
           JOIN talents tal ON tal.id = p.talent_id
          WHERE s.private_token = $1 AND s.enabled = TRUE LIMIT 1`,
        [req.params.token],
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ error: "Submission ikke funnet" });
      if (row.private_expires_at && new Date(row.private_expires_at) < new Date()) {
        return res.status(410).json({ error: "Lenken er utløpt" });
      }
      return res.json({ submission: row });
    } catch (err) {
      console.error("[public/selftape] failed", err);
      return res.status(500).json({ error: "Server-feil" });
    }
  });

  app.post("/api/public/selftape/:token/track-view", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id::text FROM talent_selftape_submissions
          WHERE private_token = $1 AND enabled = TRUE LIMIT 1`,
        [req.params.token],
      );
      const sub = r.rows[0];
      if (!sub) return res.status(404).json({ error: "Submission ikke funnet" });
      await pool.query(
        `UPDATE talent_selftape_submissions
            SET status = CASE WHEN status = 'submitted' THEN 'viewed' ELSE status END,
                viewed_at = COALESCE(viewed_at, now()),
                status_updated_at = now()
          WHERE id = $1::uuid`,
        [sub.id],
      );
      await pool.query(
        `INSERT INTO talent_selftape_submission_events
           (submission_id, event_type, actor_label, ip_address, user_agent)
         VALUES ($1::uuid, 'viewed', $2, $3, $4)`,
        [sub.id, (req.headers["x-actor-label"] as string) ?? null,
         req.ip ?? null, req.headers["user-agent"] ?? null],
      );
      return res.json({ tracked: true });
    } catch (err) {
      console.error("[public/selftape track-view] failed", err);
      return res.status(500).json({ error: "Tracking feilet" });
    }
  });
}
