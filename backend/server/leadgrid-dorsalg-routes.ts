// leadgrid-dorsalg-routes.ts
//
// Dørsalg-modus: husstands-status (vunnet/avslått) per kundeprosjekt.
// Adressene selv hentes live fra Kartverket og lagres ALDRI som leads —
// men utfallet på døra er org-data og persisteres her, keyet på
// Kartverkets adresse-identitet ("adressetekst|postnummer").
//
// Prosjekt-scoping: klienten må velge prosjekt eksplisitt. Backend laster
// prosjektets autoritative organisasjon og verifiserer callerens prosjekt-ACL.

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";
import { assertAnyEntitledForOrganization } from "./leadgrid-entitlement-guard.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import { randomBytes } from "crypto";
import { sendEmail } from "./casting-reminder-sender.js";

const GYLDIGE_STATUSER = new Set(["vunnet", "avslatt", "ikke_hjemme"]);
const LEADER_ROLES = new Set(["owner", "admin", "salgssjef"]);
const DORSALG_FEATURE_KEYS = ["dorsalgModus"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type DorsalgScope = { orgId: string; projectId: string; memberRole: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function registerLeadgridDorsalgRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, pool, requireUserSession } = deps;

  // Bakoverkompatibilitet for eldre TestFlight-klienter som brukte den delte
  // snake_case-encoderen. Ny klient sender camelCase, men begge kontrakter
  // normaliseres før validering slik at en utrulling ikke skaper et write-gap.
  app.use("/api/leadgrid/dorsalg", (req, _res, next) => {
    const normalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(normalize);
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
        normalize(item),
      ]));
    };
    if (req.body && typeof req.body === "object") req.body = normalize(req.body);
    next();
  });

  function candidateStrings(values: unknown[]): string[] {
    return values
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  async function resolveDorsalgScope(
    req: Request,
    res: Response,
    userId: string,
  ): Promise<DorsalgScope | null> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectCandidates = candidateStrings([
      body.projectId, body.project_id,
      req.query.projectId, req.query.project_id,
      req.headers["x-leadgrid-project-id"],
    ]);
    const uniqueProjects = [...new Set(projectCandidates)];
    if (uniqueProjects.length === 0) {
      res.status(400).json({ error: "project_id_required" });
      return null;
    }
    const projectId = uniqueProjects[0];
    if (
      uniqueProjects.length !== 1
      || projectId.length > 255
      || /[\u0000-\u001f\u007f]/.test(projectId)
    ) {
      res.status(uniqueProjects.length > 1 ? 409 : 400).json({
        error: uniqueProjects.length > 1 ? "project_scope_conflict" : "invalid_project_id",
      });
      return null;
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return null;
    }
    const orgCandidates = candidateStrings([
      body.orgId, body.org_id, body.organizationId, body.organization_id,
      req.query.orgId, req.query.org_id,
      req.query.organizationId, req.query.organization_id,
      req.headers["x-leadgrid-organization-id"],
    ]);
    if (orgCandidates.some((value) => value !== project.organizationId)) {
      res.status(409).json({ error: "organization_project_mismatch" });
      return null;
    }
    const entitled = await assertAnyEntitledForOrganization(
      pool,
      project.organizationId,
      DORSALG_FEATURE_KEYS,
      res,
    );
    if (!entitled) return null;
    return {
      orgId: project.organizationId,
      projectId: project.id,
      memberRole: project.memberRole,
    };
  }

  function requireIdempotencyKey(req: Request, res: Response): string | null {
    const raw = req.headers["idempotency-key"];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
    if (value.length < 8 || value.length > 200) {
      res.status(400).json({ error: "idempotency_key_required" });
      return null;
    }
    return value;
  }

  async function isLeader(scope: DorsalgScope, userId: string): Promise<boolean> {
    if (LEADER_ROLES.has(scope.memberRole.toLowerCase())) return true;
    try {
      const { role, permissions } = await resolveEffectivePermissions(pool, scope.orgId, userId);
      return (role != null && LEADER_ROLES.has(role.toLowerCase()))
        || permissions.has("dorsalg.manage");
    } catch {
      return false;
    }
  }

  /// Produkt-idene calleren har tilgang til. null = alle (ingen rader).
  async function productAccess(
    orgId: string,
    projectId: string,
    userId: string,
  ): Promise<Set<string> | null> {
    const r = await pool.query(
      `SELECT product_id FROM leadgrid_dorsalg_product_access
        WHERE org_id = $1 AND project_id = $2 AND user_id = $3`,
      [orgId, projectId, userId],
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
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      const r = await pool.query(
        `SELECT id, navn, farge, aktiv, verdi_per_vunnet,
                bidrag, samtykke_tekst, signering_url
           FROM leadgrid_dorsalg_products
          WHERE org_id = $1 AND project_id = $2
          ORDER BY sort, navn`,
        [orgId, projectId],
      );
      const access = await productAccess(orgId, projectId, session.userId);
      return res.json({
        projectId,
        canManage: await isLeader(scope, session.userId),
        mine: access ? Array.from(access) : [],
        products: r.rows.map((row) => ({
          id: String(row.id),
          navn: row.navn as string,
          farge: row.farge as string,
          aktiv: row.aktiv as boolean,
          verdiPerVunnet: row.verdi_per_vunnet != null ? Number(row.verdi_per_vunnet) : null,
          bidrag: (row.bidrag ?? []) as Array<{ belop: number; label: string }>,
          samtykkeTekst: (row.samtykke_tekst as string) ?? "",
          signeringUrl: (row.signering_url as string | null) ?? null,
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
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      if (!(await isLeader(scope, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      const ins = await pool.query(
        `INSERT INTO leadgrid_dorsalg_products
           (org_id, project_id, navn, farge, verdi_per_vunnet, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (org_id, project_id, idempotency_key)
           WHERE project_id IS NOT NULL AND idempotency_key IS NOT NULL
         DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
           WHERE leadgrid_dorsalg_products.navn = EXCLUDED.navn
             AND leadgrid_dorsalg_products.farge = EXCLUDED.farge
             AND leadgrid_dorsalg_products.verdi_per_vunnet
                 IS NOT DISTINCT FROM EXCLUDED.verdi_per_vunnet
         RETURNING id`,
        [
          orgId, projectId, navn,
          String(b.farge ?? "#A855F7").slice(0, 20),
          Number.isFinite(b.verdiPerVunnet) ? b.verdiPerVunnet : null,
          idempotencyKey,
        ],
      );
      if (ins.rows.length === 0) {
        return res.status(409).json({ error: "idempotency_key_reused" });
      }
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
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "ugyldig_produkt" });
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    const b = (req.body ?? {}) as {
      navn?: string; farge?: string; aktiv?: boolean; verdiPerVunnet?: number | null;
      bidrag?: Array<{ belop?: number; label?: string }>;
      samtykkeTekst?: string; signeringUrl?: string | null; leveranseEpost?: string | null;
    };
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      if (!(await isLeader(scope, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      const updated = await pool.query(
        `UPDATE leadgrid_dorsalg_products SET
           navn = COALESCE(NULLIF($4, ''), navn),
           farge = COALESCE(NULLIF($5, ''), farge),
           aktiv = COALESCE($6, aktiv),
           verdi_per_vunnet = CASE WHEN $7::boolean THEN $8 ELSE verdi_per_vunnet END,
           bidrag = CASE WHEN $9::boolean THEN $10::jsonb ELSE bidrag END,
           samtykke_tekst = CASE WHEN $11::boolean THEN $12 ELSE samtykke_tekst END,
           signering_url = CASE WHEN $13::boolean THEN $14 ELSE signering_url END,
           leveranse_epost = CASE WHEN $15::boolean THEN $16 ELSE leveranse_epost END,
           updated_at = now()
         WHERE id = $1::uuid AND org_id = $2 AND project_id = $3`,
        [
          id, orgId, projectId,
          b.navn != null ? String(b.navn).trim().slice(0, 120) : "",
          b.farge != null ? String(b.farge).slice(0, 20) : "",
          typeof b.aktiv === "boolean" ? b.aktiv : null,
          "verdiPerVunnet" in b,
          Number.isFinite(b.verdiPerVunnet) ? b.verdiPerVunnet : null,
          "bidrag" in b,
          JSON.stringify(Array.isArray(b.bidrag)
            ? b.bidrag
                .filter((x) => Number.isFinite(x?.belop))
                .slice(0, 20)
                .map((x) => ({ belop: Number(x.belop), label: String(x.label ?? "").slice(0, 60) }))
            : []),
          "samtykkeTekst" in b,
          String(b.samtykkeTekst ?? "").slice(0, 4000),
          "signeringUrl" in b,
          b.signeringUrl ? String(b.signeringUrl).slice(0, 500) : null,
          "leveranseEpost" in b,
          b.leveranseEpost ? String(b.leveranseEpost).slice(0, 200) : null,
        ],
      );
      if (updated.rowCount === 0) {
        return res.status(404).json({ error: "product_not_found" });
      }
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
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      if (!(await isLeader(scope, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      const members = await pool.query(
        `WITH project_users AS (
           SELECT member.user_id::text AS user_id,
                  member.role::text AS project_role,
                  1 AS precedence
             FROM leadgrid_project_members member
            WHERE member.organization_id::text = $1
              AND member.project_id = $2
           UNION ALL
           SELECT project.created_by::text, 'owner', 0
             FROM leadgrid_projects project
            WHERE project.organization_id::text = $1
              AND project.id = $2
              AND project.created_by IS NOT NULL
         ),
         unique_users AS (
           SELECT DISTINCT ON (user_id) user_id, project_role
             FROM project_users
            ORDER BY user_id, precedence
         )
         SELECT project_user.user_id,
                COALESCE(project_user.project_role, org_member.role, '') AS role,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                         u.username, project_user.user_id) AS navn
           FROM unique_users project_user
           LEFT JOIN organization_members org_member
             ON org_member.organization_id::text = $1
            AND org_member.user_id::text = project_user.user_id
           LEFT JOIN users u ON u.id = project_user.user_id
          ORDER BY navn`,
        [orgId, projectId],
      );
      const access = await pool.query(
        `SELECT user_id, product_id FROM leadgrid_dorsalg_product_access
          WHERE org_id = $1 AND project_id = $2`,
        [orgId, projectId],
      );
      const byUser = new Map<string, string[]>();
      for (const row of access.rows) {
        const list = byUser.get(String(row.user_id)) ?? [];
        list.push(String(row.product_id));
        byUser.set(String(row.user_id), list);
      }
      return res.json({
        projectId,
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
      ? [...new Set(b.productIds.map((p) => String(p).trim()).filter(Boolean))].slice(0, 50)
      : [];
    if (productIds.some((productId) => !UUID_RE.test(productId))) {
      return res.status(400).json({ error: "ugyldig_produkt" });
    }
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      if (!(await isLeader(scope, session.userId))) {
        return res.status(403).json({ error: "forbidden" });
      }
      const member = await pool.query(
        `SELECT 1 FROM leadgrid_project_members
          WHERE organization_id::text = $1 AND project_id = $2 AND user_id::text = $3
         UNION ALL
         SELECT 1 FROM leadgrid_projects
          WHERE organization_id::text = $1 AND id = $2 AND created_by::text = $3
         LIMIT 1`,
        [orgId, projectId, userId],
      );
      if (member.rowCount === 0) {
        return res.status(400).json({ error: "bruker_ikke_i_prosjekt" });
      }
      if (productIds.length > 0) {
        const products = await pool.query(
          `SELECT id::text FROM leadgrid_dorsalg_products
            WHERE org_id = $1 AND project_id = $2 AND id = ANY($3::uuid[])`,
          [orgId, projectId, productIds],
        );
        if (products.rows.length !== productIds.length) {
          return res.status(400).json({ error: "ugyldig_produkt" });
        }
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `DELETE FROM leadgrid_dorsalg_product_access
            WHERE org_id = $1 AND project_id = $2 AND user_id = $3`,
          [orgId, projectId, userId],
        );
        if (productIds.length > 0) {
          await client.query(
            `INSERT INTO leadgrid_dorsalg_product_access
               (org_id, project_id, user_id, product_id)
             SELECT $1, $2, $3, product.id
               FROM leadgrid_dorsalg_products product
              WHERE product.org_id = $1
                AND product.project_id = $2
                AND product.id = ANY($4::uuid[])
             ON CONFLICT (org_id, project_id, user_id, product_id) DO NOTHING`,
            [orgId, projectId, userId, productIds],
          );
        }
        await client.query("COMMIT");
      } catch (transactionError) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw transactionError;
      } finally {
        client.release();
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-dorsalg] access-put feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // ─── Dagsmål + budsjett (2026-07-19): leder styrer per team/org ──────

  /// Finn team-id-en en selger tilhører (member_user_ids JSONB-array
  /// inneholder uid), eller null. Første treff vinner.
  async function teamForUser(orgId: string, userId: string): Promise<string | null> {
    try {
      const r = await pool.query(
        `SELECT id FROM leadgrid_sales_teams
          WHERE organization_id = $1
            AND (member_user_ids @> to_jsonb($2::text) OR leader_user_id = $2)
          ORDER BY updated_at DESC
          LIMIT 1`,
        [orgId, userId],
      );
      return r.rows[0]?.id ? String(r.rows[0].id) : null;
    } catch {
      return null;
    }
  }

  /// Resolve en selgers dagsmål + budsjett: team-innstilling vinner over
  /// org-default; ingen rader → default 3 salg, ingen kr-budsjett.
  async function resolveMaal(
    orgId: string,
    projectId: string,
    userId: string,
  ): Promise<{ dagsmal: number; budsjett: number | null; kilde: "team" | "org" | "default" }> {
    const teamId = await teamForUser(orgId, userId);
    const rows = await pool.query(
      `SELECT team_id, dagsmal_per_selger, budsjett_per_selger
         FROM leadgrid_dorsalg_maal
        WHERE org_id = $1
          AND project_id = $2
          AND team_id = ANY($3::text[])`,
      [orgId, projectId, [teamId ?? "", ""]],
    );
    const byTeam = new Map<string, { dagsmal: number; budsjett: number | null }>(
      rows.rows.map((r) => [
        String(r.team_id),
        { dagsmal: Number(r.dagsmal_per_selger), budsjett: r.budsjett_per_selger == null ? null : Number(r.budsjett_per_selger) },
      ]),
    );
    if (teamId && byTeam.has(teamId)) {
      const m = byTeam.get(teamId)!;
      return { dagsmal: m.dagsmal, budsjett: m.budsjett, kilde: "team" };
    }
    if (byTeam.has("")) {
      const m = byTeam.get("")!;
      return { dagsmal: m.dagsmal, budsjett: m.budsjett, kilde: "org" };
    }
    return { dagsmal: 3, budsjett: null, kilde: "default" };
  }

  // GET /api/leadgrid/dorsalg/maal — callerens resolverte dagsmål/budsjett
  // + (for ledere) org-default + per-team-innstillinger for redigering.
  app.get("/api/leadgrid/dorsalg/maal", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      const mitt = await resolveMaal(orgId, projectId, session.userId);
      const leder = await isLeader(scope, session.userId);
      if (!leder) {
        return res.json({
          projectId,
          canManage: false,
          mittDagsmal: mitt.dagsmal,
          mittBudsjett: mitt.budsjett,
        });
      }
      // Leder: alle team + deres mål (join så team uten rad viser default).
      const teams = await pool.query(
        `SELECT t.id, t.name,
                m.dagsmal_per_selger, m.budsjett_per_selger
           FROM leadgrid_sales_teams t
           LEFT JOIN leadgrid_dorsalg_maal m
             ON m.org_id = t.organization_id::text
            AND m.project_id = $2
            AND m.team_id = t.id
          WHERE t.organization_id::text = $1
          ORDER BY t.name`,
        [orgId, projectId],
      );
      const orgRow = await pool.query(
        `SELECT dagsmal_per_selger, budsjett_per_selger
           FROM leadgrid_dorsalg_maal
          WHERE org_id = $1 AND project_id = $2 AND team_id = ''`,
        [orgId, projectId],
      );
      const o = orgRow.rows[0];
      return res.json({
        projectId,
        canManage: true,
        mittDagsmal: mitt.dagsmal,
        mittBudsjett: mitt.budsjett,
        orgDefault: {
          dagsmal: o ? Number(o.dagsmal_per_selger) : 3,
          budsjett: o?.budsjett_per_selger == null ? null : Number(o.budsjett_per_selger),
          erSatt: !!o,
        },
        perTeam: teams.rows.map((r) => ({
          teamId: String(r.id),
          navn: r.name as string,
          dagsmal: r.dagsmal_per_selger == null ? null : Number(r.dagsmal_per_selger),
          budsjett: r.budsjett_per_selger == null ? null : Number(r.budsjett_per_selger),
        })),
      });
    } catch (err) {
      console.error("[leadgrid-dorsalg] maal-get feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // PUT /api/leadgrid/dorsalg/maal — leder setter org-default (teamId
  // tom/utelatt) eller et teams mål. Upsert på (org_id, team_id).
  app.put("/api/leadgrid/dorsalg/maal", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      if (!(await isLeader(scope, session.userId))) {
        return res.status(403).json({ error: "ikke_leder" });
      }
      const b = req.body ?? {};
      const teamId = typeof b.teamId === "string" ? b.teamId.trim() : "";
      // team_id må tilhøre org-en (IDOR-vern) — tom = org-default.
      if (teamId) {
        const owns = await pool.query(
          `SELECT 1 FROM leadgrid_sales_teams
            WHERE organization_id::text = $1 AND id = $2`,
          [orgId, teamId],
        );
        if (owns.rowCount === 0) return res.status(400).json({ error: "ukjent_team" });
      }
      const dagsmalRaw = Number(b.dagsmalPerSelger);
      if (!Number.isFinite(dagsmalRaw) || dagsmalRaw < 0 || dagsmalRaw > 100) {
        return res.status(400).json({ error: "ugyldig_dagsmal" });
      }
      const dagsmal = Math.round(dagsmalRaw);
      let budsjett: number | null = null;
      if (b.budsjettPerSelger != null && b.budsjettPerSelger !== "") {
        const v = Number(b.budsjettPerSelger);
        if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: "ugyldig_budsjett" });
        budsjett = Math.round(v);
      }
      await pool.query(
        `INSERT INTO leadgrid_dorsalg_maal
           (org_id, project_id, team_id, dagsmal_per_selger,
            budsjett_per_selger, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (org_id, project_id, team_id) DO UPDATE
           SET dagsmal_per_selger = EXCLUDED.dagsmal_per_selger,
               budsjett_per_selger = EXCLUDED.budsjett_per_selger,
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()`,
        [orgId, projectId, teamId, dagsmal, budsjett, session.userId],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-dorsalg] maal-put feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/leadgrid/dorsalg/status — alle statuser for callerens org.
  app.get("/api/leadgrid/dorsalg/status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      const r = await pool.query(
        `SELECT adresse_id, status, lat, lon, updated_at
           FROM leadgrid_dorsalg_status
          WHERE org_id = $1 AND project_id = $2
          ORDER BY updated_at DESC
          LIMIT 20000`,
        [orgId, projectId],
      );
      return res.json({
        projectId,
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
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      // Produkt (valgfritt): må tilhøre org-en OG callerens tilgang.
      let productId: string | null = null;
      let productNavn: string | null = null;
      if (b.productId) {
        const requestedProductId = String(b.productId).trim();
        if (!UUID_RE.test(requestedProductId)) {
          return res.status(400).json({ error: "ugyldig_produkt" });
        }
        const p = await pool.query(
          `SELECT id, navn FROM leadgrid_dorsalg_products
            WHERE id = $1::uuid
              AND org_id = $2
              AND project_id = $3
              AND aktiv = true`,
          [requestedProductId, orgId, projectId],
        );
        if (p.rows.length === 0) return res.status(400).json({ error: "ugyldig_produkt" });
        const access = await productAccess(orgId, projectId, session.userId);
        if (access && !access.has(String(p.rows[0].id))) {
          return res.status(403).json({ error: "produkt_ikke_tildelt" });
        }
        productId = String(p.rows[0].id);
        productNavn = p.rows[0].navn as string;
      }
      await pool.query(
        `INSERT INTO leadgrid_dorsalg_status
           (org_id, project_id, adresse_id, adressetekst, postnummer, poststed,
            lat, lon, status, set_by, product_id, product_navn, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
         ON CONFLICT (org_id, project_id, adresse_id) DO UPDATE SET
           status = EXCLUDED.status,
           set_by = EXCLUDED.set_by,
           lat = COALESCE(EXCLUDED.lat, leadgrid_dorsalg_status.lat),
           lon = COALESCE(EXCLUDED.lon, leadgrid_dorsalg_status.lon),
           product_id = EXCLUDED.product_id,
           product_navn = EXCLUDED.product_navn,
           updated_at = now()`,
        [
          orgId,
          projectId,
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
               (id, organization_id, project_id, customer_id, customer_name,
                seller_user_id, seller_name, note, won_at)
             SELECT gen_random_uuid(), $1, $2, $3, $4, $5,
                    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                             u.username, $5),
                    $6, now()
               FROM (SELECT 1) one
               LEFT JOIN users u ON u.id = $5
             ON CONFLICT (organization_id, project_id, customer_id)
               WHERE project_id IS NOT NULL
             DO NOTHING`,
            [orgId, projectId, kvalitetKundeId, adresseNavn, session.userId,
             productNavn ? `Produkt: ${productNavn}` : ""],
          );
        } else {
          // Avslått/omgjort: fjern KUN ubehandlede dørsalg-rader — ferdig
          // verifisert historikk røres aldri.
          await pool.query(
            `DELETE FROM leadgrid_sales_verifications
              WHERE organization_id = $1
                AND project_id = $2
                AND customer_id = $3
                AND status = 'pending'`,
            [orgId, projectId, kvalitetKundeId],
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

  // ─── Salg (mig 0400): «Registrer salg» på døra ────────────────────
  // Grandma-prinsippet: ALDRI betalingsdata i appen. Verifisering:
  // uverifisert → kunde_bekreftet (e-postlenke) → telefon_bekreftet
  // (Kvalitet-samtalen) → bankid_signert (oppdragsgivers signering).

  // POST /api/leadgrid/dorsalg/sales — registrer avtalen + grønn pin +
  // Kvalitet-rad m/ EKTE kundedata + velkomst-e-post (best effort).
  app.post("/api/leadgrid/dorsalg/sales", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const b = (req.body ?? {}) as {
      adresseId?: string; adressetekst?: string; postnummer?: string; poststed?: string;
      lat?: number; lon?: number;
      productId?: string; bidragBelop?: number; bidragLabel?: string;
      kundeNavn?: string; kundeTelefon?: string; kundeEpost?: string;
      ringBekreftet?: boolean; samtykkeTekst?: string;
    };
    const adresseId = String(b.adresseId ?? "").trim();
    const kundeNavn = String(b.kundeNavn ?? "").trim();
    if (!adresseId || adresseId.length > 300) {
      return res.status(400).json({ error: "ugyldig_adresse_id" });
    }
    if (!kundeNavn || kundeNavn.length > 200) {
      return res.status(400).json({ error: "ugyldig_kundenavn" });
    }
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      // Produkt: må tilhøre nøyaktig prosjekt + callerens tilgang.
      let productId: string | null = null;
      let productNavn: string | null = null;
      if (b.productId) {
        const requestedProductId = String(b.productId).trim();
        if (!UUID_RE.test(requestedProductId)) {
          return res.status(400).json({ error: "ugyldig_produkt" });
        }
        const pr = await pool.query(
          `SELECT id, navn FROM leadgrid_dorsalg_products
            WHERE id = $1::uuid
              AND org_id = $2
              AND project_id = $3
              AND aktiv = true`,
          [requestedProductId, orgId, projectId],
        );
        if (pr.rows.length === 0) return res.status(400).json({ error: "ugyldig_produkt" });
        const access = await productAccess(orgId, projectId, session.userId);
        if (access && !access.has(String(pr.rows[0].id))) {
          return res.status(403).json({ error: "produkt_ikke_tildelt" });
        }
        productId = String(pr.rows[0].id);
        productNavn = pr.rows[0].navn as string;
      }
      const kundeTelefon = String(b.kundeTelefon ?? "").replace(/[^+\d\s]/g, "").slice(0, 20);
      const kundeEpost = b.kundeEpost
        ? String(b.kundeEpost).trim().toLowerCase().slice(0, 200)
        : null;
      const adressetekst = String(b.adressetekst ?? "").slice(0, 200);
      const postnummer = String(b.postnummer ?? "").slice(0, 10);
      const poststed = String(b.poststed ?? "").slice(0, 100);
      const bidragBelop = Number.isFinite(b.bidragBelop) ? Number(b.bidragBelop) : null;
      const bidragLabel = b.bidragLabel ? String(b.bidragLabel).slice(0, 60) : null;
      const samtykkeTekst = String(b.samtykkeTekst ?? "").slice(0, 4000);
      const ringBekreftet = b.ringBekreftet === true;
      const confirmToken = randomBytes(24).toString("base64url");
      let saleId = "";
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inserted = await client.query(
          `INSERT INTO leadgrid_dorsalg_sales
             (org_id, project_id, adresse_id, adressetekst, postnummer, poststed,
              product_id, product_navn, bidrag_belop, bidrag_label,
              kunde_navn, kunde_telefon, kunde_epost, samtykke_tekst,
              ring_bekreftet_at, confirm_token, seller_user_id, idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (org_id, project_id, idempotency_key)
             WHERE project_id IS NOT NULL AND idempotency_key IS NOT NULL
           DO NOTHING
           RETURNING id`,
          [
            orgId, projectId, adresseId, adressetekst, postnummer, poststed,
            productId, productNavn, bidragBelop, bidragLabel, kundeNavn,
            kundeTelefon, kundeEpost, samtykkeTekst,
            ringBekreftet ? new Date().toISOString() : null,
            confirmToken, session.userId, idempotencyKey,
          ],
        );
        if (inserted.rows.length === 0) {
          const replay = await client.query(
            `SELECT id FROM leadgrid_dorsalg_sales
              WHERE org_id = $1 AND project_id = $2 AND idempotency_key = $3
                AND adresse_id = $4 AND adressetekst = $5
                AND postnummer = $6 AND poststed = $7
                AND product_id IS NOT DISTINCT FROM $8::uuid
                AND product_navn IS NOT DISTINCT FROM $9::text
                AND bidrag_belop IS NOT DISTINCT FROM $10::numeric
                AND bidrag_label IS NOT DISTINCT FROM $11::text
                AND kunde_navn = $12 AND kunde_telefon = $13
                AND kunde_epost IS NOT DISTINCT FROM $14::text
                AND samtykke_tekst = $15
                AND (ring_bekreftet_at IS NOT NULL) = $16::boolean
              LIMIT 1`,
            [
              orgId, projectId, idempotencyKey, adresseId, adressetekst,
              postnummer, poststed, productId, productNavn, bidragBelop,
              bidragLabel, kundeNavn, kundeTelefon, kundeEpost,
              samtykkeTekst, ringBekreftet,
            ],
          );
          const replayId = replay.rows[0]?.id;
          if (!replayId) {
            throw Object.assign(new Error("idempotency_key_reused"), { statusCode: 409 });
          }
          await client.query("COMMIT");
          return res.json({ ok: true, id: String(replayId) });
        }
        saleId = String(inserted.rows[0].id);
        await client.query(
          `INSERT INTO leadgrid_dorsalg_status
             (org_id, project_id, adresse_id, adressetekst, postnummer, poststed,
              lat, lon, status, set_by, product_id, product_navn, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'vunnet',$9,$10::uuid,$11,now())
           ON CONFLICT (org_id, project_id, adresse_id) DO UPDATE SET
             status = 'vunnet', set_by = EXCLUDED.set_by,
             lat = COALESCE(EXCLUDED.lat, leadgrid_dorsalg_status.lat),
             lon = COALESCE(EXCLUDED.lon, leadgrid_dorsalg_status.lon),
             product_id = EXCLUDED.product_id,
             product_navn = EXCLUDED.product_navn,
             updated_at = now()`,
          [
            orgId, projectId, adresseId, adressetekst, postnummer, poststed,
            Number.isFinite(b.lat) ? b.lat : null,
            Number.isFinite(b.lon) ? b.lon : null,
            session.userId, productId, productNavn,
          ],
        );
        await client.query("COMMIT");
      } catch (transactionError) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw transactionError;
      } finally {
        client.release();
      }
      // Kvalitet-rad m/ EKTE kundedata (navn + telefon å ringe).
      try {
        await pool.query(
          `INSERT INTO leadgrid_sales_verifications
             (id, organization_id, project_id, customer_id, customer_name, customer_phone,
              seller_user_id, seller_name, deal_amount, deal_currency, note, won_at)
           SELECT gen_random_uuid(), $1, $2, $3, $4, $5, $6,
                  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                           u.username, $6),
                  $7, 'kr', $8, now()
             FROM (SELECT 1) one
             LEFT JOIN users u ON u.id = $6
           ON CONFLICT (organization_id, project_id, customer_id)
             WHERE project_id IS NOT NULL
           DO UPDATE SET
             customer_name = EXCLUDED.customer_name,
             customer_phone = EXCLUDED.customer_phone,
             deal_amount = EXCLUDED.deal_amount,
             note = EXCLUDED.note,
             updated_at = now()`,
          [
            orgId, projectId, `dorsalg:${adresseId}`, kundeNavn,
            kundeTelefon || null, session.userId, bidragBelop,
            [productNavn ? `Produkt: ${productNavn}` : "",
             `Adresse: ${adressetekst}, ${postnummer} ${poststed}`,
             `Salg-id: ${saleId}`].filter(Boolean).join("\n"),
          ],
        );
      } catch (e) {
        console.warn("[leadgrid-dorsalg] kvalitet-rad hoppet over:", (e as Error).message);
      }
      // Velkomst-e-post m/ bekreftelseslenke — best effort, grandma-vennlig
      // (stor knapp, rolig språk, ingen betalingsdata).
      if (kundeEpost) {
        const base = process.env.PUBLIC_API_BASE_URL
          || "https://creatorhub-backend-rtbl.onrender.com";
        const confirmUrl = `${base}/api/leadgrid/dorsalg/confirm/${confirmToken}`;
        const bidrag = bidragBelop != null
          ? `${bidragBelop} kr/mnd${bidragLabel ? ` (${bidragLabel})` : ""}` : "";
        const safeFirstName = escapeHtml(kundeNavn.split(" ")[0] ?? "");
        const safeProductName = escapeHtml(productNavn ?? "organisasjonen");
        const safeBidrag = escapeHtml(bidrag);
        sendEmail({
          to: kundeEpost,
          fromName: productNavn ? `${productNavn} via Leadgrid` : "Leadgrid",
          subject: productNavn ? `Velkommen — din avtale med ${productNavn}` : "Velkommen — din avtale",
          html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;font-size:17px;line-height:1.6">
            <h2 style="color:#5b21b6">Takk, ${safeFirstName}!</h2>
            <p>Du har i dag sagt ja til å støtte <b>${safeProductName}</b>${safeBidrag ? ` med <b>${safeBidrag}</b>` : ""}.</p>
            <p><b>Viktig å vite:</b> Ingen betaling er gjort på døra, og du oppgir aldri kontonummer til selgeren. Betalingsavtalen setter du opp direkte med organisasjonen. Du har 14 dagers angrerett, og du blir ringt av oss for en velkomstsamtale.</p>
            <p style="margin:28px 0"><a href="${confirmUrl}" style="background:#7c3aed;color:#fff;padding:16px 28px;border-radius:10px;text-decoration:none;font-size:18px;font-weight:bold">Bekreft avtalen</a></p>
            <p style="color:#666;font-size:14px">Var ikke dette deg? Se bort fra denne e-posten — da skjer ingenting.</p>
          </div>`,
          text: `Takk! Du har sagt ja til å støtte ${productNavn ?? "organisasjonen"}${bidrag ? ` med ${bidrag}` : ""}. Ingen betaling er gjort på døra. Bekreft avtalen: ${confirmUrl}`,
        }).catch((e: Error) => console.warn("[leadgrid-dorsalg] velkomst-epost feilet:", e.message));
      }
      return res.json({ ok: true, id: saleId });
    } catch (err) {
      console.error("[leadgrid-dorsalg] salg feilet:", (err as Error).message);
      if ((err as { statusCode?: number }).statusCode === 409) {
        return res.status(409).json({ error: "idempotency_key_reused" });
      }
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/leadgrid/dorsalg/confirm/:token — OFFENTLIG kunde-bekreftelse
  // (lenken i velkomst-e-posten). Vennlig HTML, ingen sesjon.
  app.get("/api/leadgrid/dorsalg/confirm/:token", async (req, res) => {
    const token = String(req.params.token ?? "").trim();
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
      return res.status(400).send("Ugyldig lenke.");
    }
    try {
      const confirmed = await pool.query(
        `WITH target AS (
           SELECT id, org_id, project_id
             FROM leadgrid_dorsalg_sales
            WHERE confirm_token = $1
            ORDER BY id
            LIMIT 1
            FOR UPDATE
         )
         UPDATE leadgrid_dorsalg_sales sale SET
           verifisering = CASE
             WHEN sale.verifisering = 'uverifisert' THEN 'kunde_bekreftet'
             ELSE sale.verifisering
           END,
           kunde_bekreftet_at = COALESCE(sale.kunde_bekreftet_at, now()),
           updated_at = now()
          FROM target
         WHERE sale.id = target.id
           AND sale.org_id = target.org_id
           AND sale.project_id IS NOT DISTINCT FROM target.project_id
         RETURNING sale.id`,
        [token],
      );
      if (confirmed.rows.length === 0) {
        return res.status(404).send("<html><body style=\"font-family:sans-serif;text-align:center;padding:60px 20px\"><h2>Fant ikke avtalen</h2><p>Lenken kan være utløpt.</p></body></html>");
      }
      return res.send('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px;font-size:19px;line-height:1.6"><div style="font-size:56px">💜</div><h2 style="color:#5b21b6">Avtalen er bekreftet</h2><p>Takk. Bekreftelsen er registrert. Du kan lukke denne siden.</p></body></html>');
    } catch (err) {
      console.error("[leadgrid-dorsalg] confirm feilet:", (err as Error).message);
      return res.status(500).send("Noe gikk galt — prøv lenken igjen senere.");
    }
  });

  // GET /api/leadgrid/dorsalg/sales — org-ens registrerte salg.
  app.get("/api/leadgrid/dorsalg/sales", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      const canViewAllSales = await isLeader(scope, session.userId);
      const r = await pool.query(
        `SELECT id, adresse_id, adressetekst, postnummer, poststed,
                product_navn, bidrag_belop, bidrag_label, kunde_navn,
                verifisering, created_at
           FROM leadgrid_dorsalg_sales
          WHERE org_id = $1
            AND project_id = $2
            AND ($3::boolean OR seller_user_id = $4)
          ORDER BY created_at DESC
          LIMIT 500`,
        [orgId, projectId, canViewAllSales, session.userId],
      );
      return res.json({
        projectId,
        sales: r.rows.map((row) => ({
          id: String(row.id),
          adresseId: row.adresse_id as string,
          adressetekst: row.adressetekst as string,
          postnummer: row.postnummer as string,
          poststed: row.poststed as string,
          productNavn: (row.product_navn as string | null) ?? null,
          bidragBelop: row.bidrag_belop != null ? Number(row.bidrag_belop) : null,
          bidragLabel: (row.bidrag_label as string | null) ?? null,
          kundeNavn: row.kunde_navn as string,
          verifisering: row.verifisering as string,
          createdAt: (row.created_at as Date).toISOString().replace(/\.\d{3}Z$/, "Z"),
        })),
      });
    } catch (err) {
      console.error("[leadgrid-dorsalg] sales-list feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/leadgrid/dorsalg/stats — dørsalg-oversikt for org-en:
  // totaler, i dag, denne uka, per selger + siste vunnede dører.
  app.get("/api/leadgrid/dorsalg/stats", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      const totals = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'vunnet')::int  AS vunnet,
           COUNT(*) FILTER (WHERE status = 'avslatt')::int AS avslatt,
           COUNT(*) FILTER (WHERE status = 'ikke_hjemme')::int AS ikke_hjemme,
           COUNT(*) FILTER (WHERE updated_at >= date_trunc('day', now()))::int AS i_dag,
           COUNT(*) FILTER (WHERE status = 'vunnet'
                              AND updated_at >= date_trunc('day', now()))::int AS vunnet_i_dag,
           COUNT(*) FILTER (WHERE updated_at >= date_trunc('week', now()))::int AS denne_uka
         FROM leadgrid_dorsalg_status
        WHERE org_id = $1 AND project_id = $2`,
        [orgId, projectId],
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
        WHERE s.org_id = $1 AND s.project_id = $2 AND s.set_by IS NOT NULL
        GROUP BY 1
        ORDER BY 3 DESC
        LIMIT 20`,
        [orgId, projectId],
      );
      const sisteVunnet = await pool.query(
        `SELECT adressetekst, postnummer, poststed, updated_at
           FROM leadgrid_dorsalg_status
          WHERE org_id = $1 AND project_id = $2 AND status = 'vunnet'
          ORDER BY updated_at DESC
          LIMIT 8`,
        [orgId, projectId],
      );
      // Callerens egne tall — driver «Min profil»-KPI-ene for dørsalg.
      const meg = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'vunnet')::int  AS vunnet,
           COUNT(*) FILTER (WHERE status = 'avslatt')::int AS avslatt,
           COUNT(*) FILTER (WHERE updated_at >= date_trunc('day', now()))::int AS i_dag,
           COUNT(*) FILTER (WHERE updated_at >= date_trunc('week', now()))::int AS denne_uka
         FROM leadgrid_dorsalg_status
        WHERE org_id = $1 AND project_id = $2 AND set_by = $3`,
        [orgId, projectId, session.userId],
      );
      // KPI per produkt. Ikke-ledere med produkt-tilgang ser KUN sine
      // produkter (salgssjefen bestemmer — Daniel 2026-07-18).
      const perProduktRaw = await pool.query(
        `SELECT COALESCE(product_navn, 'Uten produkt') AS navn,
                product_id::text AS produkt_id,
                COUNT(*) FILTER (WHERE status = 'vunnet')::int  AS vunnet,
                COUNT(*) FILTER (WHERE status = 'avslatt')::int AS avslatt
           FROM leadgrid_dorsalg_status
          WHERE org_id = $1 AND project_id = $2
          GROUP BY 1, 2
          ORDER BY 3 DESC`,
        [orgId, projectId],
      );
      const access = await productAccess(orgId, projectId, session.userId);
      const leder = await isLeader(scope, session.userId);
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
           LEFT JOIN leadgrid_dorsalg_products p
             ON p.id = s.product_id
            AND p.org_id = s.org_id
            AND p.project_id = s.project_id
          WHERE s.org_id = $1
            AND s.project_id = $2
            AND s.status = 'vunnet'
            AND s.set_by IS NOT NULL
          GROUP BY s.set_by`,
        [orgId, projectId],
      );
      const verdiBySelger = new Map<string, number>(
        selgerVerdi.rows.map((r) => [String(r.set_by), Number(r.verdi ?? 0)]),
      );
      // Callerens resolverte dagsmål/budsjett (team-først) — driver
      // milepæl-feiringen på kartet og progresjonen i «Min profil».
      const mittMaal = await resolveMaal(orgId, projectId, session.userId);
      const t = totals.rows[0] ?? {};
      const m = meg.rows[0] ?? {};
      return res.json({
        projectId,
        perProdukt,
        vunnet: t.vunnet ?? 0,
        avslatt: t.avslatt ?? 0,
        ikkeHjemme: t.ikke_hjemme ?? 0,
        iDag: t.i_dag ?? 0,
        vunnetIDag: t.vunnet_i_dag ?? 0,
        denneUka: t.denne_uka ?? 0,
        dagsmal: mittMaal.dagsmal,
        budsjett: mittMaal.budsjett,
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
    const idempotencyKey = requireIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    try {
      const scope = await resolveDorsalgScope(req, res, session.userId);
      if (!scope) return;
      const { orgId, projectId } = scope;
      // Angret vunnet: fjern KUN ubehandlet dørsalg-rad fra Kvalitet-køen
      // (verifisert historikk røres aldri). Best effort — tabellen kan
      // mangle hvis Kvalitet aldri er åpnet.
      try {
        await pool.query(
          `DELETE FROM leadgrid_sales_verifications
            WHERE organization_id = $1
              AND project_id = $2
              AND customer_id = $3
              AND status = 'pending'`,
          [orgId, projectId, `dorsalg:${adresseId}`],
        );
      } catch (e) {
        console.warn("[leadgrid-dorsalg] kvalitet-opprydding hoppet over:", (e as Error).message);
      }
      await pool.query(
        `DELETE FROM leadgrid_dorsalg_status
          WHERE org_id = $1 AND project_id = $2 AND adresse_id = $3`,
        [orgId, projectId, adresseId],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-dorsalg] delete feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });
}
