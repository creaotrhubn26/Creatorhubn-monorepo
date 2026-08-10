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
 * Fase 2 — org-egne kurs (admin-gated: global admin/super_admin eller
 * enterprise_team_members.role='admin' i org-en):
 *   POST   /academy/courses                      → opprett org-kurs
 *   PATCH  /academy/courses/:id                  → tittel/beskrivelse/publisering
 *   DELETE /academy/courses/:id
 *   POST   /academy/courses/:id/chapters         → nytt kapittel (auto-nummer)
 *   PATCH  /academy/chapters/:id                 → felt-oppdatering
 *   DELETE /academy/chapters/:id
 *   POST   /academy/chapters/:id/video-upload-url → presignert R2-PUT (15 min)
 *   POST   /academy/chapters/:id/video-attach    → sett video_r2_key etter PUT
 *
 * Kun scope='org'-kurs i egen org kan endres — offisielle kurs er read-only
 * via API (seedes/oppdateres i migrasjoner).
 *
 * Forutsetter mig 0368 (leadgrid_academy_courses/chapters/progress).
 * JSON er snake_case (iPad-ens _sharedDecoder konverterer).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { b2ClientFor, b2StoreFor } from "./b2-client-factory.js";

// ── Backblaze B2 (S3-kompatibel) ─────────────────────────────────────
// Samme oppsett som admin-academy-b2-routes.ts — Academy-video lagres på
// B2 (Daniels beslutning 2026-07-04: B2, ikke R2). Nøkkel-prefix:
// leadgrid-academy/<orgId>/<chapterId>/…
const B2_REGION = process.env.B2_REGION || "us-west-001";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const PLAYBACK_URL_TTL_SECONDS = 30 * 60;

function getB2Config(): { bucketName: string; client: S3Client } | null {
  const store = b2StoreFor("documents", process.env.B2_BUCKET_NAME);
  if (!store) return null;
  const client = b2ClientFor("documents", B2_REGION);
  if (!client) return null;
  return { bucketName: store.bucket, client };
}

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

  // ── Fase 2: admin-hjelpere ────────────────────────────────────────

  /// Global admin/super_admin, eller aktiv 'admin' i org-en.
  async function isAcademyAdmin(session: SessionUser, orgId: string): Promise<boolean> {
    if (session.role === "admin" || session.role === "super_admin") return true;
    const r = await pool.query(
      `SELECT 1 FROM enterprise_team_members
        WHERE user_id = $1 AND organization_id = $2
          AND status = 'active' AND role = 'admin'
        LIMIT 1`,
      [session.userId, orgId],
    );
    return r.rows.length > 0;
  }

  function slugify(title: string): string {
    const base = title.toLowerCase()
      .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      .slice(0, 60) || "kurs";
    return `${base}-${Date.now().toString(36)}`;
  }

  // ── POST /api/leadgrid/academy/courses ────────────────────────────
  app.post("/api/leadgrid/academy/courses", async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as {
      title?: string; description?: string;
      poster_icon?: string; poster_tint?: string;
    };
    if (!body.title?.trim()) return res.status(400).json({ error: "mangler_tittel" });
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!(await isAcademyAdmin(session, orgId))) {
        return res.status(403).json({ error: "krever_org_admin" });
      }
      const r = await pool.query<{ id: string }>(
        `INSERT INTO leadgrid_academy_courses
           (scope, organization_id, slug, title, description, poster_icon, poster_tint, created_by)
         VALUES ('org', $1, $2, $3, $4, $5, $6, $7)
         RETURNING id::text`,
        [
          orgId, slugify(body.title), body.title.trim(),
          body.description?.trim() ?? null,
          body.poster_icon ?? "graduationcap.fill",
          body.poster_tint ?? "purpleLight",
          session.userId,
        ],
      );
      return res.json({ id: r.rows[0].id, status: "created" });
    } catch (err) {
      console.error("[leadgrid-academy] opprett kurs feilet:", err);
      return res.status(500).json({ error: "academy_course_create_failed" });
    }
  });

  // ── PATCH /api/leadgrid/academy/courses/:id ───────────────────────
  app.patch(
    "/api/leadgrid/academy/courses/:id([0-9a-fA-F-]{36})",
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as {
        title?: string; description?: string; is_published?: boolean;
        poster_icon?: string; poster_tint?: string; sort_order?: number;
      };
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        if (!(await isAcademyAdmin(session, orgId))) {
          return res.status(403).json({ error: "krever_org_admin" });
        }
        const r = await pool.query(
          `UPDATE leadgrid_academy_courses SET
             title = COALESCE($3, title),
             description = COALESCE($4, description),
             is_published = COALESCE($5, is_published),
             poster_icon = COALESCE($6, poster_icon),
             poster_tint = COALESCE($7, poster_tint),
             sort_order = COALESCE($8, sort_order),
             updated_at = NOW()
           WHERE id = $1::uuid AND scope = 'org' AND organization_id = $2
           RETURNING id`,
          [
            req.params.id, orgId,
            body.title?.trim() || null, body.description ?? null,
            typeof body.is_published === "boolean" ? body.is_published : null,
            body.poster_icon ?? null, body.poster_tint ?? null,
            typeof body.sort_order === "number" ? body.sort_order : null,
          ],
        );
        if (!r.rows.length) return res.status(404).json({ error: "not_found" });
        return res.json({ ok: true });
      } catch (err) {
        console.error("[leadgrid-academy] oppdater kurs feilet:", err);
        return res.status(500).json({ error: "academy_course_update_failed" });
      }
    },
  );

  // ── DELETE /api/leadgrid/academy/courses/:id ──────────────────────
  app.delete(
    "/api/leadgrid/academy/courses/:id([0-9a-fA-F-]{36})",
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        if (!(await isAcademyAdmin(session, orgId))) {
          return res.status(403).json({ error: "krever_org_admin" });
        }
        const r = await pool.query(
          `DELETE FROM leadgrid_academy_courses
            WHERE id = $1::uuid AND scope = 'org' AND organization_id = $2
            RETURNING id`,
          [req.params.id, orgId],
        );
        if (!r.rows.length) return res.status(404).json({ error: "not_found" });
        return res.json({ ok: true });
      } catch (err) {
        console.error("[leadgrid-academy] slett kurs feilet:", err);
        return res.status(500).json({ error: "academy_course_delete_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/academy/courses/:id/chapters ───────────────
  app.post(
    "/api/leadgrid/academy/courses/:id([0-9a-fA-F-]{36})/chapters",
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as {
        title?: string; summary?: string; section?: string; instructor?: string;
        duration_seconds?: number; poster_icon?: string; poster_tint?: string;
        learning_objectives?: string[]; transcript_snippet?: string;
      };
      if (!body.title?.trim()) return res.status(400).json({ error: "mangler_tittel" });
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        if (!(await isAcademyAdmin(session, orgId))) {
          return res.status(403).json({ error: "krever_org_admin" });
        }
        const r = await pool.query<{ id: string; number: number }>(
          `INSERT INTO leadgrid_academy_chapters
             (course_id, number, section, title, summary, instructor,
              duration_seconds, poster_icon, poster_tint, learning_objectives,
              transcript_snippet)
           SELECT c.id,
                  COALESCE((SELECT MAX(number) FROM leadgrid_academy_chapters WHERE course_id = c.id), 0) + 1,
                  $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11
             FROM leadgrid_academy_courses c
            WHERE c.id = $1::uuid AND c.scope = 'org' AND c.organization_id = $2
           RETURNING id::text, number`,
          [
            req.params.id, orgId,
            body.section ?? "praksis", body.title.trim(), body.summary ?? null,
            body.instructor ?? session.name, Math.max(0, body.duration_seconds ?? 0),
            body.poster_icon ?? "play.rectangle.fill", body.poster_tint ?? "purpleLight",
            JSON.stringify(body.learning_objectives ?? []),
            body.transcript_snippet ?? null,
          ],
        );
        if (!r.rows.length) return res.status(404).json({ error: "not_found" });
        return res.json({ id: r.rows[0].id, number: r.rows[0].number, status: "created" });
      } catch (err) {
        console.error("[leadgrid-academy] opprett kapittel feilet:", err);
        return res.status(500).json({ error: "academy_chapter_create_failed" });
      }
    },
  );

  /// Kapittel-eierskaps-sjekk: kapittelet må tilhøre org-kurs i egen org.
  async function ownedChapter(chapterId: string, orgId: string): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM leadgrid_academy_chapters ch
         JOIN leadgrid_academy_courses c ON c.id = ch.course_id
        WHERE ch.id = $1::uuid AND c.scope = 'org' AND c.organization_id = $2`,
      [chapterId, orgId],
    );
    return r.rows.length > 0;
  }

  // ── PATCH /api/leadgrid/academy/chapters/:id ──────────────────────
  app.patch(
    "/api/leadgrid/academy/chapters/:id([0-9a-fA-F-]{36})",
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as {
        title?: string; summary?: string; section?: string; instructor?: string;
        duration_seconds?: number; transcript_snippet?: string;
      };
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        if (!(await isAcademyAdmin(session, orgId)) || !(await ownedChapter(req.params.id, orgId))) {
          return res.status(403).json({ error: "krever_org_admin" });
        }
        await pool.query(
          `UPDATE leadgrid_academy_chapters SET
             title = COALESCE($2, title),
             summary = COALESCE($3, summary),
             section = COALESCE($4, section),
             instructor = COALESCE($5, instructor),
             duration_seconds = COALESCE($6, duration_seconds),
             transcript_snippet = COALESCE($7, transcript_snippet),
             updated_at = NOW()
           WHERE id = $1::uuid`,
          [
            req.params.id, body.title?.trim() || null, body.summary ?? null,
            body.section ?? null, body.instructor ?? null,
            typeof body.duration_seconds === "number" ? body.duration_seconds : null,
            body.transcript_snippet ?? null,
          ],
        );
        return res.json({ ok: true });
      } catch (err) {
        console.error("[leadgrid-academy] oppdater kapittel feilet:", err);
        return res.status(500).json({ error: "academy_chapter_update_failed" });
      }
    },
  );

  // ── DELETE /api/leadgrid/academy/chapters/:id ─────────────────────
  app.delete(
    "/api/leadgrid/academy/chapters/:id([0-9a-fA-F-]{36})",
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        if (!(await isAcademyAdmin(session, orgId)) || !(await ownedChapter(req.params.id, orgId))) {
          return res.status(403).json({ error: "krever_org_admin" });
        }
        await pool.query(
          `DELETE FROM leadgrid_academy_chapters WHERE id = $1::uuid`,
          [req.params.id],
        );
        return res.json({ ok: true });
      } catch (err) {
        console.error("[leadgrid-academy] slett kapittel feilet:", err);
        return res.status(500).json({ error: "academy_chapter_delete_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/academy/chapters/:id/video-upload-url ──────
  app.post(
    "/api/leadgrid/academy/chapters/:id([0-9a-fA-F-]{36})/video-upload-url",
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const contentType = String((req.body ?? {}).content_type ?? "video/mp4");
      if (!/^video\/[a-z0-9.+-]+$/i.test(contentType)) {
        return res.status(400).json({ error: "ugyldig_content_type" });
      }
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        if (!(await isAcademyAdmin(session, orgId)) || !(await ownedChapter(req.params.id, orgId))) {
          return res.status(403).json({ error: "krever_org_admin" });
        }
        const b2 = getB2Config();
        if (!b2) {
          return res.status(503).json({ error: "lagring_ikke_konfigurert" });
        }
        const ext = contentType.includes("quicktime") ? "mov" : "mp4";
        const key = `leadgrid-academy/${orgId}/${req.params.id}/video-${Date.now()}.${ext}`;
        const url = await getSignedUrl(
          b2.client,
          new PutObjectCommand({ Bucket: b2.bucketName, Key: key, ContentType: contentType }),
          { expiresIn: UPLOAD_URL_TTL_SECONDS },
        );
        return res.json({ url, key });
      } catch (err) {
        console.error("[leadgrid-academy] upload-url feilet:", err);
        return res.status(500).json({ error: "academy_upload_url_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/academy/chapters/:id/video-attach ──────────
  app.post(
    "/api/leadgrid/academy/chapters/:id([0-9a-fA-F-]{36})/video-attach",
    async (req: Request, res: Response) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as { key?: string; duration_seconds?: number };
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        if (!(await isAcademyAdmin(session, orgId)) || !(await ownedChapter(req.params.id, orgId))) {
          return res.status(403).json({ error: "krever_org_admin" });
        }
        // Nøkkelen må ligge under kapittelets egen prefix — hindrer at en
        // org peker på andres objekter.
        const expectedPrefix = `leadgrid-academy/${orgId}/${req.params.id}/`;
        if (!body.key || !body.key.startsWith(expectedPrefix)) {
          return res.status(400).json({ error: "ugyldig_key" });
        }
        await pool.query(
          `UPDATE leadgrid_academy_chapters SET
             video_r2_key = $2,
             duration_seconds = COALESCE($3, duration_seconds),
             updated_at = NOW()
           WHERE id = $1::uuid`,
          [
            req.params.id, body.key,
            typeof body.duration_seconds === "number" && body.duration_seconds > 0
              ? Math.min(body.duration_seconds, 24 * 3600) : null,
          ],
        );
        return res.json({ ok: true });
      } catch (err) {
        console.error("[leadgrid-academy] video-attach feilet:", err);
        return res.status(500).json({ error: "academy_video_attach_failed" });
      }
    },
  );

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
        const b2 = getB2Config();
        if (!b2) return res.status(503).json({ error: "lagring_ikke_konfigurert" });
        const url = await getSignedUrl(
          b2.client,
          new GetObjectCommand({ Bucket: b2.bucketName, Key: key }),
          { expiresIn: PLAYBACK_URL_TTL_SECONDS },
        );
        return res.json({ url });
      } catch (err) {
        console.error("[leadgrid-academy] video-url feilet:", err);
        return res.status(500).json({ error: "academy_video_failed" });
      }
    },
  );
}
