/**
 * admin-announcements-routes.ts — Task #121b
 *
 * Backer Marketing-fanen i Admin Room. Den eksisterende UI-en
 * (frontend/client/src/components/admin/AnnouncementCreator.tsx +
 * MarketingWorkflowIntegration.tsx + AnnouncementEmailManager.tsx +
 * MarketingSEODashboard) kaller `/api/admin/announcements*` for å lage
 * in-app banner-/modal-/toast-meldinger og nyhetsbrev-utkast — disse
 * endepunktene var aldri implementert. Dette filen + migrasjon 251 dekker
 * CRUD + publish/unpublish + stats.
 *
 * Endpoints (alle admin-only):
 *   GET    /api/admin/announcements?published=true&limit=50
 *   POST   /api/admin/announcements
 *   PUT    /api/admin/announcements/:id
 *   POST   /api/admin/announcements/:id/publish
 *   POST   /api/admin/announcements/:id/unpublish
 *   DELETE /api/admin/announcements/:id
 *   GET    /api/admin/announcements/:id/stats
 *
 * Defensiv: alle handlers prøver `to_regclass('public.announcements')`
 * først og returnerer tom liste eller skjema-feil hvis migrasjonen ikke
 * er kjørt. Tabellene opprettes lazy via ensureSchema() ved første kall.
 *
 * Wired i index.ts via setupAdminAnnouncementsRoutes(...).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";

export interface AdminAnnouncementsDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
  requireAdminSession?: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string; loginAt: string } | null;
}

const VALID_TYPES = ["banner", "modal", "toast", "email"];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];

function isValidAudience(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (["all", "admins", "photographers"].includes(v)) return true;
  // role:<X> form
  if (/^role:[a-zA-Z0-9_-]+$/.test(v)) return true;
  return false;
}

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      announcement_type TEXT NOT NULL DEFAULT 'banner',
      target_audience TEXT NOT NULL DEFAULT 'all',
      priority TEXT NOT NULL DEFAULT 'medium',
      is_published BOOLEAN NOT NULL DEFAULT FALSE,
      published_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      view_count INTEGER NOT NULL DEFAULT 0,
      dismissed_count INTEGER NOT NULL DEFAULT 0,
      cta_label TEXT,
      cta_url TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => undefined);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS announcements_published_idx
      ON announcements (is_published, published_at DESC)
      WHERE is_published = TRUE
  `).catch(() => undefined);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcement_views (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      user_id UUID,
      was_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
      was_clicked BOOLEAN NOT NULL DEFAULT FALSE,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => undefined);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS announcement_views_announcement_idx
      ON announcement_views (announcement_id)
  `).catch(() => undefined);
}

async function announcementsTableExists(pool: any): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT to_regclass('public.announcements') AS reg`,
    );
    return !!r.rows?.[0]?.reg;
  } catch {
    return false;
  }
}

function rowToAnnouncement(r: any): any {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    announcementType: r.announcement_type,
    targetAudience: r.target_audience,
    priority: r.priority,
    isPublished: r.is_published,
    publishedAt: r.published_at,
    expiresAt: r.expires_at,
    viewCount: r.view_count,
    dismissedCount: r.dismissed_count,
    ctaLabel: r.cta_label,
    ctaUrl: r.cta_url,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function setupAdminAnnouncementsRoutes(deps: AdminAnnouncementsDeps): void {
  const { app, pool, getPricingUserId, requireAdminSession } = deps;

  // ─── GET /api/admin/announcements ─────────────────────────────
  app.get("/api/admin/announcements", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      if (!(await announcementsTableExists(pool))) {
        await ensureSchema(pool);
      }
      const publishedFilter = req.query?.published;
      const limitRaw = Number(req.query?.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 500 ? Math.floor(limitRaw) : 50;

      const where: string[] = [];
      const vals: any[] = [];
      if (publishedFilter === "true") {
        where.push(`is_published = TRUE`);
      } else if (publishedFilter === "false") {
        where.push(`is_published = FALSE`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      vals.push(limit);

      const listSql = `
        SELECT *
          FROM announcements
          ${whereSql}
          ORDER BY created_at DESC
          LIMIT $${vals.length}
      `;
      const countSql = `SELECT COUNT(*)::int AS total FROM announcements ${whereSql}`;

      const [listR, countR] = await Promise.all([
        pool.query(listSql, vals),
        pool.query(countSql, vals.slice(0, vals.length - 1)),
      ]);

      res.json({
        announcements: listR.rows.map(rowToAnnouncement),
        total: countR.rows?.[0]?.total ?? 0,
      });
    } catch (err) {
      console.error("GET /admin/announcements:", err);
      res.json({ announcements: [], total: 0 });
    }
  });

  // ─── POST /api/admin/announcements ────────────────────────────
  app.post("/api/admin/announcements", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const b = req.body ?? {};
      const title = typeof b.title === "string" ? b.title.trim().slice(0, 300) : "";
      const content = typeof b.content === "string" ? b.content.trim().slice(0, 8000) : "";
      const type = VALID_TYPES.includes(b.type) ? b.type : "banner";
      const audience = isValidAudience(b.audience) ? b.audience : "all";
      const priority = VALID_PRIORITIES.includes(b.priority) ? b.priority : "medium";
      const ctaLabel = typeof b.ctaLabel === "string" && b.ctaLabel.trim() ? b.ctaLabel.trim().slice(0, 200) : null;
      const ctaUrl = typeof b.ctaUrl === "string" && b.ctaUrl.trim() ? b.ctaUrl.trim().slice(0, 2000) : null;
      const expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
      const createdBy = getPricingUserId(req) || null;

      if (!title || !content) {
        return res.status(400).json({ error: "title og content er påkrevd" });
      }
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        return res.status(400).json({ error: "expiresAt er ikke gyldig dato" });
      }

      const ins = await pool.query(
        `INSERT INTO announcements
           (title, content, announcement_type, target_audience, priority,
            cta_label, cta_url, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [title, content, type, audience, priority, ctaLabel, ctaUrl, expiresAt, createdBy],
      );
      res.status(201).json({ success: true, id: ins.rows[0].id });
    } catch (err) {
      console.error("POST /admin/announcements:", err);
      res.status(500).json({ error: "Kunne ikke opprette announcement" });
    }
  });

  // ─── PUT /api/admin/announcements/:id ─────────────────────────
  app.put("/api/admin/announcements/:id", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      if (!(await announcementsTableExists(pool))) {
        return res.status(503).json({ error: "Skjema ikke initialisert" });
      }
      const b = req.body ?? {};
      const id = req.params.id;

      // Bygg partial UPDATE via COALESCE — NULL = behold eksisterende
      const title = typeof b.title === "string" ? b.title.trim().slice(0, 300) : null;
      const content = typeof b.content === "string" ? b.content.trim().slice(0, 8000) : null;
      const type = VALID_TYPES.includes(b.type) ? b.type : null;
      const audience = isValidAudience(b.audience) ? b.audience : null;
      const priority = VALID_PRIORITIES.includes(b.priority) ? b.priority : null;
      const ctaLabel = typeof b.ctaLabel === "string" ? b.ctaLabel.slice(0, 200) : null;
      const ctaUrl = typeof b.ctaUrl === "string" ? b.ctaUrl.slice(0, 2000) : null;
      const expiresAt =
        b.expiresAt === null ? null :
        b.expiresAt ? new Date(b.expiresAt) : null;
      const hasExpiresAt = b.expiresAt !== undefined;

      const r = await pool.query(
        `UPDATE announcements SET
           title             = COALESCE($2, title),
           content           = COALESCE($3, content),
           announcement_type = COALESCE($4, announcement_type),
           target_audience   = COALESCE($5, target_audience),
           priority          = COALESCE($6, priority),
           cta_label         = CASE WHEN $7::text IS NOT NULL THEN $7 ELSE cta_label END,
           cta_url           = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE cta_url END,
           expires_at        = CASE WHEN $9::boolean THEN $10 ELSE expires_at END,
           updated_at        = NOW()
         WHERE id = $1
         RETURNING id`,
        [id, title, content, type, audience, priority, ctaLabel, ctaUrl, hasExpiresAt, expiresAt],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ success: true });
    } catch (err) {
      console.error("PUT /admin/announcements/:id:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere announcement" });
    }
  });

  // ─── POST /api/admin/announcements/:id/publish ────────────────
  app.post("/api/admin/announcements/:id/publish", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      if (!(await announcementsTableExists(pool))) {
        return res.status(503).json({ error: "Skjema ikke initialisert" });
      }
      const r = await pool.query(
        `UPDATE announcements
           SET is_published = TRUE,
               published_at = COALESCE(published_at, NOW()),
               updated_at   = NOW()
         WHERE id = $1
         RETURNING published_at`,
        [req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ success: true, publishedAt: r.rows[0].published_at });
    } catch (err) {
      console.error("POST /admin/announcements/:id/publish:", err);
      res.status(500).json({ error: "Kunne ikke publisere" });
    }
  });

  // ─── POST /api/admin/announcements/:id/unpublish ──────────────
  app.post("/api/admin/announcements/:id/unpublish", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      if (!(await announcementsTableExists(pool))) {
        return res.status(503).json({ error: "Skjema ikke initialisert" });
      }
      const r = await pool.query(
        `UPDATE announcements
           SET is_published = FALSE,
               updated_at   = NOW()
         WHERE id = $1
         RETURNING id`,
        [req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ success: true });
    } catch (err) {
      console.error("POST /admin/announcements/:id/unpublish:", err);
      res.status(500).json({ error: "Kunne ikke avpublisere" });
    }
  });

  // ─── DELETE /api/admin/announcements/:id ──────────────────────
  app.delete("/api/admin/announcements/:id", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      if (!(await announcementsTableExists(pool))) {
        return res.status(503).json({ error: "Skjema ikke initialisert" });
      }
      const r = await pool.query(
        `DELETE FROM announcements WHERE id = $1 RETURNING id`,
        [req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /admin/announcements/:id:", err);
      res.status(500).json({ error: "Kunne ikke slette announcement" });
    }
  });

  // ─── GET /api/admin/announcements/:id/stats ───────────────────
  app.get("/api/admin/announcements/:id/stats", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      if (!(await announcementsTableExists(pool))) {
        return res.json({
          viewCount: 0,
          dismissedCount: 0,
          clickCount: 0,
          dismissRate: 0,
          clickRate: 0,
        });
      }
      const r = await pool.query(
        `SELECT
            a.view_count            AS view_count_counter,
            a.dismissed_count       AS dismissed_count_counter,
            COUNT(v.id)::int        AS view_count_logged,
            COALESCE(SUM(CASE WHEN v.was_dismissed THEN 1 ELSE 0 END), 0)::int AS dismissed_count_logged,
            COALESCE(SUM(CASE WHEN v.was_clicked  THEN 1 ELSE 0 END), 0)::int AS click_count_logged
           FROM announcements a
           LEFT JOIN announcement_views v ON v.announcement_id = a.id
          WHERE a.id = $1
          GROUP BY a.id, a.view_count, a.dismissed_count`,
        [req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      const row = r.rows[0];

      // Foretrekk view-logg når det finnes, ellers counter på rader.
      const viewCount = row.view_count_logged > 0
        ? row.view_count_logged
        : (row.view_count_counter || 0);
      const dismissedCount = row.dismissed_count_logged > 0
        ? row.dismissed_count_logged
        : (row.dismissed_count_counter || 0);
      const clickCount = row.click_count_logged || 0;

      const dismissRate = viewCount > 0 ? Number((dismissedCount / viewCount).toFixed(4)) : 0;
      const clickRate = viewCount > 0 ? Number((clickCount / viewCount).toFixed(4)) : 0;

      res.json({ viewCount, dismissedCount, clickCount, dismissRate, clickRate });
    } catch (err) {
      console.error("GET /admin/announcements/:id/stats:", err);
      res.status(500).json({ error: "Kunne ikke hente stats" });
    }
  });
}
