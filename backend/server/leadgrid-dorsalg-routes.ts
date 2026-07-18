// leadgrid-dorsalg-routes.ts
//
// Dørsalg-modus: husstands-status (vunnet/avslått) per org (mig 0397).
// Adressene selv hentes live fra Kartverket og lagres ALDRI som leads —
// men utfallet på døra er org-data og persisteres her, keyet på
// Kartverkets adresse-identitet ("adressetekst|postnummer").
//
// Org-scoping: org-id deriveres ALLTID fra innlogget bruker via
// resolveOrgIdForUser — aldri fra query/body (IDOR-linsen).

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";

const GYLDIGE_STATUSER = new Set(["vunnet", "avslatt"]);

export function registerLeadgridDorsalgRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, pool, requireUserSession } = deps;

  // GET /api/leadgrid/dorsalg/status — alle statuser for callerens org.
  app.get("/api/leadgrid/dorsalg/status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const r = await pool.query(
        `SELECT adresse_id, status, lat, lon, updated_at
           FROM leadgrid_dorsalg_status
          WHERE org_id = $1
          ORDER BY updated_at DESC
          LIMIT 20000`,
        [orgId],
      );
      return res.json({
        statuser: r.rows.map((row) => ({
          adresseId: row.adresse_id as string,
          status: row.status as string,
          lat: row.lat as number | null,
          lon: row.lon as number | null,
        })),
      });
    } catch (err) {
      console.error("[leadgrid-dorsalg] list feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/leadgrid/dorsalg/status — sett/oppdater status på én adresse.
  app.post("/api/leadgrid/dorsalg/status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const b = (req.body ?? {}) as {
      adresseId?: string;
      adressetekst?: string;
      postnummer?: string;
      poststed?: string;
      lat?: number;
      lon?: number;
      status?: string;
    };
    const adresseId = String(b.adresseId ?? "").trim();
    const status = String(b.status ?? "").trim();
    if (!adresseId || adresseId.length > 300) {
      return res.status(400).json({ error: "ugyldig_adresse_id" });
    }
    if (!GYLDIGE_STATUSER.has(status)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      await pool.query(
        `INSERT INTO leadgrid_dorsalg_status
           (org_id, adresse_id, adressetekst, postnummer, poststed,
            lat, lon, status, set_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (org_id, adresse_id) DO UPDATE SET
           status = EXCLUDED.status,
           set_by = EXCLUDED.set_by,
           lat = COALESCE(EXCLUDED.lat, leadgrid_dorsalg_status.lat),
           lon = COALESCE(EXCLUDED.lon, leadgrid_dorsalg_status.lon),
           updated_at = now()`,
        [
          orgId,
          adresseId,
          String(b.adressetekst ?? "").slice(0, 200),
          String(b.postnummer ?? "").slice(0, 10),
          String(b.poststed ?? "").slice(0, 100),
          Number.isFinite(b.lat) ? b.lat : null,
          Number.isFinite(b.lon) ? b.lon : null,
          status,
          session.userId,
        ],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-dorsalg] upsert feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // DELETE /api/leadgrid/dorsalg/status/:adresseId — fjern status (angre).
  app.delete("/api/leadgrid/dorsalg/status/:adresseId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const adresseId = String(req.params.adresseId ?? "").trim();
    if (!adresseId) return res.status(400).json({ error: "ugyldig_adresse_id" });
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      await pool.query(
        `DELETE FROM leadgrid_dorsalg_status
          WHERE org_id = $1 AND adresse_id = $2`,
        [orgId, adresseId],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-dorsalg] delete feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });
}
