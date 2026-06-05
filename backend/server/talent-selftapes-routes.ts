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
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";

import {
  isStreamEnabled,
  uploadToStream,
  signStreamPlaybackUrl,
  signStreamThumbnailUrl,
} from "./cloudflare-stream-service.js";

// 500 MB grense — én typisk self-tape (60-90s @ 1080p) ligger på 50-150 MB
const MAX_SELFTAPE_BYTES = 500 * 1024 * 1024;

const selftapeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SELFTAPE_BYTES },
});

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
  // Kompatibilitets-endepunkt; nye klienter bør bruke /takes/upload som
  // gjør init+upload+finalize i ett kall.
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

        return res.status(201).json({
          take: ins.rows[0],
          upload: {
            provider: "backend-multipart",
            endpoint: `/api/role-room/talents/selftapes/projects/${req.params.projectId}/takes/upload`,
            max_size_bytes: MAX_SELFTAPE_BYTES,
            note: "Klienten poster multipart-blob til /takes/upload",
          },
        });
      } catch (err) {
        console.error("[selftapes/takes init-upload] failed", err);
        return res.status(500).json({ error: "Init feilet", detail: String(err) });
      }
    },
  );

  // ── POST /takes/upload — multipart: MediaRecorder-blob eller fil ─
  // Backend laster opp til Cloudflare Stream og finalize-r take-raden
  // i ett kall. Demo-modus lagrer som "klar" uten CF Stream.
  app.post("/api/role-room/talents/selftapes/projects/:projectId/takes/upload",
    selftapeUpload.single("video"),
    async (req, res) => {
      const session = getActiveSession(req);
      const talentId = await resolveTalentId(pool, req, session);
      if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
      const file = (req as express.Request & { file?: Express.Multer.File }).file;
      if (!file) return res.status(400).json({ error: "video-fil mangler" });
      const projectId = req.params.projectId;
      const durationMs = Number((req.body as { duration_ms?: string }).duration_ms ?? 0);

      try {
        const owner = await pool.query(
          `SELECT 1 FROM talent_selftape_projects
            WHERE id = $1::uuid AND talent_id = $2::uuid LIMIT 1`,
          [projectId, talentId],
        );
        if (!owner.rowCount) return res.status(404).json({ error: "Prosjekt ikke funnet" });

        // Neste take_number
        const next = await pool.query(
          `SELECT COALESCE(MAX(take_number), 0) + 1 AS n
             FROM talent_selftape_takes WHERE project_id = $1::uuid`,
          [projectId],
        );
        const takeNumber = next.rows[0].n;

        // Demo-modus: lagre uten CF Stream (frontend bruker tom video-URL)
        if (isDemoRequest(req)) {
          const r = await pool.query(
            `INSERT INTO talent_selftape_takes
               (project_id, take_number, status, duration_ms, metadata, is_demo)
             VALUES ($1::uuid, $2, 'ready', $3, $4::jsonb, TRUE)
             RETURNING *`,
            [projectId, takeNumber, Math.max(0, Math.round(durationMs)),
             JSON.stringify({ demo: true, mime: file.mimetype, size: file.size })],
          );
          await pool.query(
            `UPDATE talent_selftape_projects SET current_take_id = $1::uuid WHERE id = $2::uuid`,
            [r.rows[0].id, projectId],
          );
          return res.status(201).json({ take: r.rows[0] });
        }

        // Live-modus: krever CF Stream
        if (!isStreamEnabled()) {
          return res.status(503).json({
            error: "Cloudflare Stream er ikke konfigurert. Sett CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_STREAM_API_TOKEN på serveren.",
          });
        }

        // Opprett take-rad først så vi har id å bygge meta rundt
        const insTake = await pool.query(
          `INSERT INTO talent_selftape_takes
             (project_id, take_number, status, duration_ms)
           VALUES ($1::uuid, $2, 'uploading', $3)
           RETURNING id::text`,
          [projectId, takeNumber, Math.max(0, Math.round(durationMs))],
        );
        const takeId: string = insTake.rows[0].id;

        let streamUid = "";
        let playbackUrl = "";
        let thumbnailUrl = "";
        try {
          const result = await uploadToStream(file.buffer, file.mimetype, {
            projectId,
            postId: takeId,
            filename: file.originalname ?? `take-${takeNumber}.${file.mimetype.includes("mp4") ? "mp4" : "webm"}`,
            requireSignedURLs: true,
          });
          streamUid = result.uid;
          // Generer signerte URL-er (3 timer TTL — refreshes på getProject).
          // Faller tilbake til CF Streams default-URL hvis signering ikke er aktivert.
          playbackUrl = (await signStreamPlaybackUrl(streamUid, 60 * 60 * 3))
            ?? result.playbackUrl;
          thumbnailUrl = (await signStreamThumbnailUrl(streamUid, 60 * 60 * 24))
            ?? result.thumbnailUrl;
        } catch (uploadErr) {
          // Rull tilbake take-raden hvis Stream feiler
          await pool.query(`DELETE FROM talent_selftape_takes WHERE id = $1::uuid`, [takeId]);
          console.error("[selftapes/takes upload] CF Stream failed", uploadErr);
          return res.status(502).json({
            error: "Upload til Cloudflare Stream feilet",
            detail: String(uploadErr),
          });
        }

        // Finalize-rad
        const fin = await pool.query(
          `UPDATE talent_selftape_takes
              SET status = 'ready',
                  stream_uid = $1,
                  video_url = $2,
                  hls_manifest = $2,
                  thumbnail_url = $3,
                  metadata = jsonb_build_object(
                    'source', 'multipart-upload',
                    'mime', $4::text,
                    'size_bytes', $5::int
                  )
            WHERE id = $6::uuid
            RETURNING *`,
          [streamUid, playbackUrl, thumbnailUrl, file.mimetype, file.size, takeId],
        );
        await pool.query(
          `UPDATE talent_selftape_projects SET current_take_id = $1::uuid WHERE id = $2::uuid`,
          [takeId, projectId],
        );
        return res.status(201).json({ take: fin.rows[0] });
      } catch (err) {
        console.error("[selftapes/takes upload] failed", err);
        return res.status(500).json({ error: "Upload feilet", detail: String(err) });
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
  // Fase D: kaller Claude Opus 4.7 med scenens kontekst + take-metadata
  // og lagrer strukturert respons i talent_selftape_ai_feedback.
  app.post("/api/role-room/talents/selftapes/takes/:takeId/feedback/regenerate",
    async (req, res) => {
      const session = getActiveSession(req);
      const talentId = await resolveTalentId(pool, req, session);
      if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
      const takeId = req.params.takeId;

      try {
        // Hent take + prosjekt-kontekst og verifiser eierskap
        const ctx = await pool.query(
          `SELECT t.id::text AS take_id, t.take_number, t.duration_ms, t.notes,
                  t.metadata,
                  p.id::text AS project_id, p.name AS project_name,
                  p.role_name, p.role_type, p.scene_label, p.sides_pages,
                  p.sides_content
             FROM talent_selftape_takes t
             JOIN talent_selftape_projects p ON p.id = t.project_id
            WHERE t.id = $1::uuid AND p.talent_id = $2::uuid
            LIMIT 1`,
          [takeId, talentId],
        );
        if (!ctx.rowCount) return res.status(404).json({ error: "Take ikke funnet" });
        const c = ctx.rows[0];

        // Sett pending-rad slik at UI kan polle hvis vi går asynkront
        const pending = await pool.query(
          `INSERT INTO talent_selftape_ai_feedback (take_id, status)
           VALUES ($1::uuid, 'generating')
           RETURNING id::text`,
          [takeId],
        );
        const feedbackId: string = pending.rows[0].id;
        await pool.query(
          `UPDATE talent_selftape_takes SET ai_feedback_id = $1::uuid WHERE id = $2::uuid`,
          [feedbackId, takeId],
        );

        // Ingen API-key → returnér stub i pending (ikke crashe)
        if (!process.env.ANTHROPIC_API_KEY) {
          return res.json({
            feedback: { id: feedbackId, status: "generating" },
            note: "ANTHROPIC_API_KEY mangler — sett den på Render for live AI-feedback",
          });
        }

        // Bygg prompt + call Claude Opus 4.7
        const modelId = process.env.SELFTAPE_FEEDBACK_MODEL ?? "claude-opus-4-7";
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const systemPrompt = [
          "Du er en erfaren casting-direktør som gir konstruktiv, presis tilbakemelding",
          "på self-tapes. Tilbakemeldingen brukes til å hjelpe skuespilleren forbedre",
          "neste take. Skriv på norsk.",
          "",
          "Returnér KUN ren JSON som matcher dette skjemaet (ingen markdown, ingen forklaringer):",
          `{`,
          `  "eye_line": { "grade": "Great|Good|Fair|Needs work", "note": "<1-2 setninger>" },`,
          `  "pacing": { "grade": "...", "note": "..." },`,
          `  "sound": { "grade": "...", "note": "..." },`,
          `  "lighting": { "grade": "...", "note": "..." },`,
          `  "performance": { "grade": "...", "note": "..." },`,
          `  "camera_check": { "resolution": "1080p|720p|...", "frame_rate": "30fps|...", "stability": "Stable|Shaky|..." },`,
          `  "audio_check": { "input_level": "Good|Low|Hot|...", "background_noise": "Low|Medium|High", "clarity": "Clear|Muffled|..." },`,
          `  "framing_check": { "headroom": "On mark|Too much|Too little", "eye_line": "On mark|High|Low", "lighting": "Well lit|Flat|Backlit" },`,
          `  "overall_grade": "Excellent|Good|Fair|Needs work",`,
          `  "detailed_md": "<3-5 setningers oppsummering med konkrete neste-skritt>"`,
          `}`,
        ].join("\n");

        const userPrompt = [
          `Self-tape-prosjekt: ${c.project_name ?? "Ukjent"}`,
          `Rolle: ${c.role_name ?? "—"}${c.role_type ? ` (${c.role_type})` : ""}`,
          `Scene: ${c.scene_label ?? "—"}${c.sides_pages ? ` · ${c.sides_pages} sider` : ""}`,
          ``,
          `Take #${c.take_number}, varighet ${Math.round((c.duration_ms ?? 0) / 1000)}s.`,
          c.notes ? `Skuespillerens notater: ${c.notes}` : "",
          ``,
          c.sides_content
            ? `Manus / dialog:\n${String(c.sides_content).slice(0, 4000)}`
            : "Ingen manus tilgjengelig.",
          ``,
          "Vurder takeen basert på manus-konteksten ovenfor og gi konkret, handlingsrettet",
          "tilbakemelding. Hvis du ikke har faktisk video-data, bruk dine generelle anbefalinger",
          "som er sannsynlige for en self-tape av denne lengden og typen rolle.",
        ].filter(Boolean).join("\n");

        const result = await client.messages.create({
          model: modelId,
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        const textBlock = result.content.find((b) => b.type === "text");
        const responseText = textBlock && textBlock.type === "text" ? textBlock.text : "";
        // Strip evt. markdown-fence
        const json = responseText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(json);
        } catch {
          // Fallback: lagre rå tekst i detailed_md slik at brukeren ser noe
          parsed = { detailed_md: responseText, overall_grade: "Fair" };
        }

        // Lagre strukturert resultat
        const upd = await pool.query(
          `UPDATE talent_selftape_ai_feedback
              SET model_version = $1,
                  eye_line = $2::jsonb,
                  pacing = $3::jsonb,
                  sound = $4::jsonb,
                  lighting = $5::jsonb,
                  performance = $6::jsonb,
                  camera_check = $7::jsonb,
                  audio_check = $8::jsonb,
                  framing_check = $9::jsonb,
                  overall_grade = $10,
                  detailed_md = $11,
                  status = 'ready',
                  generated_at = now()
            WHERE id = $12::uuid
            RETURNING *`,
          [
            modelId,
            JSON.stringify(parsed.eye_line ?? null),
            JSON.stringify(parsed.pacing ?? null),
            JSON.stringify(parsed.sound ?? null),
            JSON.stringify(parsed.lighting ?? null),
            JSON.stringify(parsed.performance ?? null),
            JSON.stringify(parsed.camera_check ?? null),
            JSON.stringify(parsed.audio_check ?? null),
            JSON.stringify(parsed.framing_check ?? null),
            (parsed.overall_grade as string) ?? null,
            (parsed.detailed_md as string) ?? null,
            feedbackId,
          ],
        );
        return res.json({ feedback: upd.rows[0] });
      } catch (err) {
        console.error("[selftapes/feedback regenerate] failed", err);
        // Marker som failed i DB hvis vi kommer hit etter at vi har laget rad
        try {
          await pool.query(
            `UPDATE talent_selftape_ai_feedback
                SET status = 'failed',
                    error_message = $1
              WHERE take_id = $2::uuid AND status = 'generating'`,
            [String(err).slice(0, 500), takeId],
          );
        } catch {
          // ignore secondary error
        }
        return res.status(500).json({ error: "Regenerate feilet", detail: String(err) });
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

  // ═══════════════════════════════════════════════════════════════════
  // FASE A-E: Utvelgelses-integrasjon + ekstern video-kilde
  // ═══════════════════════════════════════════════════════════════════

  // ── POST /takes/external — talent legger til YouTube/Drive/Vimeo ──
  // Parser URL strikt, ekstraherer video-id, lagrer som take med
  // source_provider sat til riktig provider. Ingen filupload.
  app.post("/api/role-room/talents/selftapes/projects/:projectId/takes/external",
    async (req, res) => {
      const session = getActiveSession(req);
      const talentId = await resolveTalentId(pool, req, session);
      if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
      const { url, duration_ms } = (req.body || {}) as {
        url?: string; duration_ms?: number;
      };
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "url er påkrevd" });
      }
      const parsed = parseExternalVideoUrl(url);
      if (!parsed) {
        return res.status(400).json({
          error: "URL gjenkjennes ikke. Støtter unlisted YouTube, Google Drive og Vimeo.",
        });
      }
      try {
        const owner = await pool.query(
          `SELECT 1 FROM talent_selftape_projects
            WHERE id = $1::uuid AND talent_id = $2::uuid LIMIT 1`,
          [req.params.projectId, talentId],
        );
        if (!owner.rowCount) return res.status(404).json({ error: "Prosjekt ikke funnet" });

        const next = await pool.query(
          `SELECT COALESCE(MAX(take_number), 0) + 1 AS n
             FROM talent_selftape_takes WHERE project_id = $1::uuid`,
          [req.params.projectId],
        );
        const takeNumber = next.rows[0].n;

        const r = await pool.query(
          `INSERT INTO talent_selftape_takes
             (project_id, take_number, status, duration_ms,
              source_provider, external_url, external_video_id,
              video_url, thumbnail_url, metadata, is_demo)
           VALUES ($1::uuid, $2, 'ready', $3,
                   $4, $5, $6,
                   $7, $8, $9::jsonb, $10)
           RETURNING *`,
          [
            req.params.projectId,
            takeNumber,
            Math.max(0, Math.round(Number(duration_ms ?? 0))),
            parsed.provider,
            parsed.cleanUrl,
            parsed.videoId,
            parsed.embedUrl,        // brukes som video_url for player-fallback
            parsed.thumbnailUrl,
            JSON.stringify({
              source: "external",
              original_url: url,
              provider: parsed.provider,
              video_id: parsed.videoId,
            }),
            isDemoRequest(req),
          ],
        );
        await pool.query(
          `UPDATE talent_selftape_projects SET current_take_id = $1::uuid WHERE id = $2::uuid`,
          [r.rows[0].id, req.params.projectId],
        );
        return res.status(201).json({ take: r.rows[0] });
      } catch (err) {
        console.error("[selftapes/takes external] failed", err);
        return res.status(500).json({ error: "Klarte ikke å lagre ekstern lenke", detail: String(err) });
      }
    },
  );

  // ── POST /submissions/:id/revoke — talent revokerer tilgang ────────
  app.post("/api/role-room/talents/selftapes/submissions/:id/revoke",
    async (req, res) => {
      const session = getActiveSession(req);
      const talentId = await resolveTalentId(pool, req, session);
      if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
      const { reason } = (req.body || {}) as { reason?: string };
      try {
        // Verifiser at talent eier submission'en (via project ownership)
        const owner = await pool.query(
          `SELECT s.id::text
             FROM talent_selftape_submissions s
             JOIN talent_selftape_projects p ON p.id = s.project_id
            WHERE s.id = $1::uuid AND p.talent_id = $2::uuid LIMIT 1`,
          [req.params.id, talentId],
        );
        if (!owner.rowCount) return res.status(404).json({ error: "Submission ikke funnet" });

        const r = await pool.query(
          `UPDATE talent_selftape_submissions
              SET status = 'revoked',
                  revoked_at = now(),
                  revoke_reason = $1,
                  status_updated_at = now()
            WHERE id = $2::uuid
            RETURNING *`,
          [reason ?? null, req.params.id],
        );
        // Audit-event (best-effort)
        try {
          await pool.query(
            `INSERT INTO talent_selftape_submission_events
               (submission_id, event_type, actor_label, details)
             VALUES ($1::uuid, 'revoked', 'talent', $2::jsonb)`,
            [req.params.id, JSON.stringify({ reason: reason ?? null })],
          );
        } catch { /* best-effort */ }
        return res.json({ submission: r.rows[0] });
      } catch (err) {
        console.error("[selftapes/submissions revoke] failed", err);
        return res.status(500).json({ error: "Revoke feilet", detail: String(err) });
      }
    },
  );

  // ── GET /talents/selftapes/shared — talentens "Mine delte" oversikt
  app.get("/api/role-room/talents/selftapes/shared", async (req, res) => {
    const session = getActiveSession(req);
    const talentId = await resolveTalentId(pool, req, session);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `SELECT s.id::text, s.target_type, s.status, s.submitted_at, s.viewed_at,
                s.revoked_at, s.revoke_reason, s.deadline_at, s.view_count,
                s.last_viewed_at, s.private_token,
                p.id::text AS selftape_project_id, p.name AS selftape_project_name,
                a.name AS agency_name, a.logo_url AS agency_logo_url,
                cp.name AS casting_project_name,
                cr.name AS casting_role_name,
                t.take_number, t.thumbnail_url, t.source_provider,
                cr.id::text AS casting_role_id
           FROM talent_selftape_submissions s
           JOIN talent_selftape_projects p ON p.id = s.project_id
           LEFT JOIN agency_orgs a         ON a.id = s.agency_org_id
           LEFT JOIN casting_projects cp   ON cp.id = s.casting_project_id
           LEFT JOIN casting_roles cr      ON cr.id = s.casting_role_id
           LEFT JOIN talent_selftape_takes t ON t.id = s.take_id
          WHERE p.talent_id = $1::uuid
          ORDER BY COALESCE(s.submitted_at, s.created_at) DESC NULLS LAST`,
        [talentId],
      );
      return res.json({ shared: r.rows });
    } catch (err) {
      console.error("[selftapes/shared GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente delinger" });
    }
  });

  // ── GET /casting-roles/:roleId/selftapes — produksjon ser self-tapes
  // Krever at innlogget bruker eier prosjektet rollen tilhører.
  app.get("/api/role-room/casting-roles/:roleId/selftapes", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      // Verifiser at brukeren eier prosjektet
      const own = await pool.query(
        `SELECT cp.id::text AS project_id, cp.created_by
           FROM casting_roles cr
           JOIN casting_projects cp ON cp.id = cr.project_id
          WHERE cr.id = $1::uuid LIMIT 1`,
        [req.params.roleId],
      );
      if (!own.rowCount) return res.status(404).json({ error: "Rolle ikke funnet" });
      if (own.rows[0].created_by !== session.userId) {
        return res.status(403).json({ error: "Du eier ikke prosjektet" });
      }

      const r = await pool.query(
        `SELECT * FROM v_casting_role_selftapes
          WHERE role_id = $1`,
        [req.params.roleId],
      );

      // Signer URLs on-the-fly hvis CF Stream + stream_uid finnes
      const rows = await Promise.all(r.rows.map(async (row) => {
        if (row.source_provider === "cloudflare_stream" && row.stream_uid) {
          try {
            const signed = await signStreamPlaybackUrl(row.stream_uid, 60 * 60 * 3);
            const thumb = await signStreamThumbnailUrl(row.stream_uid, 60 * 60 * 24);
            if (signed) row.video_url = signed;
            if (thumb) row.thumbnail_url = thumb;
          } catch (err) {
            console.warn("[selftapes/casting-roles] sign failed", err);
          }
        }
        return row;
      }));
      return res.json({ selftapes: rows });
    } catch (err) {
      console.error("[selftapes/casting-roles GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente self-tapes" });
    }
  });

  // ── POST /casting-roles/selftapes/submissions/:id/view ─────────────
  // Produksjon registrerer en visning — øker view_count, skriver audit,
  // setter status → 'viewed' hvis 'submitted'. Idempotent på UUID.
  app.post("/api/role-room/casting-roles/selftapes/submissions/:id/view",
    async (req, res) => {
      const session = getActiveSession(req);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        // Verifiser at brukeren eier prosjektet
        const own = await pool.query(
          `SELECT s.id::text, s.project_id::text, p.talent_id::text, cp.created_by
             FROM talent_selftape_submissions s
             LEFT JOIN talent_selftape_projects p ON p.id = s.project_id
             LEFT JOIN casting_projects cp ON cp.id = s.casting_project_id
            WHERE s.id = $1::uuid LIMIT 1`,
          [req.params.id],
        );
        if (!own.rowCount) return res.status(404).json({ error: "Submission ikke funnet" });
        const row = own.rows[0];
        if (!row.created_by) {
          return res.status(403).json({ error: "Ingen prosjekt-eier-info" });
        }
        if (row.created_by !== session.userId) {
          return res.status(403).json({ error: "Du eier ikke prosjektet" });
        }

        const upd = await pool.query(
          `UPDATE talent_selftape_submissions
              SET status = CASE WHEN status = 'submitted' THEN 'viewed' ELSE status END,
                  viewed_at = COALESCE(viewed_at, now()),
                  last_viewed_at = now(),
                  view_count = view_count + 1,
                  status_updated_at = now()
            WHERE id = $1::uuid AND status != 'revoked'
            RETURNING id::text, status, view_count, last_viewed_at`,
          [req.params.id],
        );
        if (!upd.rowCount) {
          return res.status(410).json({ error: "Submission er revoket av talent" });
        }

        // Audit-trail (best-effort på begge tabeller)
        try {
          await pool.query(
            `INSERT INTO talent_selftape_submission_events
               (submission_id, event_type, actor_label, details)
             VALUES ($1::uuid, 'viewed', $2, $3::jsonb)`,
            [req.params.id, session.email ?? "production", JSON.stringify({
              user_id: session.userId,
            })],
          );
        } catch { /* ignore */ }
        try {
          await pool.query(
            `INSERT INTO talent_access_audit
               (talent_id, partner_type, partner_ref, scope, accessed_by, details)
             VALUES ($1::uuid, 'production_team', $2, 'self_tape_review', $3, $4::jsonb)`,
            [row.talent_id, session.userId, session.email ?? null,
             JSON.stringify({ submission_id: req.params.id })],
          );
        } catch { /* ignore — audit-write skal ikke blokkere visning */ }

        return res.json({ submission: upd.rows[0] });
      } catch (err) {
        console.error("[selftapes/casting-roles view] failed", err);
        return res.status(500).json({ error: "View-tracking feilet" });
      }
    },
  );
}

// ═══════════════════════════════════════════════════════════════════
// External URL parsers — strikt for sikkerhets-skyld
// ═══════════════════════════════════════════════════════════════════
interface ParsedExternal {
  provider: "youtube_unlisted" | "google_drive" | "vimeo";
  videoId: string;
  cleanUrl: string;
  embedUrl: string;
  thumbnailUrl: string | null;
}

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
const VIMEO_ID_RE = /^[0-9]{6,12}$/;
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{20,80}$/;

function parseExternalVideoUrl(raw: string): ParsedExternal | null {
  let parsed: URL;
  try { parsed = new URL(raw.trim()); } catch { return null; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.toLowerCase();

  // YouTube
  if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    let id = "";
    if (host === "youtu.be") {
      id = parsed.pathname.replace(/^\//, "").split("/")[0] ?? "";
    } else if (parsed.pathname === "/watch") {
      id = parsed.searchParams.get("v") ?? "";
    } else if (parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/v/")
               || parsed.pathname.startsWith("/shorts/")) {
      id = parsed.pathname.split("/")[2] ?? "";
    }
    if (!YOUTUBE_ID_RE.test(id)) return null;
    return {
      provider: "youtube_unlisted",
      videoId: id,
      cleanUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?modestbranding=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    };
  }

  // Vimeo
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    const segments = parsed.pathname.split("/").filter(Boolean);
    const id = segments.find((s) => VIMEO_ID_RE.test(s)) ?? "";
    if (!id) return null;
    return {
      provider: "vimeo",
      videoId: id,
      cleanUrl: `https://vimeo.com/${id}`,
      embedUrl: `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`,
      thumbnailUrl: null,
    };
  }

  // Google Drive
  if (host === "drive.google.com" || host === "docs.google.com") {
    // Format: /file/d/{ID}/view  ELLER  /open?id={ID}
    let id = "";
    const fileMatch = parsed.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{20,80})/);
    if (fileMatch) id = fileMatch[1];
    if (!id) id = parsed.searchParams.get("id") ?? "";
    if (!DRIVE_ID_RE.test(id)) return null;
    return {
      provider: "google_drive",
      videoId: id,
      cleanUrl: `https://drive.google.com/file/d/${id}/view`,
      embedUrl: `https://drive.google.com/file/d/${id}/preview`,
      thumbnailUrl: null,
    };
  }

  return null;
}
