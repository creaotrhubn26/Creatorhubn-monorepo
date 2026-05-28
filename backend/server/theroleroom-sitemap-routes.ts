/**
 * theroleroom-sitemap-routes.ts
 *
 * Dynamisk sitemap som inkluderer:
 *   - Statiske pillar-sider og landing
 *   - Alle competitor-sammenligning-sider (/vs-*)
 *   - Alle publiserte brief-utgaver (/brief/<slug>)
 *
 * Erstatter den statiske theroleroom-sitemap.xml ved at vercel.json
 * rewriter /sitemap.xml på theroleroom.com til /api/theroleroom-sitemap.xml.
 *
 * Public — ingen auth.
 */

import type express from "express";
import type { Pool } from "pg";

interface SitemapDeps {
  app: express.Application;
  pool: Pool;
}

const STATIC_URLS: Array<{ loc: string; priority: number; changefreq: string }> = [
  { loc: "/", priority: 1.0, changefreq: "weekly" },
  { loc: "/talentportal", priority: 0.9, changefreq: "weekly" },
  { loc: "/utdanningsinstitusjon", priority: 0.8, changefreq: "monthly" },
  { loc: "/alternatives", priority: 0.8, changefreq: "monthly" },
  { loc: "/vs-studiobinder", priority: 0.8, changefreq: "monthly" },
  { loc: "/vs-castingnetworks", priority: 0.8, changefreq: "monthly" },
  { loc: "/vs-moviemagic", priority: 0.8, changefreq: "monthly" },
  { loc: "/vs-yamdu", priority: 0.7, changefreq: "monthly" },
  { loc: "/vs-setkeeper", priority: 0.7, changefreq: "monthly" },
  { loc: "/for-studenter", priority: 0.9, changefreq: "monthly" },
  { loc: "/film-tv-utdanning", priority: 0.8, changefreq: "monthly" },
  { loc: "/casting-director-utdanning", priority: 0.8, changefreq: "monthly" },
  { loc: "/regissor-verktoy", priority: 0.8, changefreq: "monthly" },
  { loc: "/produksjonsledelse-studie", priority: 0.8, changefreq: "monthly" },
  { loc: "/innholdsprodusenter", priority: 0.9, changefreq: "monthly" },
  { loc: "/innholdsproduksjon-studie", priority: 0.8, changefreq: "monthly" },
  { loc: "/dansestudio", priority: 0.8, changefreq: "monthly" },
  { loc: "/presse", priority: 0.5, changefreq: "monthly" },
  // GEO/AI-pillar-sider
  { loc: "/casting-svindel-tegn", priority: 0.9, changefreq: "monthly" },
  { loc: "/barn-samtykke-film", priority: 0.9, changefreq: "monthly" },
  { loc: "/casting-rapport-2026", priority: 0.95, changefreq: "monthly" },
  { loc: "/vart-syn", priority: 0.85, changefreq: "monthly" },
  { loc: "/selvtape-tips", priority: 0.85, changefreq: "monthly" },
  { loc: "/bak-castingen", priority: 0.85, changefreq: "monthly" },
  { loc: "/operativsystem", priority: 0.9, changefreq: "monthly" },
  { loc: "/norsk-casting-ordliste", priority: 0.95, changefreq: "monthly" },
  { loc: "/arbeidstilsynet-guide-produksjon", priority: 0.9, changefreq: "monthly" },
  { loc: "/sentimental-value-effekten", priority: 0.85, changefreq: "monthly" },
  { loc: "/crew-i-norge-2026", priority: 0.9, changefreq: "monthly" },
  { loc: "/innspillingsdag-koordinering", priority: 0.9, changefreq: "monthly" },
  { loc: "/intimacy-coordinator-norge", priority: 0.95, changefreq: "monthly" },
  { loc: "/kamera-folk-verktoy-2026", priority: 0.9, changefreq: "monthly" },
  { loc: "/etterproduksjon-norge-2026", priority: 0.9, changefreq: "monthly" },
  // Brief-arkiv-indeks
  { loc: "/brief", priority: 0.9, changefreq: "weekly" },
  // Juridisk
  { loc: "/privacy", priority: 0.3, changefreq: "yearly" },
  { loc: "/terms-and-conditions", priority: 0.3, changefreq: "yearly" },
  { loc: "/data-deletion", priority: 0.3, changefreq: "yearly" },
];

function xmlEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function setupTheRoleRoomSitemapRoutes(deps: SitemapDeps): void {
  const { app, pool } = deps;

  app.get("/api/theroleroom-sitemap.xml", async (_req, res) => {
    try {
      const published = await pool.query(
        `SELECT slug, COALESCE(published_at, updated_at) AS lastmod
           FROM role_room_newsletter_issues
          WHERE published_to_web = TRUE AND status = 'sent'
          ORDER BY published_at DESC NULLS LAST
          LIMIT 500`,
      );

      const today = new Date().toISOString().slice(0, 10);
      const lines: string[] = [];
      lines.push('<?xml version="1.0" encoding="UTF-8"?>');
      lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">');

      for (const entry of STATIC_URLS) {
        lines.push("  <url>");
        lines.push(`    <loc>https://theroleroom.com${xmlEscape(entry.loc)}</loc>`);
        lines.push(`    <lastmod>${today}</lastmod>`);
        lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
        lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
        lines.push("  </url>");
      }

      for (const row of published.rows as { slug: string; lastmod: string | Date | null }[]) {
        const lastmod = row.lastmod instanceof Date
          ? row.lastmod.toISOString().slice(0, 10)
          : typeof row.lastmod === "string"
            ? row.lastmod.slice(0, 10)
            : today;
        lines.push("  <url>");
        lines.push(`    <loc>https://theroleroom.com/brief/${xmlEscape(row.slug)}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push(`    <changefreq>monthly</changefreq>`);
        lines.push(`    <priority>0.8</priority>`);
        lines.push("  </url>");
      }

      lines.push("</urlset>");

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
      res.send(lines.join("\n"));
    } catch (err) {
      console.error("[theroleroom-sitemap] error", err);
      res.status(500).send("<!-- sitemap generation failed -->");
    }
  });
}
