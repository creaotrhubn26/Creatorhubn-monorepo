/**
 * leadgrid-email-branding-routes.ts
 *
 * Super-admin API for å konfigurere e-post-branding per org.
 * Variabel-substitusjon i notifyClient() bruker disse for å gjøre
 * e-post merkevarebygd per kunde-organisasjon.
 *
 *   GET    /api/superadmin/email-branding              (list alle)
 *   GET    /api/superadmin/email-branding/:org_key     (én, eller default)
 *   PUT    /api/superadmin/email-branding/:org_key     (upsert)
 *   DELETE /api/superadmin/email-branding/:org_key     (slett — fall til default)
 *   GET    /api/superadmin/email-branding/preview      (preview HTML m/ valgte vars)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

async function requireSuperAdmin(
  pool: Pool, sessions: Map<string, SessionData>,
  req: Request, res: Response,
): Promise<SessionData | null> {
  const s = getSession(req, sessions);
  if (!s) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM users WHERE id = $1`, [s.userId],
  );
  if (r.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" });
    return null;
  }
  return s;
}

export function registerLeadgridEmailBrandingRoutes({ app, pool, activeSessions }: Deps): void {

  // ============================================================
  // LISTE ALLE
  // ============================================================
  app.get("/api/superadmin/email-branding", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;
    const r = await pool.query(
      `SELECT id, org_key, from_name, from_email, reply_to_email,
              sender_full_name, sender_title, sender_phone, sender_email,
              brand_name, brand_logo_url, brand_primary_color, brand_accent_color,
              footer_html, footer_address, custom_variables,
              updated_at::text
         FROM leadgrid_email_branding_config
        ORDER BY (org_key IS NULL) DESC, updated_at DESC`,
    );
    res.json({ configs: r.rows });
  });

  // ============================================================
  // HENT ÉN (org_key = '__global__' → NULL)
  // ============================================================
  app.get("/api/superadmin/email-branding/:org_key", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;
    const isGlobal = req.params.org_key === "__global__";
    const r = await pool.query(
      `SELECT * FROM leadgrid_email_branding_config
        WHERE ($1::boolean AND org_key IS NULL) OR org_key = $2
        LIMIT 1`,
      [isGlobal, isGlobal ? null : req.params.org_key],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    res.json(r.rows[0]);
  });

  // ============================================================
  // UPSERT
  // ============================================================
  app.put("/api/superadmin/email-branding/:org_key", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const b = req.body ?? {};
    const orgKey = req.params.org_key === "__global__" ? null : req.params.org_key;

    if (orgKey) {
      // Per-org: full upsert
      await pool.query(
        `INSERT INTO leadgrid_email_branding_config
           (org_key, from_name, from_email, reply_to_email,
            sender_full_name, sender_title, sender_phone, sender_email,
            brand_name, brand_logo_url, brand_primary_color, brand_accent_color,
            footer_html, footer_address, custom_variables,
            configured_by_user_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now())
         ON CONFLICT (org_key) DO UPDATE SET
           from_name = EXCLUDED.from_name,
           from_email = EXCLUDED.from_email,
           reply_to_email = EXCLUDED.reply_to_email,
           sender_full_name = EXCLUDED.sender_full_name,
           sender_title = EXCLUDED.sender_title,
           sender_phone = EXCLUDED.sender_phone,
           sender_email = EXCLUDED.sender_email,
           brand_name = EXCLUDED.brand_name,
           brand_logo_url = EXCLUDED.brand_logo_url,
           brand_primary_color = EXCLUDED.brand_primary_color,
           brand_accent_color = EXCLUDED.brand_accent_color,
           footer_html = EXCLUDED.footer_html,
           footer_address = EXCLUDED.footer_address,
           custom_variables = EXCLUDED.custom_variables,
           updated_at = now()`,
        [orgKey, b.from_name ?? "Leadgrid", b.from_email ?? null,
         b.reply_to_email ?? null,
         b.sender_full_name ?? null, b.sender_title ?? null,
         b.sender_phone ?? null, b.sender_email ?? null,
         b.brand_name ?? "Leadgrid", b.brand_logo_url ?? null,
         b.brand_primary_color ?? "#a78bfa", b.brand_accent_color ?? "#9be15d",
         b.footer_html ?? null, b.footer_address ?? null,
         JSON.stringify(b.custom_variables ?? {}),
         s.userId],
      );
    } else {
      // Global: update kun (vi insert'et default-raden i mig)
      await pool.query(
        `UPDATE leadgrid_email_branding_config SET
           from_name = $1, from_email = $2, reply_to_email = $3,
           sender_full_name = $4, sender_title = $5,
           sender_phone = $6, sender_email = $7,
           brand_name = $8, brand_logo_url = $9,
           brand_primary_color = $10, brand_accent_color = $11,
           footer_html = $12, footer_address = $13,
           custom_variables = $14,
           configured_by_user_id = $15, updated_at = now()
          WHERE org_key IS NULL`,
        [b.from_name ?? "Leadgrid", b.from_email ?? null, b.reply_to_email ?? null,
         b.sender_full_name ?? null, b.sender_title ?? null,
         b.sender_phone ?? null, b.sender_email ?? null,
         b.brand_name ?? "Leadgrid", b.brand_logo_url ?? null,
         b.brand_primary_color ?? "#a78bfa", b.brand_accent_color ?? "#9be15d",
         b.footer_html ?? null, b.footer_address ?? null,
         JSON.stringify(b.custom_variables ?? {}), s.userId],
      );
    }
    res.json({ ok: true });
  });

  // ============================================================
  // DELETE
  // ============================================================
  app.delete("/api/superadmin/email-branding/:org_key", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;
    if (req.params.org_key === "__global__") {
      return res.status(400).json({ error: "Kan ikke slette global-default. Reset via PUT istedet." });
    }
    await pool.query(
      `DELETE FROM leadgrid_email_branding_config WHERE org_key = $1`,
      [req.params.org_key],
    );
    res.json({ ok: true });
  });
}
