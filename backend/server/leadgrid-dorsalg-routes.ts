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
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";

const GYLDIGE_STATUSER = new Set(["vunnet", "avslatt"]);
const LEADER_ROLES = new Set(["admin", "salgssjef"]);

export function registerLeadgridDorsalgRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, pool, requireUserSession } = deps;

  async function isLeader(orgId: string, userId: string): Promise<boolean> {
    try {
      const { role, permissions } = await resolveEffectivePermissions(pool, orgId, userId);
      return (role != null && LEADER_ROLES.has(role)) || permissions.has("dorsalg.manage");
    } catch {
      return false;
    }
  }

  /// Produkt-idene calleren har tilgang til. null = alle (ingen rader).
  async function productAccess(orgId: string, userId: string): Promise<Set<string> | null> {
    const r = await pool.query(
      `SELECT product_id FROM leadgrid_dorsalg_product_access
        WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId],
    );
    if (r.rows.length === 0) return null;
    return new Set(r.rows.map((row) => String(row.product_id)));
  }

  // ─── Produkter (2026-07-18): org selger for flere oppdragsgivere ───

  // GET /api/leadgrid/dorsalg/products — org-ens produkter + callerens
  // tilgang (tom mine-liste = alle produkter) + canManage.
  app.get("/api/leadgrid/dorsalg/products", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const r = await pool.query(
        `SELECT id, navn, farge, aktiv, verdi_per_vunnet
           FROM leadgrid_dorsalg_products
          WHERE org_id = $1
          ORDER BY sort, navn`,
        [orgId],
      );
      const access = await productAccess(orgId, session.userId);
      return res.json({
        canManage: await isLeader(orgId, session.userId),
        mine: access ? Array.from(access) : [],
        products: r.rows.map((row) => ({
          id: String(row.id),
          navn: row.navn as string,
          farge: row.farge as string,
          aktiv: row.aktiv as boolean,
          verdiPerVunnet: row.verdi_per_vunnet != null ? Number(row.verdi_per_vunnet) : null,
        })),
      });
    } catch (err) {
      console.error("[leadgrid-dorsalg] products feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/leadgrid/dorsalg/products — opprett (kun admin/salgssjef).
  app.post("/api/leadgrid/dorsalg/products", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const b = (req.body ?? {}) as { navn?: string; farge?: string; verdiPerVunnet?: number };
    const navn = String(b.navn ?? "").trim();
    if (!navn || navn.length > 120) return res.status(400).json({ error: "ugyldig_navn" });
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!(await isLeader(orgId, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      const ins = await pool.query(
        `INSERT INTO leadgrid_dorsalg_products (org_id, navn, farge, verdi_per_vunnet)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          orgId, navn,
          String(b.farge ?? "#A855F7").slice(0, 20),
          Number.isFinite(b.verdiPerVunnet) ? b.verdiPerVunnet : null,
        ],
      );
      return res.json({ ok: true, id: String(ins.rows[0]?.id) });
    } catch (err) {
      console.error("[leadgrid-dorsalg] product-opprett feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // PATCH /api/leadgrid/dorsalg/products/:id — endre/deaktiver (leder).
  app.patch("/api/leadgrid/dorsalg/products/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = String(req.params.id ?? "").trim();
    const b = (req.body ?? {}) as {
      navn?: string; farge?: string; aktiv?: boolean; verdiPerVunnet?: number | null;
    };
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!(await isLeader(orgId, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      await pool.query(
        `UPDATE leadgrid_dorsalg_products SET
           navn = COALESCE(NULLIF($3, ''), navn),
           farge = COALESCE(NULLIF($4, ''), farge),
           aktiv = COALESCE($5, aktiv),
           verdi_per_vunnet = CASE WHEN $6::boolean THEN $7 ELSE verdi_per_vunnet END,
           updated_at = now()
         WHERE id = $1::uuid AND org_id = $2`,
        [
          id, orgId,
          b.navn != null ? String(b.navn).trim().slice(0, 120) : "",
          b.farge != null ? String(b.farge).slice(0, 20) : "",
          typeof b.aktiv === "boolean" ? b.aktiv : null,
          "verdiPerVunnet" in b,
          Number.isFinite(b.verdiPerVunnet) ? b.verdiPerVunnet : null,
        ],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-dorsalg] product-patch feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/leadgrid/dorsalg/products/access — org-medlemmer m/ tildelte
  // produkter (kun leder). Tom productIds = ser alle.
  app.get("/api/leadgrid/dorsalg/products/access", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!(await isLeader(orgId, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      const members = await pool.query(
        `SELECT om.user_id::text AS user_id, om.role,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                         u.username, om.user_id::text) AS navn
           FROM organization_members om
           LEFT JOIN users u ON u.id = om.user_id::text
          WHERE om.organization_id = $1::uuid
          ORDER BY navn`,
        [orgId],
      );
      const access = await pool.query(
        `SELECT user_id, product_id FROM leadgrid_dorsalg_product_access
          WHERE org_id = $1`,
        [orgId],
      );
      const byUser = new Map<string, string[]>();
      for (const row of access.rows) {
        const list = byUser.get(String(row.user_id)) ?? [];
        list.push(String(row.product_id));
        byUser.set(String(row.user_id), list);
      }
      return res.json({
        members: members.rows.map((m) => ({
          userId: m.user_id as string,
          navn: m.navn as string,
          role: (m.role as string | null) ?? "",
          productIds: byUser.get(m.user_id as string) ?? [],
        })),
      });
    } catch (err) {
      console.error("[leadgrid-dorsalg] access-list feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // PUT /api/leadgrid/dorsalg/products/access — sett en brukers produkt-
  // tilgang (kun leder). Tom liste = alle produkter (sletter radene).
  app.put("/api/leadgrid/dorsalg/products/access", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const b = (req.body ?? {}) as { userId?: string; productIds?: string[] };
    const userId = String(b.userId ?? "").trim();
    if (!userId) return res.status(400).json({ error: "ugyldig_bruker" });
    const productIds = Array.isArray(b.productIds)
      ? b.productIds.map((p) => String(p)).slice(0, 50)
      : [];
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!(await isLeader(orgId, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      await pool.query(
        `DELETE FROM leadgrid_dorsalg_product_access
          WHERE org_id = $1 AND user_id = $2`,
        [orgId, userId],
      );
      for (const pid of productIds) {
        await pool.query(
          `INSERT INTO leadgrid_dorsalg_product_access (org_id, user_id, product_id)
           SELECT $1, $2, id FROM leadgrid_dorsalg_products
            WHERE id = $3::uuid AND org_id = $1
           ON CONFLICT DO NOTHING`,
          [orgId, userId, pid],
        );
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-dorsalg] access-put feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

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
      productId?: string;
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
      // Produkt (valgfritt): må tilhøre org-en OG callerens tilgang.
      let productId: string | null = null;
      let productNavn: string | null = null;
      if (b.productId) {
        const p = await pool.query(
          `SELECT id, navn FROM leadgrid_dorsalg_products
            WHERE id = $1::uuid AND org_id = $2 AND aktiv = true`,
          [String(b.productId), orgId],
        );
        if (p.rows.length === 0) return res.status(400).json({ error: "ugyldig_produkt" });
        const access = await productAccess(orgId, session.userId);
        if (access && !access.has(String(p.rows[0].id))) {
          return res.status(403).json({ error: "produkt_ikke_tildelt" });
        }
        productId = String(p.rows[0].id);
        productNavn = p.rows[0].navn as string;
      }
      await pool.query(
        `INSERT INTO leadgrid_dorsalg_status
           (org_id, adresse_id, adressetekst, postnummer, poststed,
            lat, lon, status, set_by, product_id, product_navn, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         ON CONFLICT (org_id, adresse_id) DO UPDATE SET
           status = EXCLUDED.status,
           set_by = EXCLUDED.set_by,
           lat = COALESCE(EXCLUDED.lat, leadgrid_dorsalg_status.lat),
           lon = COALESCE(EXCLUDED.lon, leadgrid_dorsalg_status.lon),
           product_id = EXCLUDED.product_id,
           product_navn = EXCLUDED.product_navn,
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
          productId,
          productNavn,
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
          // Produktnavnet følger med i note → kontrolløren velger riktig
          // samtale-mal (malene er per produkt).
          await pool.query(
            `INSERT INTO leadgrid_sales_verifications
               (id, organization_id, customer_id, customer_name,
                seller_user_id, seller_name, note, won_at)
             SELECT gen_random_uuid(), $1, $2, $3, $4,
                    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                             u.username, $4),
                    $5, now()
               FROM (SELECT 1) one
               LEFT JOIN users u ON u.id = $4
             ON CONFLICT (organization_id, customer_id) DO NOTHING`,
            [orgId, kvalitetKundeId, adresseNavn, session.userId,
             productNavn ? `Produkt: ${productNavn}` : ""],
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
           MIN(s.set_by) AS uid,
           COUNT(*) FILTER (WHERE s.status = 'vunnet')::int  AS vunnet,
           COUNT(*) FILTER (WHERE s.status = 'avslatt')::int AS avslatt
         FROM leadgrid_dorsalg_status s
         LEFT JOIN users u ON u.id = s.set_by
        WHERE s.org_id = $1 AND s.set_by IS NOT NULL
        GROUP BY 1
        ORDER BY 3 DESC
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
      // KPI per produkt. Ikke-ledere med produkt-tilgang ser KUN sine
      // produkter (salgssjefen bestemmer — Daniel 2026-07-18).
      const perProduktRaw = await pool.query(
        `SELECT COALESCE(product_navn, 'Uten produkt') AS navn,
                product_id::text AS produkt_id,
                COUNT(*) FILTER (WHERE status = 'vunnet')::int  AS vunnet,
                COUNT(*) FILTER (WHERE status = 'avslatt')::int AS avslatt
           FROM leadgrid_dorsalg_status
          WHERE org_id = $1
          GROUP BY 1, 2
          ORDER BY 3 DESC`,
        [orgId],
      );
      const access = await productAccess(orgId, session.userId);
      const leder = await isLeader(orgId, session.userId);
      const perProdukt = perProduktRaw.rows
        .filter((r) => leder || !access || (r.produkt_id && access.has(String(r.produkt_id))))
        .map((r) => ({
          produktId: r.produkt_id ? String(r.produkt_id) : null,
          navn: r.navn as string,
          vunnet: r.vunnet as number,
          avslatt: r.avslatt as number,
        }));
      // Provisjonsgrunnlag per selger: sum(vunnet × produktets verdi).
      const selgerVerdi = await pool.query(
        `SELECT s.set_by,
                SUM(COALESCE(p.verdi_per_vunnet, 0))::numeric AS verdi
           FROM leadgrid_dorsalg_status s
           LEFT JOIN leadgrid_dorsalg_products p ON p.id = s.product_id
          WHERE s.org_id = $1 AND s.status = 'vunnet' AND s.set_by IS NOT NULL
          GROUP BY s.set_by`,
        [orgId],
      );
      const verdiBySelger = new Map<string, number>(
        selgerVerdi.rows.map((r) => [String(r.set_by), Number(r.verdi ?? 0)]),
      );
      const t = totals.rows[0] ?? {};
      const m = meg.rows[0] ?? {};
      return res.json({
        perProdukt,
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
          verdi: verdiBySelger.get(String(r.uid)) ?? 0,
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
