/**
 * leadgrid-testimonials-routes.ts
 *
 * Kundeomtaler for leadgrid.no. Aktiverbart oppsett: seksjonen på landing er
 * skjult til det finnes minst én GODKJENT omtale. Omtaler samles inn fra
 * kunder i appen («Hva synes du om Leadgrid?»), og super-admin godkjenner
 * før de vises offentlig.
 *
 *   POST /api/leadgrid/testimonials         — innsending (app/offentlig), godkjennes IKKE auto
 *   GET  /api/leadgrid/testimonials         — OFFENTLIG, kun godkjente (landing leser)
 *   GET  /api/leadgrid/testimonials/admin   — SUPER-ADMIN, alle (til godkjenning)
 *   PUT  /api/leadgrid/testimonials/:id      — SUPER-ADMIN (godkjenn/rediger/sorter)
 *   DELETE /api/leadgrid/testimonials/:id    — SUPER-ADMIN
 *
 * Lat ensureSchema. Gate-mønster speilet fra leadgrid-pricing-config.
 */

import type { Express, Request } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_testimonials (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      quote TEXT NOT NULL,
      rating INT NOT NULL DEFAULT 5,
      source TEXT NOT NULL DEFAULT 'app',
      approved BOOLEAN NOT NULL DEFAULT false,
      sort_order INT NOT NULL DEFAULT 0,
      submitter_org TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  schemaReady = true;
}

export function registerLeadgridTestimonialsRoutes(deps: {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}) {
  const { app, pool, activeSessions, isAdminEmail } = deps;

  function session(req: Request): SessionData | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return activeSessions.get(auth.slice(7).trim()) ?? null;
    return null;
  }
  function requireAdmin(req: Request): boolean {
    const s = session(req);
    return !!s && isAdminEmail(s.email);
  }

  // OFFENTLIG — landing leser kun godkjente.
  app.get("/api/leadgrid/testimonials", async (_req, res) => {
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT id, name, role, quote, rating FROM leadgrid_testimonials
          WHERE approved = true ORDER BY sort_order ASC, created_at DESC LIMIT 12`,
      );
      res.set("Cache-Control", "public, max-age=60");
      return res.json({ testimonials: r.rows });
    } catch (err) {
      console.warn("[leadgrid-testimonials] get failed:", (err as Error).message);
      return res.json({ testimonials: [] });
    }
  });

  // OFFENTLIG innsending (in-app-prompt). Godkjennes IKKE automatisk.
  app.post("/api/leadgrid/testimonials", async (req, res) => {
    try {
      await ensureSchema(pool);
      const quote = clip(req.body?.quote, 600);
      if (quote.length < 4) return res.status(400).json({ error: "empty_quote" });
      const name = clip(req.body?.name, 120);
      const role = clip(req.body?.role, 160);
      const org = clip(req.body?.submitterOrg, 160);
      let rating = parseInt(String(req.body?.rating ?? 5), 10);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) rating = 5;
      await pool.query(
        `INSERT INTO leadgrid_testimonials (id, name, role, quote, rating, source, submitter_org)
         VALUES ($1, $2, $3, $4, $5, 'app', $6)`,
        [(globalThis.crypto as any).randomUUID(), name, role, quote, rating, org],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-testimonials] post failed:", (err as Error).message);
      return res.status(500).json({ error: "submit_failed" });
    }
  });

  // SUPER-ADMIN — alle (til godkjenning/administrasjon).
  app.get("/api/leadgrid/testimonials/admin", async (req, res) => {
    if (!requireAdmin(req)) return res.status(403).json({ error: "not_super_admin" });
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT id, name, role, quote, rating, source, approved, sort_order, submitter_org, created_at
           FROM leadgrid_testimonials ORDER BY approved ASC, created_at DESC`,
      );
      return res.json({ testimonials: r.rows });
    } catch (err) {
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // SUPER-ADMIN — godkjenn/rediger/sorter.
  app.put("/api/leadgrid/testimonials/:id", async (req, res) => {
    if (!requireAdmin(req)) return res.status(403).json({ error: "not_super_admin" });
    try {
      await ensureSchema(pool);
      const id = clip(req.params.id, 64);
      const b = req.body ?? {};
      await pool.query(
        `UPDATE leadgrid_testimonials SET
           name = COALESCE($2, name),
           role = COALESCE($3, role),
           quote = COALESCE($4, quote),
           rating = COALESCE($5, rating),
           approved = COALESCE($6, approved),
           sort_order = COALESCE($7, sort_order)
         WHERE id = $1`,
        [
          id,
          b.name !== undefined ? clip(b.name, 120) : null,
          b.role !== undefined ? clip(b.role, 160) : null,
          b.quote !== undefined ? clip(b.quote, 600) : null,
          b.rating !== undefined ? Math.min(5, Math.max(1, parseInt(String(b.rating), 10) || 5)) : null,
          b.approved !== undefined ? !!b.approved : null,
          b.sortOrder !== undefined ? (parseInt(String(b.sortOrder), 10) || 0) : null,
        ],
      );
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "internal_error" });
    }
  });

  app.delete("/api/leadgrid/testimonials/:id", async (req, res) => {
    if (!requireAdmin(req)) return res.status(403).json({ error: "not_super_admin" });
    try {
      await ensureSchema(pool);
      await pool.query(`DELETE FROM leadgrid_testimonials WHERE id = $1`, [clip(req.params.id, 64)]);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "internal_error" });
    }
  });
}
