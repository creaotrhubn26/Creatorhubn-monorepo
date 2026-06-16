/**
 * lead-map-logo-routes.ts
 *
 * Endepunkter for å hente og lagre bedrifts-logo på lead-pin:
 *   POST /leads/:id/fetch-logo     — Auto-fetch fra bedriftens website
 *   PATCH /leads/:id/logo          — Sett logo-URL manuelt
 *   DELETE /leads/:id/logo         — Fjern logo
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { fetchBestLogo } from "./lead-logo-fetcher.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return activeSessions.get(auth.slice(7)) ?? null;
  return null;
}

async function userOwnsLead(pool: Pool, userId: string, leadId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM crm_customers WHERE id = $1 AND owner_user_id = $2 LIMIT 1`,
    [leadId, userId],
  );
  return r.rowCount !== null && r.rowCount > 0;
}

export function registerLeadMapLogoRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── POST /leads/:id/fetch-logo ──────────────────────────────────
  app.post(
    "/api/admin-room/lead-map/leads/:id/fetch-logo",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await userOwnsLead(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "ikke_eier_av_lead" });
      }
      const leadRes = await pool.query<{ website_url: string | null; name: string }>(
        `SELECT website_url, name FROM crm_customers WHERE id = $1`,
        [req.params.id],
      );
      const lead = leadRes.rows[0];
      if (!lead) return res.status(404).json({ error: "lead_ikke_funnet" });
      if (!lead.website_url) {
        return res.status(400).json({
          error: "mangler_website",
          message: "Lead-en har ingen website-URL — kan ikke hente logo automatisk",
        });
      }
      try {
        const logo = await fetchBestLogo(lead.website_url);
        if (!logo) {
          return res.status(404).json({ error: "ingen_logo_funnet" });
        }
        await pool.query(
          `UPDATE crm_customers SET logo_url = $2 WHERE id = $1`,
          [req.params.id, logo.url],
        );
        return res.json({
          ok: true,
          logo_url: logo.url,
          source: logo.source,
          size: logo.size ?? null,
        });
      } catch (err) {
        return res.status(500).json({ error: "fetch_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /leads/:id/logo ───────────────────────────────────────
  app.patch(
    "/api/admin-room/lead-map/leads/:id/logo",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await userOwnsLead(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "ikke_eier_av_lead" });
      }
      const body = req.body as { logo_url?: string };
      if (!body.logo_url) {
        return res.status(400).json({ error: "mangler_logo_url" });
      }
      try {
        await pool.query(
          `UPDATE crm_customers SET logo_url = $2 WHERE id = $1`,
          [req.params.id, body.logo_url],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ─── DELETE /leads/:id/logo ──────────────────────────────────────
  app.delete(
    "/api/admin-room/lead-map/leads/:id/logo",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await userOwnsLead(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "ikke_eier_av_lead" });
      }
      try {
        await pool.query(
          `UPDATE crm_customers SET logo_url = NULL WHERE id = $1`,
          [req.params.id],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "delete_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /leads/fetch-logos-bulk ────────────────────────────────
  // Auto-hent logo for alle leads som har website_url men ikke logo_url
  app.post(
    "/api/admin-room/lead-map/leads/fetch-logos-bulk",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const leadsRes = await pool.query<{ id: string; website_url: string | null }>(
        `SELECT id::text, website_url FROM crm_customers
          WHERE owner_user_id = $1
            AND website_url IS NOT NULL
            AND (logo_url IS NULL OR logo_url = '')
          LIMIT 50`,
        [session.userId],
      );
      const results: Array<{ id: string; ok: boolean; logo_url?: string; error?: string }> = [];
      for (const row of leadsRes.rows) {
        if (!row.website_url) continue;
        try {
          const logo = await fetchBestLogo(row.website_url);
          if (logo) {
            await pool.query(
              `UPDATE crm_customers SET logo_url = $2 WHERE id = $1`,
              [row.id, logo.url],
            );
            results.push({ id: row.id, ok: true, logo_url: logo.url });
          } else {
            results.push({ id: row.id, ok: false, error: "no_logo" });
          }
        } catch (err) {
          results.push({ id: row.id, ok: false, error: String(err) });
        }
      }
      return res.json({
        ok: true,
        processed: results.length,
        succeeded: results.filter((r) => r.ok).length,
        results,
      });
    },
  );
}
