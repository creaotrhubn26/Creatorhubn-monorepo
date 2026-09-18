/**
 * pondus-routes.ts
 *
 * Leadgrid Pondus — mal-katalog for salgs-scripts («pondus»).
 *
 * Prefix: /api/leadgrid/pondus/*
 *
 * Auth-modell:
 *   • Innlogging kreves overalt (401 hvis ikke).
 *   • SuperAdmin (users.role IN ('admin','super_admin')) kan opprette,
 *     redigere, publisere, rulle tilbake og slette maler. 403 ellers.
 *   • Alle innloggede kan lese publiserte Leadgrid-globale maler + evt.
 *     org-lokale publiserte maler for sin egen org.
 *
 * Endepunkter (12):
 *   GET    /templates?category=&kind=&published=all
 *   GET    /templates/:id
 *   POST   /templates
 *   PATCH  /templates/:id
 *   POST   /templates/:id/publish
 *   DELETE /templates/:id
 *   GET    /templates/:id/versions
 *   POST   /templates/:id/rollback/:version
 *   GET    /content-by-step?template_id=&step_key=
 *   POST   /content-by-step
 *   POST   /objections/bulk-attach — legg samme innvending til alle
 *          maler i én kategori (samme org-scoping som POST /templates)
 *   GET    /templates/:id/usage-detail — per-mal drill-down (utfalls-
 *          fordeling, per-selger, siste 20 logger)
 *
 * Forutsetter mig 0355 (parallell migrasjon):
 *   - pondus_templates
 *   - pondus_template_versions
 *   - pondus_content_by_step
 *
 * REGISTRERES IKKE her — wire opp i backend/server/index.ts ved siden av
 * `registerSalesLeadershipRoutes({...})`.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { assertAnyEntitled, LEADBOOK_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import { registerPondusTemplateRoutesV2 } from "./pondus-template-routes-v2.js";
import { registerPondusUsageRoutesV2 } from "./pondus-usage-routes-v2.js";

// Speil den globale SessionUser-typen i backend/server/index.ts. Denne
// modulen bruker kun feltene som eksisterer i alle callsteder. isPlatformAdmin
// er ikke på selve session-objektet — vi utleder det via ADMIN_ROLES-set-en
// under, som matcher ADMIN_SESSION_ROLES i index.ts.
type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface PondusRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

// Matcher ADMIN_SESSION_ROLES i backend/server/index.ts.
const ADMIN_ROLES = new Set(["admin", "super_admin"]);

const VALID_KINDS = new Set(["telephone", "video", "email", "meeting", "field"]);

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────


function readString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function isPlatformAdmin(session: SessionUser): boolean {
  return ADMIN_ROLES.has(session.role);
}

// Org-scopede maler (2026-08-02): salgssjef/teamleder/admin i en org kan
// opprette og vedlikeholde ORG-EGNE maler (org_id = deres org) — «lagre
// for teamet» fra iPad-mal-editoren. Leadgrid-GLOBALE maler (org_id NULL)
// er fortsatt SuperAdmin-only.
const ORG_TEMPLATE_ROLES = new Set(["admin", "salgssjef", "teamleder"]);

async function canManageOrgTemplates(
  pool: Pool, orgId: string, userId: string,
): Promise<boolean> {
  try {
    const r = await pool.query<{ role: string }>(
      `SELECT role FROM organization_members
        WHERE organization_id = $1::uuid AND user_id = $2 LIMIT 1`,
      [orgId, userId],
    );
    return ORG_TEMPLATE_ROLES.has(r.rows[0]?.role ?? "");
  } catch {
    return false;
  }
}

function coerceScore(v: unknown, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.trunc(n)));
}

function coerceJsonArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Sørger for at analysis-JSON alltid har alle 5 akser (0-100) selv om
 * kolonnen mangler (pre-0356 DB) eller inneholder delvis data. Ukjente
 * nøkler ignoreres for framtidig utvidbarhet.
 */
function normalizeAnalysis(raw: unknown, fallbackScore: number): Record<string, number> {
  const src = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) ?? {};
  const pick = (key: string): number => {
    const v = Number(src[key]);
    if (Number.isFinite(v)) return Math.max(0, Math.min(100, Math.trunc(v)));
    return fallbackScore;
  };
  return {
    authority: pick("authority"),
    clarity: pick("clarity"),
    trust: pick("trust"),
    safety: pick("safety"),
    momentum: pick("momentum"),
  };
}

function mapTemplateRow(row: Record<string, unknown>): Record<string, unknown> {
  const score = Number(row.score ?? 0);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    kind: row.kind,
    score,
    steps: row.steps ?? [],
    objections: row.objections ?? [],
    // Per-akse pondus-analyse (mig 0356). Bakover-kompatibel: hvis
    // analysis-kolonnen ikke finnes i DB enda, faller vi til overall score.
    analysis: normalizeAnalysis(row.analysis, score),
    created_by: row.created_by,
    org_id: row.org_id,
    is_published: Boolean(row.is_published),
    published_at: row.published_at,
    published_by: row.published_by,
    version: Number(row.version ?? 1),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  // Snapshot lagres i pondus_template_versions.snapshot — hele malen
  // som den så ut FØR endringen (rollback-safe).
  return {
    name: row.name,
    description: row.description,
    category: row.category,
    kind: row.kind,
    score: row.score,
    steps: row.steps,
    objections: row.objections,
    version: row.version,
    is_published: row.is_published,
  };
}

// ─────────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────────
export function registerPondusRoutes(deps: PondusRoutesDeps): void {
  registerPondusTemplateRoutesV2(deps);
  return;
  const { app, pool, requireUserSession } = deps;

  // ───────────────────────────────────────────────────────────────
  // LIST templates
  // ───────────────────────────────────────────────────────────────
  // Filter-flags:
  //   ?category=<...>         valgfritt
  //   ?kind=<...>             valgfritt
  //   ?published=all          kun SuperAdmin — viser utkast også
  //                           (ellers filtreres til is_published=true)
  //
  // Synlighet:
  //   • SuperAdmin: alle rader (evt. filtrert m/ published=only=default
  //     eller published=all)
  //   • Vanlige brukere: Leadgrid-globale (org_id IS NULL) publiserte
  //     PLUSS egen org-lokale publiserte
  app.get("/api/leadgrid/pondus/templates", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const admin = isPlatformAdmin(session);
    // Server-side håndhevelse (QA 2026-07-06): sperret Pondus-tilgang
    // blokkeres her, ikke bare i UI. Admin bypasser; fail-open ved 0 rader.
    if (!admin && !(await assertAnyEntitled(pool, session.userId, LEADBOOK_FEATURE_KEYS, res))) return;
    const category = readString(req.query.category).trim();
    const kind = readString(req.query.kind).trim();
    const publishedParam = readString(req.query.published).toLowerCase();
    const showAllStates = admin && publishedParam === "all";

    const clauses: string[] = [];
    const vals: unknown[] = [];
    const push = (clause: string, val: unknown) => {
      vals.push(val);
      clauses.push(clause.replace(/\$\?/g, `$${vals.length}`));
    };

    if (!showAllStates) {
      clauses.push("is_published = TRUE");
    }

    if (admin) {
      // SuperAdmin ser alt — ingen org-filter (kan revideres til org-scope
      // via query-param senere hvis ønsket).
    } else {
      // Vanlig bruker: Leadgrid-globale + egen org
      push("(org_id IS NULL OR org_id = $?::uuid)", orgId);
    }

    if (category) push("category = $?", category);
    if (kind) push("kind = $?", kind);

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    try {
      const r = await pool.query(
        `SELECT id, name, description, category, kind, score, steps, objections, analysis,
                created_by, org_id, is_published, published_at, published_by,
                version, created_at, updated_at
           FROM pondus_templates
           ${where}
          ORDER BY is_published DESC, score DESC, created_at DESC`,
        vals,
      );
      return res.json({
        templates: r.rows.map((row) => mapTemplateRow(row as Record<string, unknown>)),
      });
    } catch (err) {
      console.error("[pondus] templates GET failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_templates_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // GET single template
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/pondus/templates/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const admin = isPlatformAdmin(session);
    if (!admin && !(await assertAnyEntitled(pool, session.userId, LEADBOOK_FEATURE_KEYS, res))) return;
    const id = readString(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: "invalid_id" });

    try {
      const r = await pool.query(
        `SELECT id, name, description, category, kind, score, steps, objections, analysis,
                created_by, org_id, is_published, published_at, published_by,
                version, created_at, updated_at
           FROM pondus_templates
          WHERE id = $1
          LIMIT 1`,
        [id],
      );
      if (!r.rows.length) return res.status(404).json({ error: "not_found" });
      const row = r.rows[0] as Record<string, unknown>;
      // Synlighet — vanlig bruker kan bare se publiserte + Leadgrid/egen org
      if (!admin) {
        const isVisible =
          Boolean(row.is_published) &&
          (row.org_id === null || String(row.org_id) === orgId);
        if (!isVisible) return res.status(404).json({ error: "not_found" });
      }
      return res.json({ template: mapTemplateRow(row) });
    } catch (err) {
      console.error("[pondus] template GET failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_template_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST create template — SuperAdmin only
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/pondus/templates", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const admin = isPlatformAdmin(session);
    // Org-leder (2026-08-02): kan opprette ORG-EGEN mal — org_id tvinges
    // fra sesjonens org (aldri fra body), og malen publiseres direkte
    // (deling med teamet er hele poenget).
    let forcedOrgId: string | null = null;
    if (!admin) {
      const userOrgId = await resolveOrgIdForUser(pool, session.userId);
      if (!userOrgId || !(await canManageOrgTemplates(pool, userOrgId, session.userId))) {
        return res.status(403).json({ error: "forbidden_superadmin_only" });
      }
      forcedOrgId = userOrgId;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = readString(body.name).trim();
    if (!name) return res.status(400).json({ error: "missing_name" });
    const description = readString(body.description) || null;
    const category = readString(body.category).trim() || "custom";
    const kind = readString(body.kind).trim() || "telephone";
    if (!VALID_KINDS.has(kind)) {
      return res.status(400).json({ error: "invalid_kind", detail: kind });
    }
    const score = coerceScore(body.score, 0);
    const steps = coerceJsonArray(body.steps);
    const objections = coerceJsonArray(body.objections);
    // Per-akse analyse (mig 0356). Godtar delvis payload — normalizeAnalysis
    // klemmer manglende akser til overall score som fallback.
    const analysis = normalizeAnalysis(body.analysis, score);
    // org_id: SuperAdmin kan sette null (Leadgrid-global) eller gyldig UUID;
    // org-leder tvinges til egen org (body ignoreres).
    let orgIdParam: string | null = forcedOrgId;
    if (admin && body.org_id !== undefined && body.org_id !== null) {
      const raw = String(body.org_id);
      if (!isUuid(raw)) {
        return res.status(400).json({ error: "invalid_org_id" });
      }
      orgIdParam = raw;
    }
    // Org-leder-maler publiseres direkte (deling er poenget);
    // SuperAdmin beholder utkast-flyten (publish-steget).
    const publishNow = !admin;

    try {
      const r = await pool.query(
        `INSERT INTO pondus_templates
           (name, description, category, kind, score, steps, objections, analysis,
            created_by, org_id, is_published, published_at, published_by, version)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10::uuid,
                 $11::boolean,
                 CASE WHEN $11::boolean THEN NOW() ELSE NULL END,
                 CASE WHEN $11::boolean THEN $9 ELSE NULL END,
                 1)
         RETURNING id, name, description, category, kind, score, steps, objections, analysis,
                   created_by, org_id, is_published, published_at, published_by,
                   version, created_at, updated_at`,
        [
          name,
          description,
          category,
          kind,
          score,
          JSON.stringify(steps),
          JSON.stringify(objections),
          JSON.stringify(analysis),
          session.userId,
          orgIdParam,
          publishNow,
        ],
      );
      const row = r.rows[0] as Record<string, unknown>;
      return res.status(201).json({ template: mapTemplateRow(row) });
    } catch (err) {
      console.error("[pondus] template POST failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_template_create_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST bulk-attach objection — legg samme innvending til alle maler
  // i én kategori. Samme tilgangsmodell som create-template (org-leder
  // scopet til egen org, SuperAdmin til Leadgrid-globale). Ingen
  // versjons-bump/snapshot her (lavere ceremoni enn full mal-redigering
  // — se buildSnapshot for det tyngre sporet).
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/pondus/objections/bulk-attach", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const admin = isPlatformAdmin(session);
    let scopeOrgId: string | null = null;
    if (!admin) {
      const userOrgId = await resolveOrgIdForUser(pool, session.userId);
      if (!userOrgId || !(await canManageOrgTemplates(pool, userOrgId, session.userId))) {
        return res.status(403).json({ error: "forbidden_superadmin_only" });
      }
      scopeOrgId = userOrgId;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const category = readString(body.category).trim();
    if (!category) return res.status(400).json({ error: "missing_category" });
    const prompt = readString(body.prompt).trim();
    if (!prompt) return res.status(400).json({ error: "missing_prompt" });
    const response = readString(body.response).trim();
    if (!response) return res.status(400).json({ error: "missing_response" });

    const objection = { id: crypto.randomUUID(), prompt, response };

    try {
      // scopeOrgId null (SuperAdmin) => Leadgrid-globale maler (org_id IS NULL).
      // scopeOrgId satt (org-leder) => kun egen org sine maler.
      const r = await pool.query(
        `UPDATE pondus_templates
            SET objections = objections || $1::jsonb,
                updated_at = NOW()
          WHERE category = $2
            AND org_id IS NOT DISTINCT FROM $3::uuid
         RETURNING id, name, description, category, kind, score, steps, objections, analysis,
                   created_by, org_id, is_published, published_at, published_by,
                   version, created_at, updated_at`,
        [JSON.stringify([objection]), category, scopeOrgId],
      );
      const templates = r.rows.map((row) => mapTemplateRow(row as Record<string, unknown>));
      return res.json({ updated: templates.length, templates });
    } catch (err) {
      console.error("[pondus] objections bulk-attach failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_objection_bulk_attach_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // PATCH template — SuperAdmin only, bumper version + audit snapshot
  // ───────────────────────────────────────────────────────────────
  app.patch("/api/leadgrid/pondus/templates/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const admin = isPlatformAdmin(session);
    const id = readString(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: "invalid_id" });
    const body = (req.body ?? {}) as Record<string, unknown>;

    try {
      // Snapshot først (FØR endringen)
      const existing = await pool.query(
        `SELECT id, name, description, category, kind, score, steps, objections,
                is_published, version, org_id
           FROM pondus_templates
          WHERE id = $1
          LIMIT 1`,
        [id],
      );
      if (!existing.rows.length) return res.status(404).json({ error: "not_found" });
      const currentRow = existing.rows[0] as Record<string, unknown>;

      // Autorisasjon (2026-08-02): SuperAdmin ELLER org-leder på org-egen
      // mal. Globale maler (org_id NULL) er fortsatt SuperAdmin-only.
      if (!admin) {
        const templateOrg = currentRow.org_id == null ? null : String(currentRow.org_id);
        const userOrgId = await resolveOrgIdForUser(pool, session.userId);
        const allowed = templateOrg != null && userOrgId != null
          && templateOrg === userOrgId
          && (await canManageOrgTemplates(pool, userOrgId, session.userId));
        if (!allowed) {
          return res.status(403).json({ error: "forbidden_superadmin_only" });
        }
      }

      // Audit-snapshot: forrige versjon slik den lå
      await pool.query(
        `INSERT INTO pondus_template_versions (template_id, version, snapshot, changed_by)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (template_id, version) DO NOTHING`,
        [id, Number(currentRow.version ?? 1), JSON.stringify(buildSnapshot(currentRow)), session.userId],
      );

      // Bygg UPDATE
      const sets: string[] = [];
      const vals: unknown[] = [];
      const push = (col: string, val: unknown, cast = "") => {
        vals.push(val);
        sets.push(`${col} = $${vals.length}${cast}`);
      };
      if (typeof body.name === "string") push("name", body.name.trim());
      if (body.description !== undefined) {
        push("description", body.description === null ? null : String(body.description));
      }
      if (typeof body.category === "string") push("category", body.category.trim());
      if (typeof body.kind === "string") {
        if (!VALID_KINDS.has(body.kind)) {
          return res.status(400).json({ error: "invalid_kind", detail: body.kind });
        }
        push("kind", body.kind);
      }
      if (body.score !== undefined) push("score", coerceScore(body.score));
      if (body.steps !== undefined) push("steps", JSON.stringify(coerceJsonArray(body.steps)), "::jsonb");
      if (body.objections !== undefined) {
        push("objections", JSON.stringify(coerceJsonArray(body.objections)), "::jsonb");
      }
      // Per-akse analyse (mig 0356). Godtar delvis payload — normalizeAnalysis
      // klemmer manglende akser til overall score som fallback.
      if (body.analysis !== undefined) {
        const scoreForFallback = coerceScore(body.score, coerceScore(currentRow.score));
        const norm = normalizeAnalysis(body.analysis, scoreForFallback);
        push("analysis", JSON.stringify(norm), "::jsonb");
      }

      if (sets.length === 0) return res.status(400).json({ error: "no_fields_to_update" });

      // Alltid bump version + oppdater updated_at
      const nextVersion = Number(currentRow.version ?? 1) + 1;
      vals.push(nextVersion);
      sets.push(`version = $${vals.length}`);
      sets.push(`updated_at = NOW()`);

      vals.push(id);
      const r = await pool.query(
        `UPDATE pondus_templates SET ${sets.join(", ")}
          WHERE id = $${vals.length}
          RETURNING id, name, description, category, kind, score, steps, objections, analysis,
                    created_by, org_id, is_published, published_at, published_by,
                    version, created_at, updated_at`,
        vals,
      );
      const row = r.rows[0] as Record<string, unknown>;
      return res.json({ template: mapTemplateRow(row) });
    } catch (err) {
      console.error("[pondus] template PATCH failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_template_update_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST publish/unpublish — SuperAdmin only
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/pondus/templates/:id/publish", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const admin = isPlatformAdmin(session);
    const id = readString(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: "invalid_id" });
    const body = (req.body ?? {}) as { published?: boolean };
    const shouldPublish = body.published !== false;

    try {
      // Org-leder kan (av)publisere org-egen mal (2026-08-02).
      if (!admin) {
        const own = await pool.query<{ org_id: string | null }>(
          `SELECT org_id FROM pondus_templates WHERE id = $1 LIMIT 1`, [id]);
        if (!own.rows.length) return res.status(404).json({ error: "not_found" });
        const templateOrg = own.rows[0].org_id == null ? null : String(own.rows[0].org_id);
        const userOrgId = await resolveOrgIdForUser(pool, session.userId);
        const allowed = templateOrg != null && userOrgId != null
          && templateOrg === userOrgId
          && (await canManageOrgTemplates(pool, userOrgId, session.userId));
        if (!allowed) {
          return res.status(403).json({ error: "forbidden_superadmin_only" });
        }
      }
      const r = await pool.query(
        shouldPublish
          ? `UPDATE pondus_templates
                SET is_published = TRUE,
                    published_at = NOW(),
                    published_by = $2,
                    updated_at = NOW()
              WHERE id = $1
              RETURNING id, name, description, category, kind, score, steps, objections, analysis,
                        created_by, org_id, is_published, published_at, published_by,
                        version, created_at, updated_at`
          : `UPDATE pondus_templates
                SET is_published = FALSE,
                    updated_at = NOW()
              WHERE id = $1
              RETURNING id, name, description, category, kind, score, steps, objections, analysis,
                        created_by, org_id, is_published, published_at, published_by,
                        version, created_at, updated_at`,
        shouldPublish ? [id, session.userId] : [id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ template: mapTemplateRow(r.rows[0] as Record<string, unknown>) });
    } catch (err) {
      console.error("[pondus] template publish failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_template_publish_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // DELETE template — SuperAdmin only.
  // Standard: soft-delete (is_published = false).
  // Hvis createdBy = session.userId → tillat hard DELETE.
  // ───────────────────────────────────────────────────────────────
  app.delete("/api/leadgrid/pondus/templates/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const admin = isPlatformAdmin(session);
    const id = readString(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: "invalid_id" });

    try {
      const existing = await pool.query(
        `SELECT created_by, org_id FROM pondus_templates WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (!existing.rows.length) return res.status(404).json({ error: "not_found" });
      const createdBy = existing.rows[0]?.created_by;

      // Org-leder kan slette org-egen mal (2026-08-02) — globale er
      // fortsatt SuperAdmin-only.
      if (!admin) {
        const templateOrg = existing.rows[0]?.org_id == null
          ? null : String(existing.rows[0].org_id);
        const userOrgId = await resolveOrgIdForUser(pool, session.userId);
        const allowed = templateOrg != null && userOrgId != null
          && templateOrg === userOrgId
          && (await canManageOrgTemplates(pool, userOrgId, session.userId));
        if (!allowed) {
          return res.status(403).json({ error: "forbidden_superadmin_only" });
        }
      }

      if (createdBy && String(createdBy) === session.userId) {
        // Ekte DELETE — kaskader til pondus_template_versions + pondus_content_by_step.
        await pool.query(`DELETE FROM pondus_templates WHERE id = $1`, [id]);
        return res.json({ ok: true, id, mode: "hard_deleted" });
      }

      // Soft-delete: unpublish
      const r = await pool.query(
        `UPDATE pondus_templates
            SET is_published = FALSE,
                updated_at = NOW()
          WHERE id = $1
          RETURNING id`,
        [id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, id, mode: "soft_deleted" });
    } catch (err) {
      console.error("[pondus] template DELETE failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_template_delete_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // GET version history
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/pondus/templates/:id/versions", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = readString(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      const r = await pool.query(
        `SELECT id, template_id, version, snapshot, changed_by, changed_at
           FROM pondus_template_versions
          WHERE template_id = $1
          ORDER BY version DESC`,
        [id],
      );
      return res.json({
        versions: r.rows.map((row) => ({
          id: row.id,
          template_id: row.template_id,
          version: Number(row.version ?? 0),
          snapshot: row.snapshot ?? {},
          changed_by: row.changed_by,
          changed_at: row.changed_at,
        })),
      });
    } catch (err) {
      console.error("[pondus] versions GET failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_versions_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST rollback to specific version — SuperAdmin only
  // Kopierer snapshot fra pondus_template_versions tilbake til pondus_templates
  // og bumper version igjen.
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/pondus/templates/:id/rollback/:version", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isPlatformAdmin(session)) {
      return res.status(403).json({ error: "forbidden_superadmin_only" });
    }
    const id = readString(req.params.id);
    const versionParam = Number(req.params.version);
    if (!isUuid(id)) return res.status(400).json({ error: "invalid_id" });
    if (!Number.isInteger(versionParam) || versionParam <= 0) {
      return res.status(400).json({ error: "invalid_version" });
    }

    try {
      const snap = await pool.query(
        `SELECT snapshot FROM pondus_template_versions
          WHERE template_id = $1 AND version = $2
          LIMIT 1`,
        [id, versionParam],
      );
      if (!snap.rows.length) {
        return res.status(404).json({ error: "version_not_found" });
      }
      const snapshot = snap.rows[0]?.snapshot as Record<string, unknown> | null;
      if (!snapshot) return res.status(400).json({ error: "snapshot_missing" });

      // Snapshot av gjeldende først
      const cur = await pool.query(
        `SELECT id, name, description, category, kind, score, steps, objections,
                is_published, version
           FROM pondus_templates
          WHERE id = $1
          LIMIT 1`,
        [id],
      );
      if (!cur.rows.length) return res.status(404).json({ error: "not_found" });
      const currentRow = cur.rows[0] as Record<string, unknown>;

      await pool.query(
        `INSERT INTO pondus_template_versions (template_id, version, snapshot, changed_by)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (template_id, version) DO NOTHING`,
        [id, Number(currentRow.version ?? 1), JSON.stringify(buildSnapshot(currentRow)), session.userId],
      );

      const nextVersion = Number(currentRow.version ?? 1) + 1;

      const r = await pool.query(
        `UPDATE pondus_templates
            SET name        = COALESCE($2, name),
                description = COALESCE($3, description),
                category    = COALESCE($4, category),
                kind        = COALESCE($5, kind),
                score       = COALESCE($6, score),
                steps       = COALESCE($7::jsonb, steps),
                objections  = COALESCE($8::jsonb, objections),
                version     = $9,
                updated_at  = NOW()
          WHERE id = $1
          RETURNING id, name, description, category, kind, score, steps, objections, analysis,
                    created_by, org_id, is_published, published_at, published_by,
                    version, created_at, updated_at`,
        [
          id,
          typeof snapshot.name === "string" ? snapshot.name : null,
          typeof snapshot.description === "string" ? snapshot.description : null,
          typeof snapshot.category === "string" ? snapshot.category : null,
          typeof snapshot.kind === "string" ? snapshot.kind : null,
          snapshot.score !== undefined ? coerceScore(snapshot.score) : null,
          snapshot.steps !== undefined ? JSON.stringify(snapshot.steps) : null,
          snapshot.objections !== undefined ? JSON.stringify(snapshot.objections) : null,
          nextVersion,
        ],
      );
      return res.json({ template: mapTemplateRow(r.rows[0] as Record<string, unknown>) });
    } catch (err) {
      console.error("[pondus] template rollback failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_rollback_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // GET content-by-step (varianter) — alle innloggede
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/pondus/content-by-step", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isPlatformAdmin(session)
        && !(await assertAnyEntitled(pool, session.userId, LEADBOOK_FEATURE_KEYS, res))) return;
    const templateId = readString(req.query.template_id);
    const stepKey = readString(req.query.step_key).trim();
    if (!isUuid(templateId)) return res.status(400).json({ error: "missing_or_invalid_template_id" });

    const clauses: string[] = ["template_id = $1"];
    const vals: unknown[] = [templateId];
    if (stepKey) {
      vals.push(stepKey);
      clauses.push(`step_key = $${vals.length}`);
    }

    try {
      const r = await pool.query(
        `SELECT id, template_id, step_key, variant_name, content_text, score,
                created_by, created_at
           FROM pondus_content_by_step
          WHERE ${clauses.join(" AND ")}
          ORDER BY score DESC, created_at DESC`,
        vals,
      );
      return res.json({
        variants: r.rows.map((row) => ({
          id: row.id,
          template_id: row.template_id,
          step_key: row.step_key,
          variant_name: row.variant_name,
          content_text: row.content_text,
          score: Number(row.score ?? 0),
          created_by: row.created_by,
          created_at: row.created_at,
        })),
      });
    } catch (err) {
      console.error("[pondus] content-by-step GET failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_content_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST content-by-step — SuperAdmin only
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/pondus/content-by-step", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isPlatformAdmin(session)) {
      return res.status(403).json({ error: "forbidden_superadmin_only" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const templateId = readString(body.template_id);
    const stepKey = readString(body.step_key).trim();
    const variantName = readString(body.variant_name).trim();
    const contentText = readString(body.content_text);
    const score = coerceScore(body.score, 0);
    if (!isUuid(templateId)) return res.status(400).json({ error: "invalid_template_id" });
    if (!stepKey) return res.status(400).json({ error: "missing_step_key" });
    if (!variantName) return res.status(400).json({ error: "missing_variant_name" });
    if (!contentText) return res.status(400).json({ error: "missing_content_text" });

    try {
      const r = await pool.query(
        `INSERT INTO pondus_content_by_step
           (template_id, step_key, variant_name, content_text, score, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5, $6)
         RETURNING id, template_id, step_key, variant_name, content_text, score,
                   created_by, created_at`,
        [templateId, stepKey, variantName, contentText, score, session.userId],
      );
      const row = r.rows[0] as Record<string, unknown>;
      return res.status(201).json({
        variant: {
          id: row.id,
          template_id: row.template_id,
          step_key: row.step_key,
          variant_name: row.variant_name,
          content_text: row.content_text,
          score: Number(row.score ?? 0),
          created_by: row.created_by,
          created_at: row.created_at,
        },
      });
    } catch (err) {
      console.error("[pondus] content-by-step POST failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_content_create_failed", detail: String("internal_error") });
    }
  });
}

// =====================================================================
// Usage-tracking (mig 0364) — datakilde for Leadbook-KPI-ene
// =====================================================================
// Registreres via registerPondusUsageRoutes (kalles rett etter
// registerPondusRoutes i index.ts). Egen register-funksjon så vi slipper
// å flytte eksisterende ruter.

export function registerPondusUsageRoutes(deps: PondusRoutesDeps): void {
  registerPondusUsageRoutesV2(deps);
  return;
  const { app, pool, requireUserSession } = deps;

  const VALID_OUTCOMES = new Set([
    "used", "meeting_booked", "proposal_sent", "won", "lost", "no_answer",
  ]);

  // ── POST /api/leadgrid/pondus/templates/:id/usage ──────────────────
  // Logg at en mal ble brukt (fra «Bruk mal» på iPad/Watch). lead_id og
  // outcome er valgfrie; outcome kan også oppdateres senere via ny POST
  // (append-only — konvertering regnes på beste utfall per bruk-økt er
  // overkill; vi teller rader per outcome).
  app.post("/api/leadgrid/pondus/templates/:id/usage", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const templateId = String(req.params.id ?? "");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const leadId = typeof body.lead_id === "string" && /^[0-9a-f-]{36}$/i.test(body.lead_id)
      ? body.lead_id : null;
    const outcome = typeof body.outcome === "string" && VALID_OUTCOMES.has(body.outcome)
      ? body.outcome : "used";
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      // Utfalls-registrering (outcome != 'used') OPPGRADERER siste
      // 'used'-rad for samme mal+bruker innen 1 time i stedet for å
      // inserte ny — ellers dobles nevneren og møte-raten halveres
      // (én bruk m/ møte ville telt 2 rader / 1 møte = 50 %).
      if (outcome !== "used") {
        const upd = await pool.query(
          `UPDATE pondus_template_usage
              SET outcome = $1, lead_id = COALESCE($2::uuid, lead_id)
            WHERE id = (
              SELECT id FROM pondus_template_usage
               WHERE template_id = $3::uuid AND user_id = $4
                 AND outcome = 'used'
                 AND used_at > NOW() - INTERVAL '1 hour'
               ORDER BY used_at DESC LIMIT 1
            )
            RETURNING id, used_at`,
          [outcome, leadId, templateId, session.userId],
        );
        if (upd.rows[0]) {
          return res.status(200).json({
            usage: {
              id: String(upd.rows[0].id),
              template_id: templateId,
              outcome,
              used_at: upd.rows[0].used_at,
            },
          });
        }
        // Ingen fersk 'used'-rad å oppgradere — fall gjennom til insert.
      }
      const r = await pool.query(
        `INSERT INTO pondus_template_usage
           (template_id, organization_id, user_id, lead_id, outcome)
         VALUES ($1::uuid, $2, $3, $4::uuid, $5)
         RETURNING id, used_at`,
        [templateId, orgId, session.userId, leadId, outcome],
      );
      return res.status(201).json({
        usage: {
          id: String(r.rows[0].id),
          template_id: templateId,
          outcome,
          used_at: r.rows[0].used_at,
        },
      });
    } catch (err) {
      console.error("[pondus] usage POST failed:", err);
      return res.status(500).json({ error: "pondus_usage_failed", detail: String("internal_error") });
    }
  });

  // ── GET /api/leadgrid/pondus/usage/stats?period=7d|30d|90d|ytd ───────
  // Aggregert bruk for org-en: per mal (totalt, i dag, siste 30d,
  // møte-rate = (meeting_booked+won)/totalt) + topp-nivå KPI-er
  // (bruk i dag, distinkte brukere siste 30d for team-adopsjon).
  //
  // `period` er valgfri og filtrerer KUN per-mal-radene (used_total +
  // rate-feltene) til det tidsvinduet — brukes av PondusTeamUsageModal
  // sin periode-velger. Uten `period` = all-time (uendret oppførsel for
  // eksisterende callere, bl.a. LeadbookLiveStore).
  app.get("/api/leadgrid/pondus/usage/stats", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const periodParam = readString(req.query.period).trim();
      const periodDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
      const sinceClause = periodParam === "ytd"
        ? "date_trunc('year', NOW())"
        : periodDays[periodParam]
          ? `NOW() - INTERVAL '${periodDays[periodParam]} days'`
          : null;
      const perTemplate = await pool.query(
        `SELECT template_id::text,
                COUNT(*)::int                                                        AS used_total,
                COUNT(*) FILTER (WHERE used_at::date = CURRENT_DATE)::int            AS used_today,
                COUNT(*) FILTER (WHERE used_at > NOW() - INTERVAL '30 days')::int    AS used_30d,
                COUNT(*) FILTER (WHERE outcome IN ('meeting_booked','won'))::int     AS meetings,
                -- Svarrate: andel logget bruk som IKKE endte i no_answer.
                COUNT(*) FILTER (WHERE outcome != 'no_answer')::int                 AS responded,
                -- Konvertering: won / (won+lost) blant avgjorte utfall.
                COUNT(*) FILTER (WHERE outcome = 'won')::int                        AS won,
                COUNT(*) FILTER (WHERE outcome IN ('won','lost'))::int              AS decided
           FROM pondus_template_usage
          WHERE organization_id = $1
            ${sinceClause ? `AND used_at >= ${sinceClause}` : ""}
          GROUP BY template_id`,
        [orgId],
      );
      const totals = await pool.query<{
        used_today: number; distinct_users_30d: number; meetings_30d: number; used_30d: number;
      }>(
        `SELECT COUNT(*) FILTER (WHERE used_at::date = CURRENT_DATE)::int          AS used_today,
                COUNT(DISTINCT user_id) FILTER (WHERE used_at > NOW() - INTERVAL '30 days')::int AS distinct_users_30d,
                COUNT(*) FILTER (WHERE outcome IN ('meeting_booked','won')
                                   AND used_at > NOW() - INTERVAL '30 days')::int   AS meetings_30d,
                COUNT(*) FILTER (WHERE used_at > NOW() - INTERVAL '30 days')::int   AS used_30d
           FROM pondus_template_usage
          WHERE organization_id = $1`,
        [orgId],
      );
      const t = totals.rows[0];
      return res.json({
        templates: perTemplate.rows.map((row) => ({
          template_id: String(row.template_id),
          used_total: Number(row.used_total),
          used_today: Number(row.used_today),
          used_30d: Number(row.used_30d),
          meeting_rate: Number(row.used_total) > 0
            ? Math.round((Number(row.meetings) / Number(row.used_total)) * 100) / 100
            : 0,
          response_rate: Number(row.used_total) > 0
            ? Math.round((Number(row.responded) / Number(row.used_total)) * 100) / 100
            : 0,
          conversion_rate: Number(row.decided) > 0
            ? Math.round((Number(row.won) / Number(row.decided)) * 100) / 100
            : 0,
        })),
        totals: {
          used_today: Number(t?.used_today ?? 0),
          used_30d: Number(t?.used_30d ?? 0),
          distinct_users_30d: Number(t?.distinct_users_30d ?? 0),
          meeting_rate_30d: Number(t?.used_30d ?? 0) > 0
            ? Math.round((Number(t.meetings_30d) / Number(t.used_30d)) * 100) / 100
            : 0,
        },
      });
    } catch (err) {
      console.error("[pondus] usage stats failed:", err);
      return res.status(500).json({ error: "pondus_usage_stats_failed", detail: String("internal_error") });
    }
  });

  // ── GET /api/leadgrid/pondus/templates/:id/usage-detail ─────────────
  // Per-mal drill-down: utfalls-fordeling + siste 20 logger + per-selger
  // brekk-ned. Scopet til org-en (samme org-sjekk som usage/stats — ingen
  // per-template eierskaps-sjekk, all bruk er allerede org-scopet ved
  // logging i POST /templates/:id/usage).
  app.get("/api/leadgrid/pondus/templates/:id/usage-detail", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const templateId = readString(req.params.id).trim();
    if (!isUuid(templateId)) return res.status(400).json({ error: "invalid_template_id" });
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const outcomes = await pool.query<{ outcome: string; n: number }>(
        `SELECT outcome, COUNT(*)::int AS n
           FROM pondus_template_usage
          WHERE template_id = $1::uuid AND organization_id = $2
          GROUP BY outcome`,
        [templateId, orgId],
      );
      const bySeller = await pool.query(
        `SELECT u.id AS user_id,
                COALESCE(NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''), u.username, u.email) AS name,
                COUNT(*)::int AS used,
                COUNT(*) FILTER (WHERE pu.outcome IN ('meeting_booked','won'))::int AS meetings
           FROM pondus_template_usage pu
           JOIN users u ON u.id = pu.user_id
          WHERE pu.template_id = $1::uuid AND pu.organization_id = $2
          GROUP BY u.id, name
          ORDER BY used DESC
          LIMIT 20`,
        [templateId, orgId],
      );
      const recent = await pool.query(
        `SELECT pu.used_at,
                pu.outcome,
                COALESCE(NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''), u.username, u.email) AS user_name
           FROM pondus_template_usage pu
           JOIN users u ON u.id = pu.user_id
          WHERE pu.template_id = $1::uuid AND pu.organization_id = $2
          ORDER BY pu.used_at DESC
          LIMIT 20`,
        [templateId, orgId],
      );
      return res.json({
        outcomes: Object.fromEntries(outcomes.rows.map((r) => [r.outcome, Number(r.n)])),
        by_seller: bySeller.rows.map((r) => ({
          user_id: String((r as Record<string, unknown>).user_id),
          name: String((r as Record<string, unknown>).name),
          used: Number((r as Record<string, unknown>).used),
          meetings: Number((r as Record<string, unknown>).meetings),
        })),
        recent: recent.rows.map((r) => ({
          used_at: (r as Record<string, unknown>).used_at,
          outcome: String((r as Record<string, unknown>).outcome),
          user_name: String((r as Record<string, unknown>).user_name),
        })),
      });
    } catch (err) {
      console.error("[pondus] usage-detail failed:", err);
      return res.status(500).json({ error: "pondus_usage_detail_failed", detail: String("internal_error") });
    }
  });
}
