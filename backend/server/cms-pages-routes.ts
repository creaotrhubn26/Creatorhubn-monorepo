/**
 * cms-pages-routes.ts
 *
 * 4 endpoints for cms_pages-tabellen (migrasjon 141):
 *   - GET    /api/cms/pages/:slug              — public read (uten auth)
 *   - GET    /api/admin/cms/pages              — admin list
 *   - GET    /api/admin/cms/pages/:slug        — admin read (incl drafts)
 *   - PUT    /api/admin/cms/pages/:slug        — admin upsert
 *
 * Public-read returnerer KUN published content. Admin-read returnerer alt.
 * Upsert oppretter raden hvis ikke eksisterer.
 *
 * Robusthet:
 *   - Public endpoint cacher 5 min (HTTP cache-header) for å holde
 *     CDN-trykket nede
 *   - 404 ved manglende eller upublisert slug → frontend faller
 *     tilbake til hardkodet default
 *   - Slug-validering: kun a-z 0-9 og bindestreker
 *   - Content-felt valideres som plain object (ikke array eller null)
 */

import type express from 'express';
import type { Pool } from 'pg';
import multer from 'multer';
import { uploadCmsMedia, isCmsMediaConfigured } from './cms-media-service.js';

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface CmsPagesRoutesDeps {
  app: express.Express;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

interface CmsPageRow {
  slug: string;
  variant: string;
  content: unknown;
  published: boolean;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length <= 80;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
  );
}

function serialize(row: CmsPageRow): Record<string, unknown> {
  return {
    slug: row.slug,
    variant: row.variant,
    content: row.content ?? {},
    published: row.published,
    created_at: row.created_at?.toISOString?.() ?? row.created_at,
    updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
    updated_by: row.updated_by ?? undefined,
  };
}

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]);

const cmsMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export function setupCmsPagesRoutes(deps: CmsPagesRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ── PUBLIC GET — kun published content innenfor publish-vindu ───
  // Schedule-publish er read-time-filtrert: en side er synlig hvis
  // published = true OG publish_at er passert (eller null) OG
  // unpublish_at er i fremtiden (eller null). Ingen cron-job
  // nødvendig — SQL filtrerer dynamisk.
  app.get('/api/cms/pages/:slug', async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!isValidSlug(slug)) {
      return res.status(400).json({ success: false, error: 'Ugyldig slug' });
    }

    try {
      const result = await pool.query<CmsPageRow>(
        `SELECT * FROM cms_pages
         WHERE slug = $1
           AND published = true
           AND (publish_at IS NULL OR publish_at <= NOW())
           AND (unpublish_at IS NULL OR unpublish_at > NOW())`,
        [slug],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Side ikke funnet' });
      }
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      return res.json({ success: true, page: serialize(result.rows[0]) });
    } catch (error) {
      console.error('[cms-pages] public-get failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste innhold' });
    }
  });

  // ── ADMIN LIST — alle pages, inkl utkast ────────────────────────
  app.get('/api/admin/cms/pages', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    try {
      const result = await pool.query<CmsPageRow>(
        'SELECT * FROM cms_pages ORDER BY variant, slug',
      );
      return res.json({ success: true, pages: result.rows.map(serialize) });
    } catch (error) {
      console.error('[cms-pages] list failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste pages', pages: [] });
    }
  });

  // ── ADMIN GET — én side, inkl utkast ────────────────────────────
  app.get('/api/admin/cms/pages/:slug', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!isValidSlug(slug)) {
      return res.status(400).json({ success: false, error: 'Ugyldig slug' });
    }

    try {
      const result = await pool.query<CmsPageRow>(
        'SELECT * FROM cms_pages WHERE slug = $1',
        [slug],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Side ikke funnet' });
      }
      return res.json({ success: true, page: serialize(result.rows[0]) });
    } catch (error) {
      console.error('[cms-pages] admin-get failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste side' });
    }
  });

  // ── ADMIN UPSERT — opprett eller oppdater + revisjon-snapshot ───
  app.put('/api/admin/cms/pages/:slug', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!isValidSlug(slug)) {
      return res.status(400).json({ success: false, error: 'Ugyldig slug' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const content = body.content;
    if (!isPlainObject(content)) {
      return res.status(400).json({
        success: false,
        error: 'content må være et JSON-objekt',
      });
    }

    const variant = typeof body.variant === 'string' ? body.variant.slice(0, 32) : 'generic';
    const published = body.published !== false; // default true
    const publishAt = typeof body.publish_at === 'string' ? body.publish_at : null;
    const unpublishAt = typeof body.unpublish_at === 'string' ? body.unpublish_at : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Snapshot forrige versjon til revisions FØR upsert
      const existing = await client.query<CmsPageRow>(
        'SELECT * FROM cms_pages WHERE slug = $1',
        [slug],
      );
      if (existing.rows.length > 0) {
        const prev = existing.rows[0];
        await client.query(
          `INSERT INTO cms_page_revisions (slug, content, variant, published, created_by)
           VALUES ($1, $2::jsonb, $3, $4, $5)`,
          [slug, JSON.stringify(prev.content ?? {}), prev.variant, prev.published, session.email],
        );
      }

      const result = await client.query<CmsPageRow>(
        `INSERT INTO cms_pages (slug, variant, content, published, publish_at, unpublish_at, updated_by)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
         ON CONFLICT (slug) DO UPDATE
           SET content = EXCLUDED.content,
               variant = EXCLUDED.variant,
               published = EXCLUDED.published,
               publish_at = EXCLUDED.publish_at,
               unpublish_at = EXCLUDED.unpublish_at,
               updated_by = EXCLUDED.updated_by
         RETURNING *`,
        [slug, variant, JSON.stringify(content), published, publishAt, unpublishAt, session.email],
      );
      await client.query('COMMIT');
      return res.json({ success: true, page: serialize(result.rows[0]) });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[cms-pages] upsert failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke lagre' });
    } finally {
      client.release();
    }
  });

  // ── ADMIN REVISIONS — list historiske versjoner ─────────────────
  app.get('/api/admin/cms/pages/:slug/revisions', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!isValidSlug(slug)) {
      return res.status(400).json({ success: false, error: 'Ugyldig slug' });
    }

    try {
      const result = await pool.query(
        `SELECT id, slug, content, variant, published, created_at, created_by
         FROM cms_page_revisions
         WHERE slug = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [slug],
      );
      return res.json({
        success: true,
        revisions: result.rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          content: r.content ?? {},
          variant: r.variant,
          published: r.published,
          created_at: r.created_at?.toISOString?.() ?? r.created_at,
          created_by: r.created_by ?? undefined,
        })),
      });
    } catch (error) {
      console.error('[cms-pages] revisions failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste revisjoner', revisions: [] });
    }
  });

  // ── ADMIN REVERT — rull tilbake til en revisjon ─────────────────
  app.post('/api/admin/cms/pages/:slug/revert/:revisionId', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const slug = String(req.params.slug || '').trim().toLowerCase();
    const revisionId = parseInt(String(req.params.revisionId || ''), 10);
    if (!isValidSlug(slug) || !Number.isFinite(revisionId)) {
      return res.status(400).json({ success: false, error: 'Ugyldig slug eller revisjon-id' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const revResult = await client.query(
        'SELECT * FROM cms_page_revisions WHERE id = $1 AND slug = $2',
        [revisionId, slug],
      );
      if (revResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Revisjon ikke funnet' });
      }
      const rev = revResult.rows[0];

      // Snapshot current før revert (slik at man kan revert revert-en)
      const current = await client.query<CmsPageRow>(
        'SELECT * FROM cms_pages WHERE slug = $1',
        [slug],
      );
      if (current.rows.length > 0) {
        const cur = current.rows[0];
        await client.query(
          `INSERT INTO cms_page_revisions (slug, content, variant, published, created_by)
           VALUES ($1, $2::jsonb, $3, $4, $5)`,
          [slug, JSON.stringify(cur.content ?? {}), cur.variant, cur.published, `${session.email} (auto-revert-snapshot)`],
        );
      }

      const result = await client.query<CmsPageRow>(
        `UPDATE cms_pages
         SET content = $1::jsonb, variant = $2, updated_by = $3
         WHERE slug = $4
         RETURNING *`,
        [JSON.stringify(rev.content ?? {}), rev.variant, `${session.email} (revert)`, slug],
      );
      await client.query('COMMIT');
      return res.json({ success: true, page: serialize(result.rows[0]) });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[cms-pages] revert failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke rulle tilbake' });
    } finally {
      client.release();
    }
  });

  // ── ADMIN MEDIA UPLOAD — laster bilde til R2 for Image-block ────
  // POST /api/admin/cms/media/upload   (multipart/form-data, field 'file')
  // Returnerer { url, key } som settes som src i ImageBlock.
  app.get('/api/admin/cms/media/config', (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    return res.json({ success: true, configured: isCmsMediaConfigured() });
  });

  app.post(
    '/api/admin/cms/media/upload',
    cmsMediaUpload.single('file'),
    async (req, res) => {
      const session = requireAdminSession(req, res);
      if (!session) return;

      const file = (req as express.Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'file mangler' });
      }
      const mime = file.mimetype || 'application/octet-stream';
      if (!ALLOWED_IMAGE_MIME.has(mime)) {
        return res.status(415).json({ success: false, error: `mime ikke støttet: ${mime}` });
      }
      const result = await uploadCmsMedia({
        buffer: file.buffer,
        mime,
        originalName: file.originalname,
      });
      if (!result.ok) {
        const statusByError: Record<string, number> = {
          storage_not_configured: 503,
          unsupported_mime: 415,
          upload_failed: 500,
        };
        return res.status(statusByError[result.error] ?? 500).json({
          success: false,
          error: result.error,
          detail: result.detail,
        });
      }
      return res.json({ success: true, url: result.url, key: result.key, mode: result.mode });
    },
  );

  // ── ADMIN DELETE — slett en side ────────────────────────────────
  app.delete('/api/admin/cms/pages/:slug', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!isValidSlug(slug)) {
      return res.status(400).json({ success: false, error: 'Ugyldig slug' });
    }

    try {
      const result = await pool.query(
        'DELETE FROM cms_pages WHERE slug = $1 RETURNING slug',
        [slug],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Side ikke funnet' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('[cms-pages] delete failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke slette' });
    }
  });
}
