/**
 * leadgrid-academy-routes.ts
 *
 * Leadgrid Academy — org-scopet opplæring for salgsteam.
 * «Sett en standard i organisasjonen. Lær opp ansatte og utvikle dem til
 * bedre og mer effektive leads-jaktere.»
 *
 * Prefix: /api/leadgrid/academy/*
 *
 * Endepunkter (3, fase 1):
 *   GET  /academy/courses              → { courses: [ { …, chapters: [...] } ] }
 *        Synlighet: scope='leadgrid_official' (alle) + scope='org' for
 *        brukerens org (via resolveOrgIdForUser). Inkluderer brukerens
 *        progresjon per kapittel (watched/position_seconds).
 *   POST /academy/progress             → upsert { chapter_id, watched, position_seconds }
 *   GET  /academy/chapters/:id/video-url → { url } (presignert R2-GET) |
 *        404 hvis kapittelet ikke har video (tekst/poster-kapittel).
 *
 * Forutsetter mig 0368 (leadgrid_academy_courses/chapters/progress).
 * JSON er snake_case (iPad-ens _sharedDecoder konverterer).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { signAssetReadUrl } from "./capture-upload-service.js";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface AcademyRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerLeadgridAcademyRoutes(deps: AcademyRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ── GET /api/leadgrid/academy/courses ─────────────────────────────
  app.get("/api/leadgrid/academy/courses", async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const coursesRes = await pool.query(
        `SELECT id::text, scope, organization_id, slug, title, description,
                poster_icon, poster_tint, sort_order
           FROM leadgrid_academy_courses
          WHERE is_published = TRUE
            AND (scope = 'leadgrid_official' OR organization_id = $1)
          ORDER BY sort_order, created_at`,
        [orgId],
      );
      if (coursesRes.rows.length === 0) return res.json({ courses: [] });

      const courseIds = coursesRes.rows.map((c) => c.id);
      const chaptersRes = await pool.query(
        `SELECT ch.id::text, ch.course_id::text, ch.number, ch.section, ch.title,
                ch.summary, ch.instructor, ch.duration_seconds, ch.poster_icon,
                ch.poster_tint, ch.learning_objectives, ch.transcript_snippet,
                (ch.video_r2_key IS NOT NULL) AS has_video,
                COALESCE(p.watched, FALSE) AS watched,
                COALESCE(p.position_seconds, 0) AS position_seconds
           FROM leadgrid_academy_chapters ch
           LEFT JOIN leadgrid_academy_progress p
             ON p.chapter_id = ch.id AND p.user_id = $2
          WHERE ch.course_id = ANY($1::uuid[])
          ORDER BY ch.course_id, ch.number`,
        [courseIds, session.userId],
      );

      const byCourse = new Map<string, unknown[]>();
      for (const ch of chaptersRes.rows) {
        const list = byCourse.get(ch.course_id) ?? [];
        list.push(ch);
        byCourse.set(ch.course_id, list);
      }
      const courses = coursesRes.rows.map((c) => ({
        ...c,
        chapters: byCourse.get(c.id) ?? [],
      }));
      return res.json({ courses });
    } catch (err) {
      console.error("[leadgrid-academy] courses feilet:", err);
      return res.status(500).json({ error: "academy_courses_failed" });
    }
  });

  // ── POST /api/leadgrid/academy/progress ───────────────────────────
  app.post("/api/leadgrid/academy/progress", async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as {
      chapter_id?: string;
      watched?: boolean;
      position_seconds?: number;
    };
    if (!body.chapter_id || !UUID_RE.test(body.chapter_id)) {
      return res.status(400).json({ error: "ugyldig_chapter_id" });
    }
    const watched = body.watched === true;
    const position = Math.max(0, Math.min(Number(body.position_seconds ?? 0) || 0, 24 * 3600));
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      await pool.query(
        `INSERT INTO leadgrid_academy_progress
           (user_id, chapter_id, organization_id, watched, position_seconds, completed_at, updated_at)
         VALUES ($1, $2::uuid, $3, $4, $5, CASE WHEN $4 THEN NOW() END, NOW())
         ON CONFLICT (user_id, chapter_id) DO UPDATE SET
           -- watched er engangs-fremover: aldri tilbake til usett fra klient
           watched = leadgrid_academy_progress.watched OR EXCLUDED.watched,
           position_seconds = EXCLUDED.position_seconds,
           completed_at = COALESCE(leadgrid_academy_progress.completed_at, EXCLUDED.completed_at),
           updated_at = NOW()`,
        [session.userId, body.chapter_id, orgId, watched, position],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-academy] progress feilet:", err);
      return res.status(500).json({ error: "academy_progress_failed" });
    }
  });

  // ── GET /api/leadgrid/academy/chapters/:id/video-url ──────────────
  app.get(
    "/api/leadgrid/academy/chapters/:id([0-9a-fA-F-]{36})/video-url",
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        // Synlighets-sjekk: kapittelets kurs må være offisielt eller org-ens eget.
        const r = await pool.query<{ video_r2_key: string | null }>(
          `SELECT ch.video_r2_key
             FROM leadgrid_academy_chapters ch
             JOIN leadgrid_academy_courses c ON c.id = ch.course_id
            WHERE ch.id = $1::uuid AND c.is_published = TRUE
              AND (c.scope = 'leadgrid_official' OR c.organization_id = $2)`,
          [req.params.id, orgId],
        );
        const key = r.rows[0]?.video_r2_key ?? null;
        if (!r.rows.length) return res.status(404).json({ error: "not_found" });
        if (!key) return res.status(404).json({ error: "ingen_video" });
        const url = await signAssetReadUrl(key);
        if (!url) return res.status(500).json({ error: "presign_failed" });
        return res.json({ url });
      } catch (err) {
        console.error("[leadgrid-academy] video-url feilet:", err);
        return res.status(500).json({ error: "academy_video_failed" });
      }
    },
  );
}
