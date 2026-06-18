/**
 * leadgrid-partners-routes.ts
 *
 * Samarbeidspartner-katalog:
 *   - Public: GET /api/leadgrid/partners (landing-strip)
 *   - Superadmin: list/create/update/delete + auto-import fra eksisterende
 *     orgs som har gitt samtykke
 *
 * Adresserer Daniels feedback: navnene på landingen skal ikke være
 * hardkodet ("ElektroPartner, Fixit, …") men dynamisk koblet til
 * partnere vi faktisk har.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const token = (req as any).cookies?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

async function requireSuperAdmin(
  req: Request, res: Response, pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const s = getSession(req, activeSessions);
  if (!s) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id=$1`, [s.userId]);
  if (r.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" }); return null;
  }
  return s;
}

export function registerLeadgridPartnersRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- Public: landing-strip ----------
  app.get("/api/leadgrid/partners", async (req, res) => {
    const type = req.query.type as string | undefined;
    try {
      const r = await pool.query(
        `SELECT id, name, logo_url, website, tagline, partner_type
           FROM leadgrid_partners
          WHERE is_active = TRUE
            AND show_on_landing = TRUE
            ${type ? "AND partner_type = $1" : ""}
          ORDER BY display_order ASC, name ASC`,
        type ? [type] : [],
      );
      res.json({ partners: r.rows });
    } catch (e) {
      console.error("[partners public]", e);
      res.status(500).json({ error: "Kunne ikke hente partnere" });
    }
  });

  // ---------- Superadmin: full liste m/ alle felt ----------
  app.get("/api/superadmin/partners", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query(
      `SELECT p.*, o.name AS org_name, o.logo_url AS org_logo_url, o.website AS org_website
         FROM leadgrid_partners p
         LEFT JOIN organizations o ON o.id = p.organization_id
         ORDER BY p.display_order ASC, p.name ASC`,
    );
    res.json({ partners: r.rows });
  });

  // ---------- Superadmin: opprett ----------
  app.post("/api/superadmin/partners", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const {
      name, logo_url, website, tagline, partner_type,
      organization_id, display_order, show_on_landing,
      consent_source,
    } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "name påkrevd" });
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    try {
      const r = await pool.query(
        `INSERT INTO leadgrid_partners
          (name, slug, logo_url, website, tagline, partner_type,
           organization_id, display_order, show_on_landing,
           consent_at, consent_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10)
         RETURNING *`,
        [
          name, slug, logo_url ?? null, website ?? null, tagline ?? null,
          partner_type ?? "customer", organization_id ?? null,
          display_order ?? 100, show_on_landing !== false,
          consent_source ?? "superadmin",
        ],
      );
      res.status(201).json({ partner: r.rows[0] });
    } catch (e: any) {
      console.error("[partners create]", e);
      res.status(500).json({ error: e.message ?? "Kunne ikke opprette partner" });
    }
  });

  // ---------- Superadmin: oppdater ----------
  app.patch("/api/superadmin/partners/:id", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const ALLOWED = [
      "name", "logo_url", "website", "tagline", "partner_type",
      "organization_id", "display_order", "is_active", "show_on_landing",
    ];
    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const k of ALLOWED) {
      if (k in (req.body ?? {})) {
        updates.push(`${k} = $${i++}`);
        values.push((req.body as any)[k]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: "Ingenting å oppdatere" });
    updates.push(`updated_at = now()`);
    values.push(req.params.id);
    const r = await pool.query(
      `UPDATE leadgrid_partners SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      values,
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    res.json({ partner: r.rows[0] });
  });

  // ---------- Superadmin: slett ----------
  app.delete("/api/superadmin/partners/:id", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    await pool.query(`DELETE FROM leadgrid_partners WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  });

  // ---------- Superadmin: auto-import fra orgs ----------
  // POST { sourceOrgIds: string[], consent_source: 'partnership_agreement' }
  app.post("/api/superadmin/partners/auto-import", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { sourceOrgIds, consent_source } = req.body ?? {};
    if (!Array.isArray(sourceOrgIds) || sourceOrgIds.length === 0) {
      return res.status(400).json({ error: "sourceOrgIds påkrevd" });
    }
    const r = await pool.query(
      `INSERT INTO leadgrid_partners
        (name, slug, logo_url, website, partner_type, organization_id,
         display_order, show_on_landing, consent_at, consent_source)
       SELECT
         o.name,
         lower(regexp_replace(o.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(o.id::text), 1, 4),
         o.logo_url, o.website, 'customer', o.id, 100, TRUE, now(),
         $2
         FROM organizations o
        WHERE o.id = ANY($1::uuid[])
          AND o.logo_url IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM leadgrid_partners p WHERE p.organization_id = o.id
          )
       RETURNING id, name`,
      [sourceOrgIds, consent_source ?? "partnership_agreement"],
    );
    res.json({ imported: r.rows });
  });
}
