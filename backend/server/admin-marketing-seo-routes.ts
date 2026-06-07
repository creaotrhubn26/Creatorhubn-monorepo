// Admin Marketing SEO routes.
//
// Backes UI-fanen Admin → Marketing → SEO Dashboard
// (frontend/client/src/components/marketing/MarketingSEODashboard.tsx).
//
// Data lever i seo_keywords / seo_pages / seo_backlinks (migrasjon
// 250_seo_data.sql).
//
// Defensiv: hvis migrasjon 250 ikke er kjørt enda returneres tomme
// kollektioner + console.warn — ikke 500 — slik at UI ikke krasjer.
//
// Konkurrent-/JSON-LD-/research-endepunkter er stubs som returnerer
// tomme kollektioner / placeholder-ID-er. Skal kobles til DataForSEO
// + en JSON-LD-generingstjeneste i senere PR.

import express from "express";
import type { Pool } from "pg";

export interface AdminMarketingSeoRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// ─── Helpers ────────────────────────────────────────────────────────

function safeLimit(input: unknown, def: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

function safeDays(input: unknown, def: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass($1) AS reg`,
      [`public.${name}`],
    );
    return r.rows[0]?.reg !== null && r.rows[0]?.reg !== undefined;
  } catch {
    return false;
  }
}

// ─── Row → DTO mappers ──────────────────────────────────────────────

interface SeoKeywordRow {
  id: string;
  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  intent: string | null;
  current_position: number | null;
  target_url: string | null;
  tracked_at: Date;
}

function rowToKeyword(r: SeoKeywordRow) {
  return {
    id: r.id,
    keyword: r.keyword,
    searchVolume: r.search_volume,
    difficulty: r.difficulty,
    intent: r.intent,
    currentPosition: r.current_position,
    targetUrl: r.target_url,
    trackedAt: r.tracked_at,
  };
}

interface SeoPageRow {
  id: string;
  url: string;
  title: string | null;
  meta_description: string | null;
  word_count: number | null;
  has_schema: boolean | null;
  last_crawled_at: Date | null;
  pagespeed_score: number | null;
  created_at: Date;
}

function rowToPage(r: SeoPageRow) {
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    metaDescription: r.meta_description,
    wordCount: r.word_count,
    hasSchema: r.has_schema ?? false,
    lastCrawledAt: r.last_crawled_at,
    pagespeedScore: r.pagespeed_score,
    createdAt: r.created_at,
  };
}

interface SeoBacklinkRow {
  id: string;
  source_url: string;
  target_url: string;
  anchor_text: string | null;
  domain_authority: number | null;
  is_followed: boolean | null;
  discovered_at: Date;
}

function rowToBacklink(r: SeoBacklinkRow) {
  return {
    id: r.id,
    sourceUrl: r.source_url,
    targetUrl: r.target_url,
    anchorText: r.anchor_text,
    domainAuthority: r.domain_authority,
    isFollowed: r.is_followed ?? true,
    discoveredAt: r.discovered_at,
  };
}

// ─── Setup ──────────────────────────────────────────────────────────

export function setupAdminMarketingSeoRoutes(
  deps: AdminMarketingSeoRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── Keywords ─────────────────────────────────────────────────
  // GET /api/seo/keywords?limit=50
  app.get("/api/seo/keywords", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "seo_keywords"))) {
        console.warn(
          "[admin-marketing-seo] seo_keywords table missing — returning empty list. " +
            "Run migration 250_seo_data.sql.",
        );
        return res.json({ keywords: [], total: 0 });
      }

      const limit = safeLimit(req.query.limit, 50, 500);
      const result = await pool.query<SeoKeywordRow>(
        `SELECT id, keyword, search_volume, difficulty, intent,
                current_position, target_url, tracked_at
           FROM seo_keywords
           ORDER BY tracked_at DESC
           LIMIT $1`,
        [limit],
      );

      res.json({
        keywords: result.rows.map(rowToKeyword),
        total: result.rows.length,
      });
    } catch (err) {
      console.error("[admin-marketing-seo] keywords list failed:", err);
      res.status(500).json({ error: "seo_keywords_list_failed" });
    }
  });

  // GET /api/seo/keywords/recent?days=30
  app.get("/api/seo/keywords/recent", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "seo_keywords"))) {
        console.warn(
          "[admin-marketing-seo] seo_keywords table missing — returning empty list.",
        );
        return res.json({ keywords: [], total: 0 });
      }

      const days = safeDays(req.query.days, 30, 365);
      const result = await pool.query<SeoKeywordRow>(
        `SELECT id, keyword, search_volume, difficulty, intent,
                current_position, target_url, tracked_at
           FROM seo_keywords
           WHERE tracked_at >= now() - ($1 || ' days')::interval
           ORDER BY tracked_at DESC
           LIMIT 200`,
        [String(days)],
      );

      res.json({
        keywords: result.rows.map(rowToKeyword),
        total: result.rows.length,
      });
    } catch (err) {
      console.error("[admin-marketing-seo] recent keywords failed:", err);
      res.status(500).json({ error: "seo_keywords_recent_failed" });
    }
  });

  // ─── Pages ────────────────────────────────────────────────────
  // GET /api/seo/pages?limit=50
  app.get("/api/seo/pages", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "seo_pages"))) {
        console.warn(
          "[admin-marketing-seo] seo_pages table missing — returning empty list.",
        );
        return res.json({ pages: [], total: 0 });
      }

      const limit = safeLimit(req.query.limit, 50, 500);
      const result = await pool.query<SeoPageRow>(
        `SELECT id, url, title, meta_description, word_count,
                has_schema, last_crawled_at, pagespeed_score, created_at
           FROM seo_pages
           ORDER BY created_at DESC
           LIMIT $1`,
        [limit],
      );

      res.json({
        pages: result.rows.map(rowToPage),
        total: result.rows.length,
      });
    } catch (err) {
      console.error("[admin-marketing-seo] pages list failed:", err);
      res.status(500).json({ error: "seo_pages_list_failed" });
    }
  });

  // ─── Backlinks ────────────────────────────────────────────────
  // GET /api/seo/backlinks?limit=50
  app.get("/api/seo/backlinks", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "seo_backlinks"))) {
        console.warn(
          "[admin-marketing-seo] seo_backlinks table missing — returning empty list.",
        );
        return res.json({ backlinks: [], total: 0 });
      }

      const limit = safeLimit(req.query.limit, 50, 500);
      const result = await pool.query<SeoBacklinkRow>(
        `SELECT id, source_url, target_url, anchor_text,
                domain_authority, is_followed, discovered_at
           FROM seo_backlinks
           ORDER BY discovered_at DESC
           LIMIT $1`,
        [limit],
      );

      res.json({
        backlinks: result.rows.map(rowToBacklink),
        total: result.rows.length,
      });
    } catch (err) {
      console.error("[admin-marketing-seo] backlinks list failed:", err);
      res.status(500).json({ error: "seo_backlinks_list_failed" });
    }
  });

  // ─── Aggregate stats ──────────────────────────────────────────
  // GET /api/seo/research/stats
  app.get("/api/seo/research/stats", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const keywordsExists = await tableExists(pool, "seo_keywords");
      const backlinksExists = await tableExists(pool, "seo_backlinks");

      if (!keywordsExists && !backlinksExists) {
        console.warn(
          "[admin-marketing-seo] seo_* tabeller mangler — returnerer nuller. " +
            "Run migration 250_seo_data.sql.",
        );
        return res.json({
          totalKeywords: 0,
          avgPosition: 0,
          top10Count: 0,
          totalBacklinks: 0,
          avgDomainAuthority: 0,
        });
      }

      let totalKeywords = 0;
      let avgPosition = 0;
      let top10Count = 0;
      if (keywordsExists) {
        const kw = await pool.query<{
          total: string | null;
          avg_pos: string | null;
          top10: string | null;
        }>(
          `SELECT COUNT(*)::text AS total,
                  COALESCE(AVG(current_position) FILTER (WHERE current_position IS NOT NULL), 0)::text AS avg_pos,
                  COUNT(*) FILTER (WHERE current_position IS NOT NULL AND current_position <= 10)::text AS top10
             FROM seo_keywords`,
        );
        totalKeywords = Number(kw.rows[0]?.total ?? 0);
        avgPosition =
          Math.round(Number(kw.rows[0]?.avg_pos ?? 0) * 100) / 100;
        top10Count = Number(kw.rows[0]?.top10 ?? 0);
      }

      let totalBacklinks = 0;
      let avgDomainAuthority = 0;
      if (backlinksExists) {
        const bl = await pool.query<{
          total: string | null;
          avg_da: string | null;
        }>(
          `SELECT COUNT(*)::text AS total,
                  COALESCE(AVG(domain_authority) FILTER (WHERE domain_authority IS NOT NULL), 0)::text AS avg_da
             FROM seo_backlinks`,
        );
        totalBacklinks = Number(bl.rows[0]?.total ?? 0);
        avgDomainAuthority =
          Math.round(Number(bl.rows[0]?.avg_da ?? 0) * 100) / 100;
      }

      res.json({
        totalKeywords,
        avgPosition,
        top10Count,
        totalBacklinks,
        avgDomainAuthority,
      });
    } catch (err) {
      console.error("[admin-marketing-seo] research stats failed:", err);
      res.status(500).json({ error: "seo_research_stats_failed" });
    }
  });

  // ─── Competitors (placeholder) ────────────────────────────────
  // GET /api/seo/competitors/recent?limit=10
  // TODO: DataForSEO-integrasjon. Tom-respons holder UI rolig.
  app.get("/api/seo/competitors/recent", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.json({ competitors: [], total: 0 });
  });

  // ─── Schemas (placeholder) ────────────────────────────────────
  // GET /api/seo/schemas/recent?limit=10
  // TODO: JSON-LD-genereringsdatabase. Tom-respons holder UI rolig.
  app.get("/api/seo/schemas/recent", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.json({ schemas: [], total: 0 });
  });

  // ─── Crawl (stub) ─────────────────────────────────────────────
  // POST /api/seo/crawl
  // TODO: ekte crawler-job-køing (BullMQ?).
  app.post("/api/seo/crawl", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.json({
      success: true,
      jobId: "placeholder",
      message: "Crawl scheduled",
    });
  });

  // ─── Competitor analyse (stub) ────────────────────────────────
  // POST /api/seo/competitor/analyze  body: { domain }
  app.post("/api/seo/competitor/analyze", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const domain =
      typeof req.body?.domain === "string" ? req.body.domain.trim() : "";
    if (!domain) {
      return res.status(400).json({ error: "domain_required" });
    }
    res.json({
      success: true,
      analysisId: "placeholder",
      domain,
    });
  });

  // ─── JSON-LD generering (stub) ────────────────────────────────
  // POST /api/seo/jsonld/generate  body: { url, type }
  app.post("/api/seo/jsonld/generate", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    const type =
      typeof req.body?.type === "string" && req.body.type.trim().length > 0
        ? req.body.type.trim()
        : "WebPage";

    if (!url) {
      return res.status(400).json({ error: "url_required" });
    }

    // Minimal JSON-LD-stub. Ekte generator kommer i en senere PR.
    const schema = {
      "@context": "https://schema.org",
      "@type": type,
      url,
    };

    res.json({
      success: true,
      url,
      type,
      schema,
    });
  });

  // ─── Keyword research (stub) ──────────────────────────────────
  // POST /api/seo/keywords/research  body: { seed }
  app.post("/api/seo/keywords/research", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const seed = typeof req.body?.seed === "string" ? req.body.seed.trim() : "";
    if (!seed) {
      return res.status(400).json({ error: "seed_required" });
    }

    // Placeholder-forslag. Ekte DataForSEO-kall kommer i senere PR.
    const suggestions = [
      { keyword: `${seed} pris`, searchVolume: null, difficulty: null },
      { keyword: `${seed} oslo`, searchVolume: null, difficulty: null },
      { keyword: `beste ${seed}`, searchVolume: null, difficulty: null },
      { keyword: `${seed} norge`, searchVolume: null, difficulty: null },
    ];

    res.json({
      success: true,
      seed,
      suggestions,
      total: suggestions.length,
    });
  });

  // ─── Sync (stubs) ─────────────────────────────────────────────
  // POST /api/seo/sync-data
  app.post("/api/seo/sync-data", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.json({
      success: true,
      lastSync: new Date().toISOString(),
    });
  });

  // POST /api/seo/sync-analytics
  app.post("/api/seo/sync-analytics", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.json({ success: true });
  });
}
