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
 * Endepunkter (10):
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

/**
 * Returnerer organization_id for innlogget bruker. Faller til userId hvis
 * brukeren ikke er medlem av en enterprise-org (samme mønster som
 * sales-leadership-routes.ts).
 */
async function resolveOrgIdForUser(pool: Pool, userId: string): Promise<string> {
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id
         FROM enterprise_team_members
        WHERE user_id = $1 AND status = 'active'
        ORDER BY joined_at DESC NULLS LAST
        LIMIT 1`,
      [userId],
    );
    const orgId = r.rows[0]?.organization_id;
    if (orgId) return String(orgId);
  } catch {
    // Tabell mangler eller spørring feilet — fall til userId-modell.
  }
  return userId;
}

function readString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function isPlatformAdmin(session: SessionUser): boolean {
  return ADMIN_ROLES.has(session.role);
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
        .json({ error: "pondus_templates_failed", detail: String((err as Error).message) });
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
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
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
        .json({ error: "pondus_template_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST create template — SuperAdmin only
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/pondus/templates", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isPlatformAdmin(session)) {
      return res.status(403).json({ error: "forbidden_superadmin_only" });
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
    // org_id: null (Leadgrid-global, standard) eller en gyldig UUID.
    let orgIdParam: string | null = null;
    if (body.org_id !== undefined && body.org_id !== null) {
      const raw = String(body.org_id);
      if (!isUuid(raw)) {
        return res.status(400).json({ error: "invalid_org_id" });
      }
      orgIdParam = raw;
    }

    try {
      const r = await pool.query(
        `INSERT INTO pondus_templates
           (name, description, category, kind, score, steps, objections, analysis,
            created_by, org_id, is_published, version)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10::uuid, FALSE, 1)
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
        ],
      );
      const row = r.rows[0] as Record<string, unknown>;
      return res.status(201).json({ template: mapTemplateRow(row) });
    } catch (err) {
      console.error("[pondus] template POST failed:", err);
      return res
        .status(500)
        .json({ error: "pondus_template_create_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // PATCH template — SuperAdmin only, bumper version + audit snapshot
  // ───────────────────────────────────────────────────────────────
  app.patch("/api/leadgrid/pondus/templates/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isPlatformAdmin(session)) {
      return res.status(403).json({ error: "forbidden_superadmin_only" });
    }
    const id = readString(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: "invalid_id" });
    const body = (req.body ?? {}) as Record<string, unknown>;

    try {
      // Snapshot først (FØR endringen)
      const existing = await pool.query(
        `SELECT id, name, description, category, kind, score, steps, objections,
                is_published, version
           FROM pondus_templates
          WHERE id = $1
          LIMIT 1`,
        [id],
      );
      if (existing.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const currentRow = existing.rows[0] as Record<string, unknown>;

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
        .json({ error: "pondus_template_update_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST publish/unpublish — SuperAdmin only
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/pondus/templates/:id/publish", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isPlatformAdmin(session)) {
      return res.status(403).json({ error: "forbidden_superadmin_only" });
    }
    const id = readString(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: "invalid_id" });
    const body = (req.body ?? {}) as { published?: boolean };
    const shouldPublish = body.published !== false;

    try {
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
        .json({ error: "pondus_template_publish_failed", detail: String((err as Error).message) });
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
    if (!isPlatformAdmin(session)) {
      return res.status(403).json({ error: "forbidden_superadmin_only" });
    }
    const id = readString(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: "invalid_id" });

    try {
      const existing = await pool.query(
        `SELECT created_by FROM pondus_templates WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (existing.rowCount === 0) return res.status(404).json({ error: "not_found" });
      const createdBy = existing.rows[0]?.created_by;

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
        .json({ error: "pondus_template_delete_failed", detail: String((err as Error).message) });
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
        .json({ error: "pondus_versions_failed", detail: String((err as Error).message) });
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
      if (snap.rowCount === 0) {
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
      if (cur.rowCount === 0) return res.status(404).json({ error: "not_found" });
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
        .json({ error: "pondus_rollback_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // GET content-by-step (varianter) — alle innloggede
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/pondus/content-by-step", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
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
        .json({ error: "pondus_content_failed", detail: String((err as Error).message) });
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
        .json({ error: "pondus_content_create_failed", detail: String((err as Error).message) });
    }
  });
}
