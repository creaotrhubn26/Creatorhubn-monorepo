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
 *   GET  /academy/chapters/:id/video-url → { url } (presignert storage-GET) |
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
 *   POST   /academy/chapters/:id/video-upload-url → presignert AWS S3-PUT (15 min)
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
import crypto from "node:crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import {
  getLeadgridObjectStorage,
  leadgridStorageKeys,
  type LeadgridStorageProvider,
} from "./leadgrid-s3-storage-service.js";
import { leadgridStoragePersistenceError } from "./leadgrid-org-storage-service.js";

// Legacy Backblaze B2 reader. Existing and platform-owned videos stay readable
// while every new organization-owned upload uses AWS_LEADGRID_* below.
const B2_REGION = process.env.B2_REGION || "us-west-001";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const PLAYBACK_URL_TTL_SECONDS = 30 * 60;
const MAX_ACADEMY_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const ACADEMY_VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
] as const;

function hasIsoBaseMediaSignature(prefix: Buffer): boolean {
  return prefix.length >= 12 && prefix.subarray(4, 8).toString("ascii") === "ftyp";
}

function getB2Config(): { bucketName: string; client: S3Client } | null {
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;
  if (!keyId || !appKey || !bucketName) return null;
  const client = new S3Client({
    region: B2_REGION,
    endpoint: B2_ENDPOINT,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    forcePathStyle: true,
  });
  return { bucketName, client };
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      if (!orgId) return res.status(400).json({ error: "ingen_organisasjon" });
      // A chapter id is never enough authorization on its own. Only a
      // published official course or a published course owned by this org
      // may receive progress for this tenant.
      const visible = await pool.query(
        `SELECT 1
           FROM leadgrid_academy_chapters ch
           JOIN leadgrid_academy_courses c ON c.id = ch.course_id
          WHERE ch.id = $1::uuid AND c.is_published = TRUE
            AND (c.scope = 'leadgrid_official' OR c.organization_id = $2)
          LIMIT 1`,
        [body.chapter_id, orgId],
      );
      if (!visible.rows[0]) {
        return res.status(404).json({ error: "chapter_not_visible" });
      }
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

  /// Global admin/super_admin, eller lederrolle i aktiv Leadgrid-org.
  async function isAcademyAdmin(session: SessionUser, orgId: string): Promise<boolean> {
    if (session.role === "admin" || session.role === "super_admin") return true;
    const r = await pool.query(
      `SELECT 1
         WHERE EXISTS (
           SELECT 1 FROM organization_members
            WHERE user_id = $1 AND organization_id = $2::uuid
              AND role IN ('admin', 'salgssjef', 'teamleder')
         ) OR EXISTS (
           SELECT 1 FROM enterprise_team_members
            WHERE user_id = $1 AND organization_id = $2
              AND status = 'active' AND role = 'admin'
         )
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
    "/api/leadgrid/academy/courses/:id",
    async (req: Request, res: Response) => {
      if (!UUID_RE.test(req.params.id)) {
        return res.status(400).json({ error: "ugyldig_course_id" });
      }
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
    "/api/leadgrid/academy/courses/:id",
    async (req: Request, res: Response) => {
      if (!UUID_RE.test(req.params.id)) {
        return res.status(400).json({ error: "ugyldig_course_id" });
      }
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
    "/api/leadgrid/academy/courses/:id/chapters",
    async (req: Request, res: Response) => {
      if (!UUID_RE.test(req.params.id)) {
        return res.status(400).json({ error: "ugyldig_course_id" });
      }
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

  async function loadOwnedChapter(chapterId: string, orgId: string): Promise<{
    chapterId: string;
    courseId: string;
    videoKey: string | null;
    storageProvider: LeadgridStorageProvider;
    storageObjectId: string | null;
  } | null> {
    const r = await pool.query<{
      chapter_id: string;
      course_id: string;
      video_r2_key: string | null;
      video_storage_provider: LeadgridStorageProvider;
      video_storage_object_id: string | null;
    }>(
      `SELECT ch.id::text AS chapter_id, ch.course_id::text,
              ch.video_r2_key, ch.video_storage_provider,
              ch.video_storage_object_id::text
         FROM leadgrid_academy_chapters ch
         JOIN leadgrid_academy_courses c ON c.id = ch.course_id
        WHERE ch.id = $1::uuid AND c.scope = 'org'
          AND c.organization_id = $2`,
      [chapterId, orgId],
    );
    const row = r.rows[0];
    return row ? {
      chapterId: row.chapter_id,
      courseId: row.course_id,
      videoKey: row.video_r2_key,
      storageProvider: row.video_storage_provider,
      storageObjectId: row.video_storage_object_id,
    } : null;
  }

  // ── PATCH /api/leadgrid/academy/chapters/:id ──────────────────────
  app.patch(
    "/api/leadgrid/academy/chapters/:id",
    async (req: Request, res: Response) => {
      if (!UUID_RE.test(req.params.id)) {
        return res.status(400).json({ error: "ugyldig_chapter_id" });
      }
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
    "/api/leadgrid/academy/chapters/:id",
    async (req: Request, res: Response) => {
      if (!UUID_RE.test(req.params.id)) {
        return res.status(400).json({ error: "ugyldig_chapter_id" });
      }
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
    "/api/leadgrid/academy/chapters/:id/video-upload-url",
    async (req: Request, res: Response) => {
      if (!UUID_RE.test(req.params.id)) {
        return res.status(400).json({ error: "ugyldig_chapter_id" });
      }
      const session = requireUserSession(req, res);
      if (!session) return;
      const contentType = String((req.body ?? {}).content_type ?? "video/mp4").toLowerCase();
      if (!ACADEMY_VIDEO_CONTENT_TYPES.includes(contentType as typeof ACADEMY_VIDEO_CONTENT_TYPES[number])) {
        return res.status(400).json({ error: "ugyldig_content_type" });
      }
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        const chapter = await loadOwnedChapter(req.params.id, orgId);
        if (!(await isAcademyAdmin(session, orgId)) || !chapter) {
          return res.status(403).json({ error: "krever_org_admin" });
        }
        const storage = getLeadgridObjectStorage();
        if (!storage) {
          return res.status(503).json({ error: "lagring_ikke_konfigurert" });
        }
        const key = leadgridStorageKeys.temporaryAcademyVideo({
          organizationId: orgId,
          chapterId: chapter.chapterId,
          uploadId: crypto.randomUUID(),
        });
        const url = await storage.createUploadUrl({
          key,
          contentType,
          ttlSeconds: UPLOAD_URL_TTL_SECONDS,
        });
        return res.json({ url, key, storage_provider: "aws_s3" });
      } catch (err) {
        console.error("[leadgrid-academy] upload-url feilet:", err);
        return res.status(500).json({ error: "academy_upload_url_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/academy/chapters/:id/video-attach ──────────
  app.post(
    "/api/leadgrid/academy/chapters/:id/video-attach",
    async (req: Request, res: Response) => {
      if (!UUID_RE.test(req.params.id)) {
        return res.status(400).json({ error: "ugyldig_chapter_id" });
      }
      const session = requireUserSession(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as { key?: string; duration_seconds?: number };
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        const chapter = await loadOwnedChapter(req.params.id, orgId);
        if (!(await isAcademyAdmin(session, orgId)) || !chapter) {
          return res.status(403).json({ error: "krever_org_admin" });
        }
        const expectedPrefix =
          `temporary/organizations/${orgId.toLowerCase()}` +
          `/academy/chapters/${req.params.id.toLowerCase()}/uploads/`;
        const uploadSuffix = body.key?.slice(expectedPrefix.length) ?? "";
        const uploadParts = uploadSuffix.split("/");
        if (
          !body.key?.startsWith(expectedPrefix) ||
          uploadParts.length !== 2 ||
          !UUID_RE.test(uploadParts[0]) ||
          uploadParts[1] !== "original"
        ) {
          return res.status(400).json({ error: "ugyldig_key" });
        }
        const storage = getLeadgridObjectStorage();
        if (!storage) {
          return res.status(503).json({ error: "lagring_ikke_konfigurert" });
        }
        const storageObjectId = crypto.randomUUID();
        const finalKey = leadgridStorageKeys.academyVideo({
          organizationId: orgId,
          courseId: chapter.courseId,
          chapterId: chapter.chapterId,
          assetId: storageObjectId,
        });
        let finalized;
        try {
          finalized = await storage.finalizeTemporaryObject({
            temporaryKey: body.key,
            finalKey,
            allowedContentTypes: ACADEMY_VIDEO_CONTENT_TYPES,
            maxBytes: MAX_ACADEMY_VIDEO_BYTES,
            purpose: "academy_video",
            validatePrefix: hasIsoBaseMediaSignature,
          });
        } catch (error) {
          console.error("[leadgrid-academy] video-finalisering feilet:", error);
          return res.status(422).json({ error: "academy_video_validation_failed" });
        }
        try {
          const saved = await pool.query(
            `WITH stored AS (
               INSERT INTO leadgrid_storage_objects
                 (id, organization_id, uploaded_by, storage_provider,
                  bucket_name, object_key, purpose, display_name, size_bytes,
                  content_type, checksum_sha256, metadata)
               VALUES
                 ($1::uuid, $2::uuid, $3, 'aws_s3', $4, $5,
                  'academy_video', 'Academy-video', $6, $7, $8, $9::jsonb)
               RETURNING id
             )
             UPDATE leadgrid_academy_chapters ch SET
               video_r2_key = $5,
               video_storage_provider = 'aws_s3',
               video_storage_object_id = stored.id,
               video_size_bytes = $6,
               video_content_type = $7,
               video_checksum_sha256 = $8,
               duration_seconds = COALESCE($10, ch.duration_seconds),
               updated_at = NOW()
             FROM stored, leadgrid_academy_courses c
             WHERE ch.id = $11::uuid AND c.id = ch.course_id
               AND c.scope = 'org' AND c.organization_id = $2
             RETURNING ch.id`,
            [
              storageObjectId,
              orgId,
              session.userId,
              finalized.bucket,
              finalized.key,
              finalized.sizeBytes,
              finalized.contentType,
              finalized.checksumSha256,
              JSON.stringify({ courseId: chapter.courseId, chapterId: chapter.chapterId }),
              typeof body.duration_seconds === "number" && body.duration_seconds > 0
                ? Math.min(body.duration_seconds, 24 * 3600) : null,
              req.params.id,
            ],
          );
          if (!saved.rowCount) throw new Error("Academy-kapittelet ble ikke oppdatert");
        } catch (error) {
          await storage.deleteObject(finalized.key).catch(() => undefined);
          throw error;
        }

        if (
          chapter.storageProvider === "aws_s3" &&
          chapter.videoKey &&
          chapter.storageObjectId
        ) {
          try {
            await pool.query(
              `UPDATE leadgrid_storage_objects SET deleted_at = NOW()
                WHERE id = $1::uuid AND deleted_at IS NULL`,
              [chapter.storageObjectId],
            );
            await storage.deleteObject(chapter.videoKey);
          } catch (error) {
            await pool.query(
              `UPDATE leadgrid_storage_objects SET deleted_at = NULL
                WHERE id = $1::uuid AND deleted_at IS NOT NULL`,
              [chapter.storageObjectId],
            ).catch(() => undefined);
            console.error("[leadgrid-academy] gammel video-opprydding feilet:", error);
            return res.json({ ok: true });
          }
          await pool.query(
            `DELETE FROM leadgrid_storage_objects WHERE id = $1::uuid`,
            [chapter.storageObjectId],
          ).catch((error) => {
            console.error("[leadgrid-academy] gammel videometadata-opprydding feilet:", error);
          });
        }
        return res.json({ ok: true });
      } catch (err) {
        console.error("[leadgrid-academy] video-attach feilet:", err);
        const storageError = leadgridStoragePersistenceError(err);
        if (storageError) return res.status(storageError.status).json({ error: storageError.code });
        return res.status(500).json({ error: "academy_video_attach_failed" });
      }
    },
  );

  // ── GET /api/leadgrid/academy/chapters/:id/video-url ──────────────
  app.get(
    "/api/leadgrid/academy/chapters/:id/video-url",
    async (req: Request, res: Response) => {
      if (!UUID_RE.test(req.params.id)) {
        return res.status(400).json({ error: "ugyldig_chapter_id" });
      }
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        const orgId = await resolveOrgIdForUser(pool, session.userId);
        // Synlighets-sjekk: kapittelets kurs må være offisielt eller org-ens eget.
        const r = await pool.query<{
          video_r2_key: string | null;
          video_storage_provider: LeadgridStorageProvider;
        }>(
          `SELECT ch.video_r2_key, ch.video_storage_provider
             FROM leadgrid_academy_chapters ch
             JOIN leadgrid_academy_courses c ON c.id = ch.course_id
            WHERE ch.id = $1::uuid AND c.is_published = TRUE
              AND (c.scope = 'leadgrid_official' OR c.organization_id = $2)`,
          [req.params.id, orgId],
        );
        const key = r.rows[0]?.video_r2_key ?? null;
        if (!r.rows.length) return res.status(404).json({ error: "not_found" });
        if (!key) return res.status(404).json({ error: "ingen_video" });
        let url: string;
        if (r.rows[0].video_storage_provider === "aws_s3") {
          const storage = getLeadgridObjectStorage();
          if (!storage) return res.status(503).json({ error: "lagring_ikke_konfigurert" });
          url = await storage.createDownloadUrl(key, PLAYBACK_URL_TTL_SECONDS);
        } else {
          const b2 = getB2Config();
          if (!b2) return res.status(503).json({ error: "lagring_ikke_konfigurert" });
          url = await getSignedUrl(
            b2.client,
            new GetObjectCommand({ Bucket: b2.bucketName, Key: key }),
            { expiresIn: PLAYBACK_URL_TTL_SECONDS },
          );
        }
        return res.json({ url });
      } catch (err) {
        console.error("[leadgrid-academy] video-url feilet:", err);
        return res.status(500).json({ error: "academy_video_failed" });
      }
    },
  );
}
