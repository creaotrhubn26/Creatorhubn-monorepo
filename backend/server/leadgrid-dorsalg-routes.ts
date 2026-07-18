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
      // Vunnet dør → Kvalitet-køen (Daniel 2026-07-18: angrerett på døra —
      // kontrolløren ringer og verifiserer dørsalget). Idempotent via unik
      // (organization_id, customer_id); customer_id = "dorsalg:<adresse_id>".
      // Best effort: Kvalitet-tabellen kan mangle hvis org-en aldri har
      // åpnet Kvalitet (lazy ensureSchema der) — da hopper vi stille over.
      const kvalitetKundeId = `dorsalg:${adresseId}`;
      const adresseNavn = [
        String(b.adressetekst ?? "").slice(0, 200),
        `${String(b.postnummer ?? "").slice(0, 10)} ${String(b.poststed ?? "").slice(0, 100)}`.trim(),
      ].filter(Boolean).join(", ");
      try {
        if (status === "vunnet") {
          await pool.query(
            `INSERT INTO leadgrid_sales_verifications
               (id, organization_id, customer_id, customer_name,
                seller_user_id, seller_name, won_at)
             SELECT gen_random_uuid(), $1, $2, $3, $4,
                    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                             u.username, $4),
                    now()
               FROM (SELECT 1) one
               LEFT JOIN users u ON u.id = $4
             ON CONFLICT (organization_id, customer_id) DO NOTHING`,
            [orgId, kvalitetKundeId, adresseNavn, session.userId],
          );
        } else {
          // Avslått/omgjort: fjern KUN ubehandlede dørsalg-rader — ferdig
          // verifisert historikk røres aldri.
          await pool.query(
            `DELETE FROM leadgrid_sales_verifications
              WHERE organization_id = $1 AND customer_id = $2
                AND status = 'pending'`,
            [orgId, kvalitetKundeId],
          );
        }
      } catch (e) {
        console.warn("[leadgrid-dorsalg] kvalitet-kobling hoppet over:", (e as Error).message);
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-dorsalg] upsert feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/leadgrid/dorsalg/stats — dørsalg-oversikt for org-en:
  // totaler, i dag, denne uka, per selger + siste vunnede dører.
  app.get("/api/leadgrid/dorsalg/stats", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const totals = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'vunnet')::int  AS vunnet,
           COUNT(*) FILTER (WHERE status = 'avslatt')::int AS avslatt,
           COUNT(*) FILTER (WHERE updated_at >= date_trunc('day', now()))::int AS i_dag,
           COUNT(*) FILTER (WHERE status = 'vunnet'
                              AND updated_at >= date_trunc('day', now()))::int AS vunnet_i_dag,
           COUNT(*) FILTER (WHERE updated_at >= date_trunc('week', now()))::int AS denne_uka
         FROM leadgrid_dorsalg_status
        WHERE org_id = $1`,
        [orgId],
      );
      const perSelger = await pool.query(
        `SELECT
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                    u.username, s.set_by) AS navn,
           COUNT(*) FILTER (WHERE s.status = 'vunnet')::int  AS vunnet,
           COUNT(*) FILTER (WHERE s.status = 'avslatt')::int AS avslatt
         FROM leadgrid_dorsalg_status s
         LEFT JOIN users u ON u.id = s.set_by
        WHERE s.org_id = $1 AND s.set_by IS NOT NULL
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 20`,
        [orgId],
      );
      const sisteVunnet = await pool.query(
        `SELECT adressetekst, postnummer, poststed, updated_at
           FROM leadgrid_dorsalg_status
          WHERE org_id = $1 AND status = 'vunnet'
          ORDER BY updated_at DESC
          LIMIT 8`,
        [orgId],
      );
      // Callerens egne tall — driver «Min profil»-KPI-ene for dørsalg.
      const meg = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'vunnet')::int  AS vunnet,
           COUNT(*) FILTER (WHERE status = 'avslatt')::int AS avslatt,
           COUNT(*) FILTER (WHERE updated_at >= date_trunc('day', now()))::int AS i_dag,
           COUNT(*) FILTER (WHERE updated_at >= date_trunc('week', now()))::int AS denne_uka
         FROM leadgrid_dorsalg_status
        WHERE org_id = $1 AND set_by = $2`,
        [orgId, session.userId],
      );
      const t = totals.rows[0] ?? {};
      const m = meg.rows[0] ?? {};
      return res.json({
        vunnet: t.vunnet ?? 0,
        avslatt: t.avslatt ?? 0,
        iDag: t.i_dag ?? 0,
        vunnetIDag: t.vunnet_i_dag ?? 0,
        denneUka: t.denne_uka ?? 0,
        meg: {
          vunnet: m.vunnet ?? 0,
          avslatt: m.avslatt ?? 0,
          iDag: m.i_dag ?? 0,
          denneUka: m.denne_uka ?? 0,
        },
        perSelger: perSelger.rows.map((r) => ({
          navn: r.navn as string,
          vunnet: r.vunnet as number,
          avslatt: r.avslatt as number,
        })),
        sisteVunnet: sisteVunnet.rows.map((r) => ({
          adressetekst: r.adressetekst as string,
          postnummer: r.postnummer as string,
          poststed: r.poststed as string,
          settAt: (r.updated_at as Date).toISOString().replace(/\.\d{3}Z$/, "Z"),
        })),
      });
    } catch (err) {
      console.error("[leadgrid-dorsalg] stats feilet:", (err as Error).message);
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
      // Angret vunnet: fjern KUN ubehandlet dørsalg-rad fra Kvalitet-køen
      // (verifisert historikk røres aldri). Best effort — tabellen kan
      // mangle hvis Kvalitet aldri er åpnet.
      try {
        await pool.query(
          `DELETE FROM leadgrid_sales_verifications
            WHERE organization_id = $1 AND customer_id = $2
              AND status = 'pending'`,
          [orgId, `dorsalg:${adresseId}`],
        );
      } catch (e) {
        console.warn("[leadgrid-dorsalg] kvalitet-opprydding hoppet over:", (e as Error).message);
      }
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
