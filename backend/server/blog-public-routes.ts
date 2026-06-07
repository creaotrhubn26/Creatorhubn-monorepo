/**
 * blog-public-routes.ts
 *
 * Offentlig blog-API for /blog og /blog/:slug-sider.
 * Leser fra cms_pages med variant='blog' og slug-prefiks 'blog/'.
 *
 * Endepunkter:
 *   GET  /api/public/blog                — list publiserte artikler
 *   GET  /api/public/blog/:slug          — hent enkel artikkel
 *
 * Brukes av:
 *   - /blog index-side
 *   - /blog/:slug detail-side (med markdown-rendering)
 *
 * Admin Room kan publisere/redigere via eksisterende VisualCMS-admin.
 */

import type express from "express";
import type { Pool } from "pg";

export interface BlogPublicRoutesDeps {
  app: express.Application;
  pool: Pool;
}

export function setupBlogPublicRoutes(deps: BlogPublicRoutesDeps): void {
  const { app, pool } = deps;

  // ── GET /api/public/blog ────────────────────────────────────────
  // Returnerer alle publiserte blog-artikler sortert nyeste først.
  // Brukes til /blog index-side.
  app.get("/api/public/blog", async (req, res) => {
    const tag = typeof req.query.tag === "string" ? req.query.tag : null;
    const pillar = typeof req.query.pillar === "string" ? req.query.pillar : null;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);

    try {
      let where = `variant = 'blog' AND published = TRUE`;
      const params: unknown[] = [];
      if (pillar) {
        params.push(pillar);
        where += ` AND content->>'pillar' = $${params.length}`;
      }
      if (tag) {
        params.push(tag);
        where += ` AND content->'tags' ? $${params.length}`;
      }
      params.push(limit);

      const r = await pool.query(
        `SELECT slug,
                content->>'title' AS title,
                content->>'subtitle' AS subtitle,
                content->>'excerpt' AS excerpt,
                content->>'pillar' AS pillar,
                content->>'author' AS author,
                content->>'cover_image' AS cover_image,
                content->>'published_at' AS published_at,
                COALESCE(content->>'reading_minutes', '5')::int AS reading_minutes,
                content->'tags' AS tags,
                updated_at
           FROM cms_pages
          WHERE ${where}
          ORDER BY content->>'published_at' DESC NULLS LAST, updated_at DESC
          LIMIT $${params.length}`,
        params,
      );
      return res.json({
        articles: r.rows.map((row) => ({
          ...row,
          // slug presenteres uten 'blog/'-prefiks i URL — frontend mapper
          public_slug: String(row.slug).replace(/^blog\//, ""),
        })),
      });
    } catch (err) {
      console.error("[blog] list failed", err);
      return res.status(500).json({ error: "Kunne ikke hente artikler" });
    }
  });

  // ── GET /api/public/blog/:slug ──────────────────────────────────
  // Henter én publisert artikkel.
  app.get("/api/public/blog/:slug", async (req, res) => {
    const requestedSlug = req.params.slug;
    // Match både 'foo' og 'blog/foo' for robusthet
    const candidates = [`blog/${requestedSlug}`, requestedSlug];

    try {
      const r = await pool.query(
        `SELECT slug, content, updated_at
           FROM cms_pages
          WHERE variant = 'blog'
            AND published = TRUE
            AND slug = ANY($1::text[])
          LIMIT 1`,
        [candidates],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Artikkel ikke funnet" });

      const row = r.rows[0];
      const c = row.content as Record<string, unknown>;

      // Hent relaterte artikler (samme pillar, andre slugs)
      const related = await pool.query(
        `SELECT slug,
                content->>'title' AS title,
                content->>'excerpt' AS excerpt,
                content->>'published_at' AS published_at
           FROM cms_pages
          WHERE variant = 'blog'
            AND published = TRUE
            AND slug != $1
            AND content->>'pillar' = $2
          ORDER BY content->>'published_at' DESC NULLS LAST
          LIMIT 3`,
        [row.slug, c.pillar],
      );

      return res.json({
        article: {
          slug: row.slug,
          public_slug: String(row.slug).replace(/^blog\//, ""),
          title: c.title,
          subtitle: c.subtitle,
          excerpt: c.excerpt,
          pillar: c.pillar,
          author: c.author,
          author_role: c.author_role,
          published_at: c.published_at,
          updated_at: row.updated_at,
          reading_minutes: c.reading_minutes ?? 5,
          cover_image: c.cover_image,
          tags: c.tags ?? [],
          body_markdown: c.body_markdown ?? "",
        },
        related: related.rows.map((rr) => ({
          ...rr,
          public_slug: String(rr.slug).replace(/^blog\//, ""),
        })),
      });
    } catch (err) {
      console.error("[blog] get failed", err);
      return res.status(500).json({ error: "Kunne ikke hente artikkel" });
    }
  });
}
