import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import nodemailer from "nodemailer";

export interface PhotographerGalleriesRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  buildGalleryShareUrl: (accessToken: string) => string;
  ensureCanonicalClientId: (
    photographerId: string,
    email: string,
    clientName: string | null,
  ) => Promise<string | null>;
  recordAnalyticsEvent: (eventType: string, opts: any) => void;
  ensureAnalyticsEventsSchema: () => Promise<void>;
  ensureGalleryDownloadAuditSchema: () => Promise<void>;
  ensureVideoTimecodeCommentsSchema: () => Promise<void>;
  escapeHtml: (value: string) => string;
}

export function setupPhotographerGalleriesRoutes(
  deps: PhotographerGalleriesRoutesDeps,
): void {
  const {
    app,
    pool,
    requireUserSession,
    buildGalleryShareUrl,
    ensureCanonicalClientId,
    recordAnalyticsEvent,
    ensureAnalyticsEventsSchema,
    ensureGalleryDownloadAuditSchema,
    ensureVideoTimecodeCommentsSchema,
    escapeHtml,
  } = deps;

  async function lookupDefaultPackageId(ownerUserId: string): Promise<string | null> {
    if (!ownerUserId) return null;
    try {
      const result = await pool.query(
        `SELECT id::text AS id FROM (
           SELECT id, created_at, true AS is_popular
           FROM packages
           WHERE user_id = $1 AND active = true AND popular = true
           UNION ALL
           SELECT id, created_at, false AS is_popular
           FROM packages
           WHERE user_id = $1 AND active = true AND popular = false
         ) p
         ORDER BY is_popular DESC, created_at DESC
         LIMIT 1`,
        [ownerUserId],
      );
      const id = result.rows[0]?.id;
      return typeof id === "string" && id ? id : null;
    } catch (err) {
      console.warn("[gallery-default-package] lookup failed", err);
      return null;
    }
  }

  async function lookupPackageImagesIncluded(
    packageId: string,
    ownerUserId: string,
  ): Promise<{ images: number | null; packageName: string | null }> {
    if (!packageId || !ownerUserId) return { images: null, packageName: null };
    try {
      const result = await pool.query(
        `SELECT name, inclusions FROM (
           SELECT package_name AS name, included_services AS inclusions
           FROM pricing_packages
           WHERE id::text = $1 AND user_id = $2
           UNION ALL
           SELECT name AS name, inclusions AS inclusions
           FROM packages
           WHERE id::text = $1 AND user_id = $2
         ) p LIMIT 1`,
        [packageId, ownerUserId],
      );
      const row = result.rows[0];
      if (!row) return { images: null, packageName: null };
      const inclusions = row.inclusions ?? {};
      const raw = (inclusions as Record<string, unknown>)?.images;
      const images = typeof raw === "number" && raw > 0 ? Math.floor(raw) : null;
      return { images, packageName: typeof row.name === "string" ? row.name : null };
    } catch (err) {
      console.warn("[gallery-package-lookup] failed", err);
      return { images: null, packageName: null };
    }
  }

  // GET /api/photographer/galleries — list galleries with engagement counts.
  app.get("/api/photographer/galleries", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      // Slice 9X.3 — surface linkedProjectTitle via a correlated
      // sub-select on the JSONB projectId so the photographer sees
      // "Linked to: Bryllup Ola og Kari" instead of an opaque UUID.
      const result = await pool.query(
        `SELECT
           g.id, g.client_name, g.client_email, g.project_title, g.access_token,
           g.status, g.gallery_settings, g.created_at, g.completed_at,
           (SELECT COUNT(*) FROM client_gallery_images WHERE gallery_id = g.id) AS image_count,
           (SELECT COUNT(*) FROM client_image_comments WHERE gallery_id = g.id) AS comment_count,
           (SELECT COUNT(*) FROM client_image_selections WHERE gallery_id = g.id AND selection_type = 'selected') AS selection_count,
           (SELECT COUNT(*) FROM client_image_selections WHERE gallery_id = g.id AND selection_type = 'favorite') AS favorite_count,
           (SELECT COUNT(*) FROM client_image_payments WHERE gallery_id = g.id AND payment_status = 'succeeded') AS paid_count,
           (SELECT title FROM projects WHERE id = (g.gallery_settings->>'projectId') LIMIT 1) AS linked_project_title,
           -- Slice 9X.5 — pricing-package linkage. Two tables exist
           -- (pricing_packages = newer, packages = legacy); UNION + LIMIT 1
           -- so whichever table the photographer's package lives in wins.
           (
             SELECT name FROM (
               SELECT package_name AS name FROM pricing_packages
               WHERE id::text = (g.gallery_settings->>'packageId')
               UNION ALL
               SELECT name AS name FROM packages
               WHERE id::text = (g.gallery_settings->>'packageId')
             ) p LIMIT 1
           ) AS linked_package_name,
           (
             SELECT (inclusions->>'images')::int FROM (
               SELECT included_services AS inclusions FROM pricing_packages
               WHERE id::text = (g.gallery_settings->>'packageId')
               UNION ALL
               SELECT inclusions AS inclusions FROM packages
               WHERE id::text = (g.gallery_settings->>'packageId')
             ) p LIMIT 1
           ) AS linked_package_images
         FROM photographer_client_galleries g
         WHERE g.photographer_id = $1
         ORDER BY g.created_at DESC
         LIMIT 200`,
        [session.userId],
      );
      res.json({
        galleries: result.rows.map((r: Record<string, unknown>) => {
          const settings = (r.gallery_settings ?? {}) as Record<string, unknown>;
          const safeSettings = { ...settings };
          delete safeSettings.passwordHash;
          const projectId = typeof settings.projectId === 'string' ? settings.projectId : null;
          return {
            id: r.id,
            clientName: r.client_name,
            clientEmail: r.client_email,
            projectTitle: r.project_title,
            accessToken: r.access_token,
            shareUrl: buildGalleryShareUrl(String(r.access_token ?? '')),
            status: r.status,
            gallerySettings: safeSettings,
            requiresPassword: typeof settings.passwordHash === 'string' && settings.requiresPassword === true,
            createdAt: r.created_at,
            completedAt: r.completed_at,
            imageCount: Number(r.image_count ?? 0),
            commentCount: Number(r.comment_count ?? 0),
            selectionCount: Number(r.selection_count ?? 0),
            favoriteCount: Number(r.favorite_count ?? 0),
            paidCount: Number(r.paid_count ?? 0),
            // Slice 9X.3 — project linkage. Both nullable; UI degrades
            // gracefully when missing.
            projectId,
            linkedProjectTitle: typeof r.linked_project_title === 'string' ? r.linked_project_title : null,
            // Slice 9X.5 — pricing-package linkage.
            packageId: typeof settings.packageId === 'string' ? settings.packageId : null,
            linkedPackageName: typeof r.linked_package_name === 'string' ? r.linked_package_name : null,
            linkedPackageImagesIncluded:
              typeof r.linked_package_images === 'number' ? r.linked_package_images : null,
          };
        }),
      });
    } catch (error) {
      console.error("[photographer-galleries] list failed", error);
      res.status(500).json({ error: "list_failed" });
    }
  });

  // POST /api/photographer/galleries — create empty gallery, return shareUrl.
  app.post("/api/photographer/galleries", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const clientName = String(req.body?.clientName ?? '').trim();
    const clientEmail = String(req.body?.clientEmail ?? '').trim().toLowerCase();
    const projectTitle = req.body?.projectTitle != null ? String(req.body.projectTitle).trim() : null;
    const projectId = req.body?.projectId != null ? String(req.body.projectId).trim() : null;
    // Slice 9X.5 — optional pricing-package linkage. When supplied, we
    // auto-fill contractedImages from package.inclusions.images so the
    // photographer doesn't have to retype the contract terms.
    const packageId = req.body?.packageId != null ? String(req.body.packageId).trim() : null;
    if (!clientName || !clientEmail || !clientEmail.includes('@')) {
      return res.status(400).json({ error: "client_name_and_email_required" });
    }
    try {
      const accessToken = crypto.randomBytes(24).toString('base64url');
      const settings: Record<string, unknown> = {
        source: 'web_dashboard',
        createdVia: 'photographer_dashboard',
      };
      if (projectId) settings.projectId = projectId;
      // Slice 9X.9 — when caller doesn't specify packageId, fall back
      // to photographer's default (popular-flagged) package from
      // PricingAdministration so new galleries inherit pricing without
      // an extra step.
      let effectivePackageId = packageId;
      if (!effectivePackageId) {
        const fallback = await lookupDefaultPackageId(session.userId);
        if (fallback) effectivePackageId = fallback;
      }
      if (effectivePackageId) {
        settings.packageId = effectivePackageId;
        const lookup = await lookupPackageImagesIncluded(effectivePackageId, session.userId);
        if (lookup.images != null) settings.contractedImages = lookup.images;
      }
      const canonicalClientId = await ensureCanonicalClientId(session.userId, clientEmail, clientName);
      // Slice 9X.9.A — also persist project_id to dedicated column (migration 0091)
      // so /api/photographer/projects/:id can join galleries directly.
      if (projectId) {
        try {
          await pool.query(
            `ALTER TABLE photographer_client_galleries ADD COLUMN IF NOT EXISTS project_id VARCHAR(64)`,
          );
        } catch { /* idempotent */ }
      }
      const result = await pool.query(
        `INSERT INTO photographer_client_galleries
           (photographer_id, client_name, client_email, project_title, access_token,
            gallery_settings, status, canonical_client_id, project_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, NOW(), NOW())
         RETURNING id, access_token, created_at`,
        [session.userId, clientName, clientEmail, projectTitle, accessToken, settings, canonicalClientId, projectId],
      );
      const row = result.rows[0];
      // Analytics — bind gallery-creation til økosystem-event-loggen.
      recordAnalyticsEvent('gallery.created', {
        entityType: 'gallery',
        entityId: String(row.id),
        actorUserId: session.userId,
        metadata: {
          clientEmail,
          projectTitle,
          projectId: projectId ?? null,
          packageId: effectivePackageId ?? null,
          source: 'web_dashboard',
        },
      });
      res.status(201).json({
        id: row.id,
        accessToken: row.access_token,
        shareUrl: buildGalleryShareUrl(row.access_token),
        createdAt: row.created_at,
      });
    } catch (error) {
      console.error("[photographer-galleries] create failed", error);
      res.status(500).json({ error: "create_failed" });
    }
  });

  // PATCH /api/photographer/galleries/:id/settings — merge gallery_settings.
  // Special: incoming `password` plaintext is bcrypt-hashed → passwordHash.
  app.patch("/api/photographer/galleries/:id/settings", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: "gallery_id_required" });
    const patch = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    try {
      const owned = await pool.query(
        `SELECT id, gallery_settings FROM photographer_client_galleries
         WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: "gallery_not_found" });
      const currentSettings = (owned.rows[0].gallery_settings ?? {}) as Record<string, unknown>;
      const next: Record<string, unknown> = { ...currentSettings };

      const ALLOWED = new Set([
        'maxSelections', 'pricePerImage', 'currency', 'contractedImages',
        'allowDownload', 'allowComments', 'watermarkEnabled', 'expiresAt',
        'requiresPassword', 'screenshotProtection',
        'logoUrl', 'primaryColor', 'accentColor', 'fontFamily', 'customDomainAlias',
        // Slice 9X.3 — let photographer link/unlink project. Empty string
        // or null clears the linkage.
        'projectId',
        // Slice 9X.5 — pricing-package linkage; auto-fills contractedImages
        // from package.inclusions.images when changed.
        'packageId',
        // Slice 9X.82 — Pic-Time story chapters. Array av { id, title, intro,
        // imageIds, romanNumeral }. Validert nedenfor.
        'chapters',
      ]);
      for (const [key, value] of Object.entries(patch)) {
        if (key === 'password') continue;
        if (!ALLOWED.has(key)) continue;
        // Slice 9X.82 — validér chapters-shape før vi godtar
        if (key === 'chapters') {
          if (!Array.isArray(value)) continue;
          const cleaned = (value as any[])
            .filter((c) => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.title === 'string')
            .map((c) => ({
              id: String(c.id).slice(0, 64),
              title: String(c.title).slice(0, 200),
              intro: typeof c.intro === 'string' ? c.intro.slice(0, 800) : null,
              romanNumeral: typeof c.romanNumeral === 'string' ? c.romanNumeral.slice(0, 8) : null,
              imageIds: Array.isArray(c.imageIds)
                ? c.imageIds.filter((id: any) => typeof id === 'string').slice(0, 500)
                : [],
              // Slice 9X.82 (Bjarne) — video-chapter-felter
              videoUrl: typeof c.videoUrl === 'string' && /^https?:\/\//.test(c.videoUrl)
                ? c.videoUrl.slice(0, 1024)
                : null,
              videoPoster: typeof c.videoPoster === 'string' && /^https?:\/\//.test(c.videoPoster)
                ? c.videoPoster.slice(0, 1024)
                : null,
              videoMarkers: Array.isArray(c.videoMarkers)
                ? c.videoMarkers
                    .filter((m: any) => m && typeof m === 'object' && Number.isFinite(Number(m.startSec)) && typeof m.title === 'string')
                    .map((m: any) => ({
                      startSec: Math.max(0, Number(m.startSec)),
                      title: String(m.title).slice(0, 200),
                      intro: typeof m.intro === 'string' ? m.intro.slice(0, 400) : null,
                      romanNumeral: typeof m.romanNumeral === 'string' ? m.romanNumeral.slice(0, 8) : null,
                    }))
                    .slice(0, 30)
                : [],
              // Slice 9X.82 (Michael) — audio-chapter-felter
              audioUrl: typeof c.audioUrl === 'string' && /^https?:\/\//.test(c.audioUrl)
                ? c.audioUrl.slice(0, 1024)
                : null,
              audioCover: typeof c.audioCover === 'string' && /^https?:\/\//.test(c.audioCover)
                ? c.audioCover.slice(0, 1024)
                : null,
              audioCredits: typeof c.audioCredits === 'string'
                ? c.audioCredits.slice(0, 400)
                : null,
              audioSections: Array.isArray(c.audioSections)
                ? c.audioSections
                    .filter((s: any) => s && typeof s === 'object' && Number.isFinite(Number(s.startSec)) && typeof s.title === 'string')
                    .map((s: any) => ({
                      startSec: Math.max(0, Number(s.startSec)),
                      title: String(s.title).slice(0, 200),
                      romanNumeral: typeof s.romanNumeral === 'string' ? s.romanNumeral.slice(0, 8) : null,
                    }))
                    .slice(0, 30)
                : [],
            }))
            .slice(0, 20);
          next.chapters = cleaned;
          continue;
        }
        next[key] = value;
      }

      // Slice 9X.5 — when packageId changes, look up the package's
      // images-included count and auto-fill contractedImages UNLESS the
      // caller explicitly sent contractedImages in the same patch (which
      // signals manual override). Skip auto-fill when packageId is being
      // cleared to null so the photographer doesn't lose their setting.
      const packageIdChanged =
        'packageId' in patch && patch.packageId !== currentSettings.packageId;
      const contractedImagesAlsoSent = 'contractedImages' in patch;
      if (packageIdChanged && !contractedImagesAlsoSent) {
        const newPkgId = patch.packageId;
        if (typeof newPkgId === 'string' && newPkgId.trim()) {
          const lookup = await lookupPackageImagesIncluded(newPkgId.trim(), session.userId);
          if (lookup.images != null) next.contractedImages = lookup.images;
        }
      }

      if ('password' in patch) {
        const raw = patch.password;
        if (raw === null || raw === '' || raw === undefined) {
          delete next.passwordHash;
          next.requiresPassword = false;
        } else if (typeof raw === 'string' && raw.length > 0) {
          if (raw.length < 4) return res.status(400).json({ error: "password_too_short", min: 4 });
          if (raw.length > 128) return res.status(400).json({ error: "password_too_long", max: 128 });
          const bcrypt = await import('bcrypt');
          next.passwordHash = await bcrypt.default.hash(raw, 10);
          next.requiresPassword = true;
        }
      }

      await pool.query(
        `UPDATE photographer_client_galleries
         SET gallery_settings = $1, updated_at = NOW()
         WHERE id = $2`,
        [next, galleryId],
      );
      const safe = { ...next };
      delete safe.passwordHash;
      res.json({
        id: galleryId,
        gallerySettings: safe,
        requiresPassword: next.requiresPassword === true && typeof next.passwordHash === 'string',
      });
    } catch (error) {
      console.error("[photographer-galleries] patch settings failed", error);
      res.status(500).json({ error: "patch_settings_failed" });
    }
  });

  // Ecosystem analytics — unified event-feed på tvers av alle systemer
  // i UniversalDashboard (gallery, project, payment, capture, photo
  // enhancer). BI-laget leser herfra istedenfor å forene siloer per
  // query.
  //
  // Filtre:
  //   ?since=ISO-timestamp  — kun events nyere enn dette (default: 30d)
  //   ?event_type=…         — filtrer på event-type
  //   ?entity_type=…        — filtrer på entitetstype (gallery/project/etc)
  //   ?entity_id=…          — kun events for denne entiteten
  //   ?limit=N              — max events (default 200, max 1000)
  //
  // actor_user_id auto-filtreres til session.userId så photographer
  // kun ser sin egen data.
  app.get("/api/analytics/events", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await ensureAnalyticsEventsSchema().catch(() => {
      /* on first call schema gets created; on failure return empty */
    });
    const params: unknown[] = [session.userId];
    let where = `actor_user_id = $1`;
    const sinceRaw = typeof req.query.since === 'string' ? req.query.since : null;
    if (sinceRaw) {
      params.push(sinceRaw);
      where += ` AND created_at >= $${params.length}`;
    } else {
      where += ` AND created_at >= NOW() - INTERVAL '30 days'`;
    }
    if (typeof req.query.event_type === 'string' && req.query.event_type.trim()) {
      params.push(req.query.event_type.trim());
      where += ` AND event_type = $${params.length}`;
    }
    if (typeof req.query.entity_type === 'string' && req.query.entity_type.trim()) {
      params.push(req.query.entity_type.trim());
      where += ` AND entity_type = $${params.length}`;
    }
    if (typeof req.query.entity_id === 'string' && req.query.entity_id.trim()) {
      params.push(req.query.entity_id.trim());
      where += ` AND entity_id = $${params.length}`;
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    try {
      const result = await pool.query(
        `SELECT id, event_type, entity_type, entity_id, actor_user_id,
                metadata, created_at
         FROM analytics_events
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT ${limit}`,
        params,
      );
      res.json({
        events: result.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          eventType: r.event_type,
          entityType: r.entity_type,
          entityId: r.entity_id,
          actorUserId: r.actor_user_id,
          metadata: r.metadata ?? {},
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      console.error('[analytics-events] list failed:', err);
      res.json({ events: [] });
    }
  });

  // Slice 9X.7 — mark a gallery as completed. Idempotent. When the
  // gallery is linked to a project (gallery_settings.projectId),
  // stamp the project's metadata.galleryDeliveredAt so dashboards
  // that aggregate project-level milestones can surface "client got
  // the gallery" without scanning every gallery row. Doesn't touch
  // project.status — that's the photographer's call (a delivered
  // gallery isn't necessarily a closed project; revisions, prints,
  // invoicing may follow).
  app.post("/api/photographer/galleries/:id/mark-complete", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: "gallery_id_required" });
    try {
      const owned = await pool.query(
        `SELECT id, gallery_settings, status, completed_at
         FROM photographer_client_galleries
         WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: "gallery_not_found" });
      const row = owned.rows[0];
      const settings = (row.gallery_settings ?? {}) as Record<string, unknown>;
      const linkedProjectId = typeof settings.projectId === 'string' ? settings.projectId : null;

      // Idempotent transition: if already completed, return current
      // state so the UI can refresh without thinking it failed.
      let alreadyCompleted = row.status === 'completed';
      if (!alreadyCompleted) {
        await pool.query(
          `UPDATE photographer_client_galleries
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [galleryId],
        );
      }

      // Project callback: additive metadata stamp. Try/catch wrapped so
      // a missing/dropped projects table doesn't fail the gallery
      // transition itself.
      let projectCallbackOk = false;
      if (linkedProjectId) {
        try {
          const updateResult = await pool.query(
            `UPDATE projects
             SET metadata = jsonb_set(
                   COALESCE(metadata, '{}'::jsonb),
                   '{galleryDeliveredAt}',
                   to_jsonb(NOW()::text),
                   true
                 ),
                 metadata = jsonb_set(
                   COALESCE(metadata, '{}'::jsonb),
                   '{galleryId}',
                   to_jsonb($2::text),
                   true
                 )
             WHERE id = $1`,
            [linkedProjectId, galleryId],
          );
          projectCallbackOk = (updateResult.rowCount ?? 0) > 0;
        } catch (projectErr) {
          console.warn('[gallery-complete] project callback failed (non-fatal)', projectErr);
        }
      }

      // Analytics — registrer kun ved EKTE transition (ikke idempotent
      // re-call). Bind til linkedProjectId via metadata så cross-system
      // queries kan joine på begge.
      if (!alreadyCompleted) {
        recordAnalyticsEvent('gallery.completed', {
          entityType: 'gallery',
          entityId: galleryId,
          actorUserId: session.userId,
          metadata: {
            linkedProjectId,
            projectCallbackOk,
          },
        });
      }

      return res.json({
        id: galleryId,
        status: 'completed',
        alreadyCompleted,
        linkedProjectId,
        projectCallbackOk,
      });
    } catch (error) {
      console.error("[photographer-galleries] mark-complete failed", error);
      res.status(500).json({ error: "mark_complete_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Gallery detail + activity + notify-client (Slice 9X.10 — UniversalShowcase leveranse)
  // ─────────────────────────────────────────────────────────────────────────

  // GET /api/photographer/galleries/:id — full detail med bilder + aktivitets-counts.
  app.get("/api/photographer/galleries/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: 'gallery_id_required' });

    try {
      const galleryQ = await pool.query(
        `SELECT g.id, g.client_name, g.client_email, g.project_title,
                g.access_token, g.gallery_settings, g.status,
                g.created_at, g.updated_at, g.completed_at,
                g.project_id, g.contract_id,
                COALESCE(img.image_count, 0)::int        AS image_count,
                COALESCE(com.comment_count, 0)::int      AS comment_count,
                COALESCE(sel.selection_count, 0)::int    AS selection_count,
                COALESCE(sel.favorite_count, 0)::int     AS favorite_count
           FROM photographer_client_galleries g
           LEFT JOIN (
             SELECT gallery_id, COUNT(*) AS image_count
               FROM client_gallery_images
              WHERE is_visible = true
              GROUP BY gallery_id
           ) img ON img.gallery_id = g.id
           LEFT JOIN (
             SELECT gallery_id, COUNT(*) AS comment_count
               FROM client_image_comments
              GROUP BY gallery_id
           ) com ON com.gallery_id = g.id
           LEFT JOIN (
             SELECT gallery_id,
                    COUNT(*) AS selection_count,
                    COUNT(*) FILTER (WHERE selection_type = 'favorite') AS favorite_count
               FROM client_image_selections
              GROUP BY gallery_id
           ) sel ON sel.gallery_id = g.id
          WHERE g.id = $1 AND g.photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (galleryQ.rowCount === 0) return res.status(404).json({ error: 'gallery_not_found' });
      const g = galleryQ.rows[0];

      const imagesQ = await pool.query(
        `SELECT id, image_title, image_description, thumbnail_url, full_size_url,
                tags, sort_order, created_at
           FROM client_gallery_images
          WHERE gallery_id = $1 AND is_visible = true
          ORDER BY sort_order ASC, created_at ASC
          LIMIT 500`,
        [galleryId],
      );

      res.json({
        gallery: {
          id: g.id,
          clientName: g.client_name,
          clientEmail: g.client_email,
          projectTitle: g.project_title,
          accessToken: g.access_token,
          shareUrl: buildGalleryShareUrl(g.access_token),
          settings: g.gallery_settings ?? {},
          status: g.status,
          projectId: g.project_id ?? null,
          contractId: g.contract_id ?? null,
          imageCount: Number(g.image_count ?? 0),
          commentCount: Number(g.comment_count ?? 0),
          selectionCount: Number(g.selection_count ?? 0),
          favoriteCount: Number(g.favorite_count ?? 0),
          createdAt: g.created_at,
          updatedAt: g.updated_at,
          completedAt: g.completed_at,
        },
        images: imagesQ.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          title: r.image_title,
          description: r.image_description ?? null,
          thumbnailUrl: r.thumbnail_url,
          fullSizeUrl: r.full_size_url,
          tags: r.tags ?? [],
          sortOrder: Number(r.sort_order ?? 0),
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      console.error('[photographer-galleries] detail failed:', err);
      res.status(500).json({ error: 'detail_failed' });
    }
  });

  // GET /api/photographer/galleries/:id/activity — aggregert klient-aktivitet
  // (kommentarer + favoritter + selections) for å vise en feed på fotograf-siden.
  app.get("/api/photographer/galleries/:id/activity", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: 'gallery_id_required' });

    try {
      const owned = await pool.query(
        `SELECT 1 FROM photographer_client_galleries
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'gallery_not_found' });

      const [commentsQ, selectionsQ] = await Promise.all([
        pool.query(
          `SELECT c.id, c.image_id, c.client_name, c.client_email,
                  c.comment, c.comment_type, c.status,
                  c.photographer_response, c.responded_at, c.created_at,
                  img.image_title, img.thumbnail_url
             FROM client_image_comments c
             LEFT JOIN client_gallery_images img ON img.id = c.image_id
            WHERE c.gallery_id = $1
            ORDER BY c.created_at DESC
            LIMIT 200`,
          [galleryId],
        ),
        pool.query(
          `SELECT s.id, s.image_id, s.client_email, s.selection_type,
                  s.priority, s.client_notes, s.created_at,
                  img.image_title, img.thumbnail_url
             FROM client_image_selections s
             LEFT JOIN client_gallery_images img ON img.id = s.image_id
            WHERE s.gallery_id = $1
            ORDER BY s.created_at DESC
            LIMIT 500`,
          [galleryId],
        ),
      ]);

      res.json({
        comments: commentsQ.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          imageId: r.image_id,
          imageTitle: r.image_title ?? null,
          imageThumbnail: r.thumbnail_url ?? null,
          clientName: r.client_name,
          clientEmail: r.client_email,
          comment: r.comment,
          commentType: r.comment_type,
          status: r.status,
          photographerResponse: r.photographer_response,
          respondedAt: r.responded_at,
          createdAt: r.created_at,
        })),
        selections: selectionsQ.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          imageId: r.image_id,
          imageTitle: r.image_title ?? null,
          imageThumbnail: r.thumbnail_url ?? null,
          clientEmail: r.client_email,
          selectionType: r.selection_type,
          priority: Number(r.priority ?? 0),
          clientNotes: r.client_notes,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      console.error('[photographer-galleries] activity failed:', err);
      res.status(500).json({ error: 'activity_failed' });
    }
  });

  // POST /api/photographer/galleries/:id/notify-client — send share-URL på epost.
  // Body: { customMessage?: string }
  app.post("/api/photographer/galleries/:id/notify-client", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: 'gallery_id_required' });
    const customMessage = typeof req.body?.customMessage === 'string'
      ? req.body.customMessage.trim().slice(0, 2000) : null;

    try {
      const galleryQ = await pool.query(
        `SELECT g.client_name, g.client_email, g.project_title, g.access_token,
                u.first_name AS photographer_first, u.last_name AS photographer_last,
                u.email AS photographer_email, u.company_name
           FROM photographer_client_galleries g
           LEFT JOIN users u ON u.id = g.photographer_id::varchar
          WHERE g.id = $1 AND g.photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (galleryQ.rowCount === 0) return res.status(404).json({ error: 'gallery_not_found' });
      const g = galleryQ.rows[0];
      if (!g.client_email || !String(g.client_email).includes('@')) {
        return res.status(400).json({ error: 'invalid_client_email' });
      }

      const shareUrl = buildGalleryShareUrl(g.access_token);
      const photographerName = [g.photographer_first, g.photographer_last]
        .filter(Boolean).join(' ') || g.company_name || 'Creatorhubn';

      // Reuse existing nodemailer-mønster (GMAIL_USER + GMAIL_APP_PASSWORD)
      const mailUser = (process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || '').trim();
      const mailPass = (process.env.GMAIL_APP_PASSWORD || '').trim().replace(/\s+/g, '');
      if (!mailUser || !mailPass) {
        return res.status(503).json({
          error: 'mailer_not_configured',
          message: 'Sett GMAIL_USER + GMAIL_APP_PASSWORD i Render for å sende epost.',
          shareUrl,
        });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: mailUser, pass: mailPass },
      });

      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;margin:0 0 16px;">Hei ${escapeHtml(g.client_name)},</h2>
          <p style="font-size:15px;line-height:1.6;color:#333;">
            ${customMessage
              ? escapeHtml(customMessage)
              : `Bildene fra <strong>${escapeHtml(g.project_title)}</strong> er klare. Klikk knappen under for å se galleriet ditt.`
            }
          </p>
          <div style="margin:32px 0;text-align:center;">
            <a href="${shareUrl}" style="display:inline-block;background:#ff8c00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Åpne galleriet</a>
          </div>
          <p style="font-size:13px;color:#666;line-height:1.5;">
            Eller kopier denne lenken: <br>
            <a href="${shareUrl}" style="color:#1976d2;word-break:break-all;">${shareUrl}</a>
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;">
          <p style="font-size:13px;color:#999;">
            Hilsen ${escapeHtml(photographerName)}
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: `"${photographerName}" <${mailUser}>`,
        to: g.client_email,
        replyTo: g.photographer_email || undefined,
        subject: `Galleriet ditt fra "${g.project_title}" er klart`,
        html,
      });

      // Logg som event
      recordAnalyticsEvent('gallery.notified', {
        entityType: 'gallery',
        entityId: galleryId,
        actorUserId: session.userId,
        metadata: { recipient: g.client_email },
      });

      res.json({ sent: true, recipient: g.client_email, shareUrl });
    } catch (err) {
      console.error('[photographer-galleries] notify-client failed:', err);
      res.status(500).json({ error: 'notify_failed' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Kontrakt-gate + download-audit (Slice 9X.11)
  // ─────────────────────────────────────────────────────────────────────────

  // POST /api/photographer/galleries/:id/link-contract — knytt kontrakt
  // til galleri. Når satt, gates ALL download på contract.signature_status.
  // Body: { contractId: string | null } — null = unlink.
  app.post("/api/photographer/galleries/:id/link-contract", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: 'gallery_id_required' });
    const contractId = req.body?.contractId === null ? null
      : (typeof req.body?.contractId === 'string' ? req.body.contractId.trim() : undefined);
    if (contractId === undefined) return res.status(400).json({ error: 'contract_id_required_or_null' });

    try {
      // Schema-ensure for migrasjon 0093
      try {
        await pool.query(`ALTER TABLE photographer_client_galleries ADD COLUMN IF NOT EXISTS contract_id VARCHAR(64)`);
      } catch { /* idempotent */ }

      const owned = await pool.query(
        `SELECT 1 FROM photographer_client_galleries
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'gallery_not_found' });

      if (contractId) {
        // Verifiser at fotografen eier kontrakten
        const contractCheck = await pool.query(
          `SELECT 1 FROM contracts WHERE id = $1 AND user_id = $2 LIMIT 1`,
          [contractId, session.userId],
        );
        if (contractCheck.rowCount === 0) {
          return res.status(403).json({ error: 'contract_not_owned' });
        }
      }

      await pool.query(
        `UPDATE photographer_client_galleries
            SET contract_id = $1, updated_at = NOW()
          WHERE id = $2 AND photographer_id = $3`,
        [contractId, galleryId, session.userId],
      );
      res.json({ linked: !!contractId, contractId });
    } catch (err) {
      console.error('[gallery-contract] link failed:', err);
      res.status(500).json({ error: 'link_failed' });
    }
  });

  // GET /api/photographer/galleries/:id/download-audit — full audit-historikk
  // + summer mot contractedImages. Stine bruker dette i UI for å se
  // hva som er lastet ned, av hvem, når, og hvor mye som gjenstår.
  app.get("/api/photographer/galleries/:id/download-audit", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: 'gallery_id_required' });

    try {
      const owned = await pool.query(
        `SELECT id, gallery_settings, contract_id, client_email, status, completed_at
           FROM photographer_client_galleries
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'gallery_not_found' });
      const g = owned.rows[0];
      const settings = (g.gallery_settings ?? {}) as Record<string, unknown>;
      const contractedImages = Math.max(0, Number(settings.contractedImages) || 0);

      await ensureGalleryDownloadAuditSchema();
      const [auditQ, summaryQ] = await Promise.all([
        pool.query(
          `SELECT a.id, a.image_id, a.client_email, a.client_ip, a.download_method,
                  a.downloaded_at, a.user_agent,
                  img.image_title, img.thumbnail_url
             FROM gallery_download_audit a
             LEFT JOIN client_gallery_images img ON img.id = a.image_id
            WHERE a.gallery_id = $1
            ORDER BY a.downloaded_at DESC
            LIMIT 500`,
          [galleryId],
        ),
        pool.query(
          `SELECT
             client_email,
             COUNT(DISTINCT image_id)::int AS unique_images,
             COUNT(*)::int                  AS total_downloads,
             MIN(downloaded_at)             AS first_download,
             MAX(downloaded_at)             AS last_download
           FROM gallery_download_audit
          WHERE gallery_id = $1
          GROUP BY client_email
          ORDER BY MAX(downloaded_at) DESC`,
          [galleryId],
        ),
      ]);

      // Kontrakt-status hvis linket
      let contractStatus: {
        contractId: string;
        status: string | null;
        signatureStatus: string | null;
        signedAt: string | null;
        title: string | null;
      } | null = null;
      if (g.contract_id) {
        const cr = await pool.query(
          `SELECT id, status, signature_status, signed_at, contract_title, title
             FROM contracts WHERE id = $1 LIMIT 1`,
          [g.contract_id],
        ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
        const c = cr.rows[0];
        if (c) {
          contractStatus = {
            contractId: String(c.id),
            status: c.status ? String(c.status) : null,
            signatureStatus: c.signature_status ? String(c.signature_status) : null,
            signedAt: c.signed_at ? String(c.signed_at) : null,
            title: (c.contract_title ?? c.title) ? String(c.contract_title ?? c.title) : null,
          };
        }
      }

      res.json({
        gallery: {
          id: g.id,
          clientEmail: g.client_email,
          status: g.status,
          completedAt: g.completed_at,
          contractedImages,
          pricePerImage: Number(settings.pricePerImage ?? 0),
        },
        contract: contractStatus,
        perClient: summaryQ.rows.map((r: Record<string, unknown>) => {
          const unique = Number(r.unique_images ?? 0);
          return {
            clientEmail: r.client_email,
            uniqueImages: unique,
            totalDownloads: Number(r.total_downloads ?? 0),
            firstDownload: r.first_download,
            lastDownload: r.last_download,
            remainingSlots: contractedImages > 0 ? Math.max(0, contractedImages - unique) : null,
          };
        }),
        audit: auditQ.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          imageId: r.image_id,
          imageTitle: r.image_title ?? null,
          imageThumbnail: r.thumbnail_url ?? null,
          clientEmail: r.client_email,
          clientIp: r.client_ip ?? null,
          downloadMethod: r.download_method ?? 'zip',
          downloadedAt: r.downloaded_at,
          userAgent: r.user_agent ?? null,
        })),
      });
    } catch (err) {
      console.error('[gallery-audit] fetch failed:', err);
      res.status(500).json({ error: 'audit_failed' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Gallery access codes (Slice 9X.15 — korte koder + /portal-landingsside)
  // ─────────────────────────────────────────────────────────────────────────

  let galleryAccessCodesSchemaReady: Promise<void> | null = null;
  function ensureGalleryAccessCodesSchema(): Promise<void> {
    if (!galleryAccessCodesSchemaReady) {
      galleryAccessCodesSchemaReady = (async () => {
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS gallery_access_codes (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              gallery_id UUID NOT NULL,
              code VARCHAR(12) NOT NULL,
              label VARCHAR(100),
              expires_at TIMESTAMPTZ,
              max_uses INTEGER,
              use_count INTEGER NOT NULL DEFAULT 0,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              created_by VARCHAR(64) NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              last_used_at TIMESTAMPTZ,
              revoked_at TIMESTAMPTZ
            );
            CREATE UNIQUE INDEX IF NOT EXISTS gallery_access_codes_unique_active
              ON gallery_access_codes (code) WHERE is_active = TRUE;
            CREATE INDEX IF NOT EXISTS gallery_access_codes_gallery_idx
              ON gallery_access_codes (gallery_id, is_active);
          `);
        } catch (err) {
          console.warn('[access-codes] schema-ensure failed:', err);
          galleryAccessCodesSchemaReady = null;
          throw err;
        }
      })();
    }
    return galleryAccessCodesSchemaReady;
  }

  // Tegn-pool ekskluderer 0/O/I/1 så koden kan dikteres pålitelig på telefon.
  const ACCESS_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function generateAccessCode(length = 6): string {
    let out = '';
    const buf = crypto.randomBytes(length * 2);
    let i = 0;
    while (out.length < length && i < buf.length) {
      const idx = buf[i] % ACCESS_CODE_CHARS.length;
      out += ACCESS_CODE_CHARS[idx];
      i++;
    }
    return out;
  }

  // POST /api/photographer/galleries/:id/access-codes — generér ny kode.
  // Body: { label?: string, expiresInDays?: number, maxUses?: number }
  app.post("/api/photographer/galleries/:id/access-codes", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: 'gallery_id_required' });

    const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 100) : null;
    const expiresInDays = Number.isFinite(Number(req.body?.expiresInDays)) ? Number(req.body.expiresInDays) : null;
    const maxUses = Number.isFinite(Number(req.body?.maxUses)) ? Number(req.body.maxUses) : null;

    try {
      await ensureGalleryAccessCodesSchema();
      // Verifiser gallery-eierskap
      const owned = await pool.query(
        `SELECT 1 FROM photographer_client_galleries
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'gallery_not_found' });

      // Generér unique kode med opp til 5 forsøk
      let code = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateAccessCode(6);
        const exists = await pool.query(
          `SELECT 1 FROM gallery_access_codes WHERE code = $1 AND is_active = true LIMIT 1`,
          [candidate],
        );
        if (exists.rowCount === 0) {
          code = candidate;
          break;
        }
      }
      if (!code) return res.status(500).json({ error: 'code_generation_failed' });

      const expiresAt = expiresInDays && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
        : null;

      const result = await pool.query(
        `INSERT INTO gallery_access_codes
           (gallery_id, code, label, expires_at, max_uses, created_by)
         VALUES ($1, $2, $3, $4::timestamptz, $5, $6)
         RETURNING id, code, label, expires_at, max_uses, created_at`,
        [galleryId, code, label, expiresAt, maxUses, session.userId],
      );
      const row = result.rows[0];
      res.status(201).json({
        id: row.id,
        code: row.code,
        label: row.label,
        expiresAt: row.expires_at,
        maxUses: row.max_uses,
        createdAt: row.created_at,
        portalUrl: `${process.env.PUBLIC_APP_URL || 'https://creatorhubn.com'}/portal?code=${row.code}`,
      });
    } catch (err) {
      console.error('[access-codes] create failed:', err);
      res.status(500).json({ error: 'create_failed' });
    }
  });

  // GET /api/photographer/galleries/:id/access-codes — list koder for galleri.
  app.get("/api/photographer/galleries/:id/access-codes", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: 'gallery_id_required' });

    try {
      await ensureGalleryAccessCodesSchema();
      const owned = await pool.query(
        `SELECT 1 FROM photographer_client_galleries
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'gallery_not_found' });

      const r = await pool.query(
        `SELECT id, code, label, expires_at, max_uses, use_count,
                is_active, created_at, last_used_at, revoked_at
           FROM gallery_access_codes
          WHERE gallery_id = $1
          ORDER BY is_active DESC, created_at DESC`,
        [galleryId],
      );
      const portalBase = `${process.env.PUBLIC_APP_URL || 'https://creatorhubn.com'}/portal`;
      res.json({
        codes: r.rows.map((c: Record<string, unknown>) => ({
          id: c.id,
          code: c.code,
          label: c.label,
          expiresAt: c.expires_at,
          maxUses: c.max_uses,
          useCount: Number(c.use_count ?? 0),
          isActive: !!c.is_active,
          createdAt: c.created_at,
          lastUsedAt: c.last_used_at,
          revokedAt: c.revoked_at,
          portalUrl: `${portalBase}?code=${c.code}`,
        })),
      });
    } catch (err) {
      console.error('[access-codes] list failed:', err);
      res.status(500).json({ error: 'list_failed' });
    }
  });

  // DELETE /api/photographer/galleries/:id/access-codes/:codeId — revoker kode.
  app.delete("/api/photographer/galleries/:id/access-codes/:codeId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    const codeId = String(req.params.codeId || '').trim();
    if (!galleryId || !codeId) return res.status(400).json({ error: 'ids_required' });

    try {
      await ensureGalleryAccessCodesSchema();
      const owned = await pool.query(
        `SELECT 1 FROM photographer_client_galleries
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'gallery_not_found' });

      const r = await pool.query(
        `UPDATE gallery_access_codes
            SET is_active = FALSE, revoked_at = NOW()
          WHERE id = $1 AND gallery_id = $2 AND is_active = TRUE`,
        [codeId, galleryId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'code_not_found_or_already_revoked' });
      res.json({ revoked: true });
    } catch (err) {
      console.error('[access-codes] revoke failed:', err);
      res.status(500).json({ error: 'revoke_failed' });
    }
  });

  // GET /api/portal/lookup?code=XXXXXX — public-endepunkt for /portal-siden.
  // Validerer kode + returnerer access_token slik at frontend kan redirecte
  // til /client-gallery/:token. Ingen auth nødvendig.
  app.get("/api/portal/lookup", async (req, res) => {
    const code = String(req.query?.code || '').trim().toUpperCase();
    if (!code || code.length < 4 || code.length > 12) {
      return res.status(400).json({ error: 'invalid_code_format' });
    }

    try {
      await ensureGalleryAccessCodesSchema();
      const r = await pool.query(
        `SELECT ac.id, ac.gallery_id, ac.expires_at, ac.max_uses, ac.use_count,
                g.access_token, g.status AS gallery_status, g.project_title
           FROM gallery_access_codes ac
           JOIN photographer_client_galleries g ON g.id = ac.gallery_id
          WHERE ac.code = $1 AND ac.is_active = true
          LIMIT 1`,
        [code],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'code_not_found' });
      const row = r.rows[0];

      // Sjekk utløp
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(410).json({ error: 'code_expired' });
      }
      // Sjekk max-uses
      if (row.max_uses !== null && Number(row.use_count) >= Number(row.max_uses)) {
        return res.status(429).json({ error: 'code_max_uses_reached' });
      }
      // Sjekk galleri-status
      if (row.gallery_status === 'revoked' || row.gallery_status === 'deleted') {
        return res.status(410).json({ error: 'gallery_unavailable' });
      }

      // Inkrement use_count (best-effort, idempotent ved hopp)
      await pool.query(
        `UPDATE gallery_access_codes
            SET use_count = use_count + 1, last_used_at = NOW()
          WHERE id = $1`,
        [row.id],
      ).catch(() => undefined);

      res.json({
        accessToken: row.access_token,
        galleryUrl: `/client-gallery/${row.access_token}`,
        projectTitle: row.project_title,
      });
    } catch (err) {
      console.error('[portal-lookup] failed:', err);
      res.status(500).json({ error: 'lookup_failed' });
    }
  });

  // GET /api/photographer/contracts — list fotografens kontrakter for
  // link-til-galleri-UI. Returnerer kun id, tittel, status, klient.
  app.get("/api/photographer/contracts", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT id,
                COALESCE(contract_title, title) AS title,
                client_name, client_email,
                status, signature_status, signed_at, created_at
           FROM contracts
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 200`,
        [session.userId],
      ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
      res.json({
        contracts: r.rows.map((c: Record<string, unknown>) => ({
          id: c.id,
          title: c.title ?? 'Uten tittel',
          clientName: c.client_name ?? null,
          clientEmail: c.client_email ?? null,
          status: c.status ?? null,
          signatureStatus: c.signature_status ?? null,
          signedAt: c.signed_at ?? null,
          createdAt: c.created_at,
        })),
      });
    } catch (err) {
      console.error('[photographer-contracts] list failed:', err);
      res.status(500).json({ error: 'list_failed' });
    }
  });

  // Slice 9X.1 — cross-gallery events feed for the unified inbox in
  // CommunicationHub. Same UNION shape as the per-gallery /events
  // endpoint, just scoped to ALL galleries the photographer owns and
  // joined with gallery info so the inbox can show "client X commented
  // on gallery Y" without N+1 lookups. Capped at 200 — older history
  // goes via the per-gallery dialog.
  app.get("/api/photographer/galleries/events", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const sinceRaw = typeof req.query?.since === 'string' ? req.query.since : null;
    const sinceDate = sinceRaw ? new Date(sinceRaw) : null;
    let sinceClause = '';
    const params: unknown[] = [session.userId];
    if (sinceDate && Number.isFinite(sinceDate.getTime())) {
      params.push(sinceDate.toISOString());
      sinceClause = `AND e.event_at > $2::timestamptz`;
    }
    try {
      const result = await pool.query(
        `WITH owned AS (
           SELECT id, client_name, project_title, access_token
           FROM photographer_client_galleries
           WHERE photographer_id = $1
         ),
         events AS (
           (SELECT 'comment' AS event_type, c.id::text, c.gallery_id, c.image_id::text,
                    c.client_name, c.client_email, c.comment AS detail,
                    NULL::numeric AS amount, NULL::varchar AS currency,
                    NULL::varchar AS payment_status, c.created_at AS event_at
             FROM client_image_comments c WHERE c.gallery_id IN (SELECT id FROM owned))
           UNION ALL
           (SELECT 'selection' AS event_type, s.id::text, s.gallery_id, s.image_id::text,
                    NULL AS client_name, s.client_email, s.selection_type AS detail,
                    NULL::numeric AS amount, NULL::varchar AS currency,
                    NULL::varchar AS payment_status, s.updated_at AS event_at
             FROM client_image_selections s WHERE s.gallery_id IN (SELECT id FROM owned))
           UNION ALL
           (SELECT 'payment' AS event_type, p.id::text, p.gallery_id, NULL AS image_id,
                    NULL AS client_name, p.client_email,
                    CONCAT('extra-images: ', p.additional_images) AS detail,
                    p.total_amount AS amount, p.currency, p.payment_status,
                    p.updated_at AS event_at
             FROM client_image_payments p WHERE p.gallery_id IN (SELECT id FROM owned))
         )
         SELECT e.event_type, e.id, e.gallery_id, e.image_id, e.client_name, e.client_email,
                e.detail, e.amount, e.currency, e.payment_status, e.event_at,
                o.client_name AS gallery_client_name, o.project_title, o.access_token
         FROM events e
         JOIN owned o ON o.id = e.gallery_id
         WHERE 1=1 ${sinceClause}
         ORDER BY e.event_at DESC NULLS LAST
         LIMIT 200`,
        params,
      );
      res.json({
        events: result.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          type: r.event_type,
          galleryId: r.gallery_id,
          galleryClientName: r.gallery_client_name,
          galleryProjectTitle: r.project_title,
          galleryShareUrl: r.access_token ? buildGalleryShareUrl(String(r.access_token)) : null,
          imageId: r.image_id,
          clientName: r.client_name,
          clientEmail: r.client_email,
          detail: r.detail,
          amount: r.amount != null ? Number(r.amount) : null,
          currency: r.currency,
          paymentStatus: r.payment_status,
          timestamp: r.event_at,
        })),
      });
    } catch (error) {
      console.error("[photographer-galleries] cross-gallery events failed", error);
      res.status(500).json({ error: "events_failed" });
    }
  });

  // Slice 9X.84 — Admin-side liste av video-timecode-kommentarer for ett
  // galleri. Brukes av EditFeedbackSummary i admin-portalen så Bjarne kan
  // se aggregert oversikt uten å åpne klient-galleriet.
  app.get("/api/photographer/galleries/:id/video-comments", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: "gallery_id_required" });
    try {
      const owned = await pool.query(
        `SELECT id FROM photographer_client_galleries
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: "gallery_not_found" });
      await ensureVideoTimecodeCommentsSchema();
      const rows = await pool.query(
        `SELECT id, chapter_id, timecode_sec, end_timecode_sec,
                category, priority, comment, client_email, client_name,
                status, resolved_at, created_at,
                suggested_media_url, suggested_media_label,
                suggested_media_from_sec, suggested_media_to_sec,
                parent_id, author_kind
           FROM video_timecode_comments
          WHERE gallery_id = $1
          ORDER BY created_at DESC
          LIMIT 1000`,
        [galleryId],
      );
      res.json({
        comments: rows.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          chapterId: r.chapter_id,
          timecodeSec: Number(r.timecode_sec),
          endTimecodeSec: r.end_timecode_sec != null ? Number(r.end_timecode_sec) : null,
          category: r.category,
          priority: r.priority,
          comment: r.comment,
          clientEmail: r.client_email,
          clientName: r.client_name,
          status: r.status,
          resolvedAt: r.resolved_at,
          createdAt: r.created_at,
          suggestedMediaUrl: r.suggested_media_url,
          suggestedMediaLabel: r.suggested_media_label,
          suggestedMediaFromSec: r.suggested_media_from_sec != null ? Number(r.suggested_media_from_sec) : null,
          suggestedMediaToSec: r.suggested_media_to_sec != null ? Number(r.suggested_media_to_sec) : null,
          parentId: r.parent_id,
          authorKind: r.author_kind || 'client',
        })),
      });
    } catch (error) {
      console.error("[photographer-galleries] video-comments list failed", error);
      res.status(500).json({ error: "list_failed" });
    }
  });

  // Slice 9X.84 — Toggle resolved/open per kommentar. Bjarne markerer ting
  // som ferdig direkte fra EditFeedbackSummary.
  app.patch("/api/photographer/galleries/:id/video-comments/:commentId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    const commentId = String(req.params.commentId || '').trim();
    if (!galleryId || !commentId) return res.status(400).json({ error: "missing_ids" });
    const statusRaw = typeof req.body?.status === 'string' ? req.body.status.toLowerCase() : '';
    if (!['open', 'resolved', 'archived'].includes(statusRaw)) {
      return res.status(400).json({ error: "invalid_status" });
    }
    try {
      const owned = await pool.query(
        `SELECT id FROM photographer_client_galleries
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: "gallery_not_found" });
      const updated = await pool.query(
        `UPDATE video_timecode_comments
            SET status = $1,
                resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END
          WHERE id = $2 AND gallery_id = $3
          RETURNING id, status, resolved_at`,
        [statusRaw, commentId, galleryId],
      );
      if (updated.rowCount === 0) return res.status(404).json({ error: "comment_not_found" });
      res.json({
        id: updated.rows[0].id,
        status: updated.rows[0].status,
        resolvedAt: updated.rows[0].resolved_at,
      });
    } catch (error) {
      console.error("[photographer-galleries] video-comment patch failed", error);
      res.status(500).json({ error: "patch_failed" });
    }
  });

  // Slice 9X.86 — Produsent svarer på en kommentar i samme tråd.
  // author_kind = 'photographer' så klient-UI kan style svaret som
  // "fra Bjarne" (vs. egen klient-kommentar).
  app.post("/api/photographer/galleries/:id/video-comments/:commentId/reply", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    const parentId = String(req.params.commentId || '').trim();
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 2000) : '';
    if (!galleryId || !parentId) return res.status(400).json({ error: "missing_ids" });
    if (!comment) return res.status(400).json({ error: "comment_required" });
    try {
      const owned = await pool.query(
        `SELECT id FROM photographer_client_galleries
          WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: "gallery_not_found" });
      const parent = await pool.query(
        `SELECT chapter_id, timecode_sec FROM video_timecode_comments
          WHERE id = $1 AND gallery_id = $2 LIMIT 1`,
        [parentId, galleryId],
      );
      if (parent.rowCount === 0) return res.status(404).json({ error: "parent_not_found" });
      const { chapter_id, timecode_sec } = parent.rows[0];
      const inserted = await pool.query(
        `INSERT INTO video_timecode_comments
           (gallery_id, chapter_id, timecode_sec, comment,
            client_email, client_name, category, priority,
            parent_id, author_kind)
         VALUES ($1, $2, $3, $4, $5, $6, 'other', 'suggestion', $7, 'photographer')
         RETURNING id, created_at`,
        [galleryId, chapter_id, timecode_sec, comment,
         session.email || 'photographer@creatorhub.local',
         session.name || 'CreatorHub-teamet',
         parentId],
      );
      res.status(201).json({
        id: inserted.rows[0].id,
        createdAt: inserted.rows[0].created_at,
      });
    } catch (error) {
      console.error("[photographer-galleries] video-comment reply failed", error);
      res.status(500).json({ error: "reply_failed" });
    }
  });

  // GET /api/photographer/galleries/:id/events — activity timeline.
  app.get("/api/photographer/galleries/:id/events", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || '').trim();
    if (!galleryId) return res.status(400).json({ error: "gallery_id_required" });
    try {
      const owned = await pool.query(
        `SELECT id FROM photographer_client_galleries
         WHERE id = $1 AND photographer_id = $2 LIMIT 1`,
        [galleryId, session.userId],
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: "gallery_not_found" });

      const result = await pool.query(
        `(SELECT 'comment' AS event_type, id::text, image_id::text, client_name, client_email,
                  comment AS detail, NULL::numeric AS amount, NULL::varchar AS currency,
                  NULL::varchar AS payment_status, created_at AS event_at
           FROM client_image_comments WHERE gallery_id = $1)
         UNION ALL
         (SELECT 'selection' AS event_type, id::text, image_id::text, NULL AS client_name, client_email,
                  selection_type AS detail, NULL::numeric AS amount, NULL::varchar AS currency,
                  NULL::varchar AS payment_status, updated_at AS event_at
           FROM client_image_selections WHERE gallery_id = $1)
         UNION ALL
         (SELECT 'payment' AS event_type, id::text, NULL AS image_id, NULL AS client_name, client_email,
                  CONCAT('extra-images: ', additional_images) AS detail,
                  total_amount AS amount, currency, payment_status,
                  updated_at AS event_at
           FROM client_image_payments WHERE gallery_id = $1)
         ORDER BY event_at DESC NULLS LAST
         LIMIT 500`,
        [galleryId],
      );
      res.json({
        galleryId,
        events: result.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          type: r.event_type,
          imageId: r.image_id,
          clientName: r.client_name,
          clientEmail: r.client_email,
          detail: r.detail,
          amount: r.amount != null ? Number(r.amount) : null,
          currency: r.currency,
          paymentStatus: r.payment_status,
          timestamp: r.event_at,
        })),
      });
    } catch (error) {
      console.error("[photographer-galleries] events failed", error);
      res.status(500).json({ error: "events_failed" });
    }
  });
}
