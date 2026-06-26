/**
 * leadgrid-industries-routes.ts
 *
 * CRUD-endepunkter for `industries`-katalogen (mig 329) + medlems-
 * spesialiseringer (organization_member_industries).
 *
 * Endepunkter:
 *   GET    /api/leadgrid/industries                  — alle aktive
 *                                                      (global + min orgs custom)
 *   GET    /api/leadgrid/industries/:id              — detalj
 *   POST   /api/leadgrid/industries                  — opprett custom for min org
 *   PATCH  /api/leadgrid/industries/:id              — oppdater custom (mine)
 *   DELETE /api/leadgrid/industries/:id              — soft-delete (mine)
 *
 *   GET    /api/leadgrid/members/me/industries       — mine spesialiseringer
 *   PUT    /api/leadgrid/members/me/industries       — replace-all (mine)
 *   GET    /api/leadgrid/members/:userId/industries  — admin: andres
 *   PUT    /api/leadgrid/members/:userId/industries  — admin: replace-all (andres)
 *
 * Auth-gates:
 *   - .view-endepunkter:   industries.view
 *   - .manage (POST/PATCH/DELETE industries): industries.manage
 *   - .assign (PUT andres /members/:userId/industries): industries.assign
 *   - PUT /me/industries: krever bare innlogget bruker (alle kan oppdatere
 *     egne spesialiseringer; admin-gate via industries.assign for andres).
 *
 * Designvalg:
 *   - Hverken global industry (scope='global') eller andre orgs custom
 *     kan endres av admin. Bare egen org sine custom.
 *   - DELETE er soft (is_active=false) for å bevare history på leads som
 *     allerede peker mot bransjen.
 *   - PUT /members/.../industries gjør "replace-all" (deletes alle som
 *     ikke er i payload + upsert hver i payload) i én transaksjon.
 *   - Mainstream-respons: { industries: [...] } / { memberIndustries: [...] }.
 */

import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";

import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// =====================================================================
// Typer
// =====================================================================

export interface IndustryRow {
  id: string;
  code: string;
  name_no: string;
  name_en: string | null;
  parent_id: string | null;
  icon: string | null;
  color_hex: string | null;
  scope: "global" | "custom";
  organization_id: string | null;
  is_active: boolean;
  display_order: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MemberIndustryRow {
  organization_id: string;
  user_id: string;
  industry_id: string;
  expertise_level: "general" | "specialist" | "expert";
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// Helpers
// =====================================================================

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

/**
 * Hent brukerens default org (samme mønster som lead-map-rbac-helper).
 * Returneres for /me-endepunktene som ikke får org-id eksplisitt.
 */
async function resolveMyOrgId(
  pool: Pool,
  userId: string,
  reqOrgId?: string | null,
): Promise<string | null> {
  if (reqOrgId && typeof reqOrgId === "string") return reqOrgId;
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text
       FROM organization_members
      WHERE user_id = $1
      ORDER BY
        CASE role
          WHEN 'admin' THEN 1
          WHEN 'salgssjef' THEN 2
          ELSE 3
        END,
        joined_at ASC
      LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

/** Map DB-row → API-respons (camelCase). */
function mapIndustry(r: IndustryRow): Record<string, unknown> {
  return {
    id: r.id,
    code: r.code,
    nameNo: r.name_no,
    nameEn: r.name_en,
    parentId: r.parent_id,
    icon: r.icon,
    colorHex: r.color_hex,
    scope: r.scope,
    organizationId: r.organization_id,
    isActive: r.is_active,
    displayOrder: r.display_order,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapMemberIndustry(r: MemberIndustryRow): Record<string, unknown> {
  return {
    organizationId: r.organization_id,
    userId: r.user_id,
    industryId: r.industry_id,
    expertiseLevel: r.expertise_level,
    isPrimary: r.is_primary,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// =====================================================================
// Validering
// =====================================================================

const VALID_EXPERTISE = new Set(["general", "specialist", "expert"] as const);

function sanitizeColorHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return null;
}

function sanitizeIcon(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().slice(0, 60);
  return trimmed.length > 0 ? trimmed : null;
}

// =====================================================================
// Industries CRUD
// =====================================================================

export function registerLeadgridIndustriesRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // ─── GET liste ─────────────────────────────────────────────────────
  app.get(
    "/api/leadgrid/industries",
    requireLeadMapPermission("industries.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const orgId = await resolveMyOrgId(
        pool,
        session.userId,
        (typeof req.query.organization_id === "string" && req.query.organization_id) || null,
      );

      // Inkluder global + custom for denne org'en.
      const r = await pool.query<IndustryRow>(
        `SELECT id::text, code, name_no, name_en, parent_id::text,
                icon, color_hex, scope, organization_id::text,
                is_active, display_order, metadata,
                created_at::text, updated_at::text
           FROM industries
          WHERE is_active = TRUE
            AND (scope = 'global'
                 OR (scope = 'custom' AND organization_id = $1::uuid))
          ORDER BY scope ASC, display_order ASC, name_no ASC`,
        [orgId],
      );
      res.json({ industries: r.rows.map(mapIndustry) });
    },
  );

  // ─── GET detalj ────────────────────────────────────────────────────
  app.get(
    "/api/leadgrid/industries/:id",
    requireLeadMapPermission("industries.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const id = req.params.id;
      const r = await pool.query<IndustryRow>(
        `SELECT id::text, code, name_no, name_en, parent_id::text,
                icon, color_hex, scope, organization_id::text,
                is_active, display_order, metadata,
                created_at::text, updated_at::text
           FROM industries
          WHERE id = $1::uuid AND is_active = TRUE
          LIMIT 1`,
        [id],
      );
      if (!r.rows[0]) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ industry: mapIndustry(r.rows[0]) });
    },
  );

  // ─── POST opprett custom ──────────────────────────────────────────
  app.post(
    "/api/leadgrid/industries",
    requireLeadMapPermission("industries.manage", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const orgId = await resolveMyOrgId(pool, session.userId, req.body?.organizationId);
      if (!orgId) {
        res.status(400).json({ error: "no_organization" });
        return;
      }
      const { code, nameNo, nameEn, parentId, displayOrder, metadata } = req.body ?? {};
      if (typeof code !== "string" || code.trim().length === 0) {
        res.status(400).json({ error: "missing_code" });
        return;
      }
      if (typeof nameNo !== "string" || nameNo.trim().length === 0) {
        res.status(400).json({ error: "missing_name_no" });
        return;
      }
      // Enforce CUSTOM-prefiks for org-custom-rader for å unngå NACE-kollisjoner.
      const finalCode = code.trim().toUpperCase().startsWith("CUSTOM.")
        ? code.trim().toUpperCase()
        : `CUSTOM.${code.trim().toUpperCase()}`;
      const icon = sanitizeIcon(req.body?.icon);
      const colorHex = sanitizeColorHex(req.body?.colorHex);
      try {
        const r = await pool.query<IndustryRow>(
          `INSERT INTO industries
             (code, name_no, name_en, parent_id, icon, color_hex,
              scope, organization_id, display_order, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, 'custom', $7::uuid, $8, $9::jsonb)
           RETURNING id::text, code, name_no, name_en, parent_id::text,
                     icon, color_hex, scope, organization_id::text,
                     is_active, display_order, metadata,
                     created_at::text, updated_at::text`,
          [
            finalCode,
            nameNo.trim(),
            typeof nameEn === "string" ? nameEn.trim() : null,
            typeof parentId === "string" ? parentId : null,
            icon,
            colorHex,
            orgId,
            typeof displayOrder === "number" ? displayOrder : 0,
            JSON.stringify(metadata && typeof metadata === "object" ? metadata : {}),
          ],
        );
        res.status(201).json({ industry: mapIndustry(r.rows[0]) });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("duplicate key") || msg.includes("unique")) {
          res.status(409).json({ error: "code_exists", detail: msg });
          return;
        }
        res.status(500).json({ error: "create_failed", detail: msg });
      }
    },
  );

  // ─── PATCH oppdater (kun mine custom) ─────────────────────────────
  app.patch(
    "/api/leadgrid/industries/:id",
    requireLeadMapPermission("industries.manage", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const orgId = await resolveMyOrgId(pool, session.userId, req.body?.organizationId);
      if (!orgId) {
        res.status(400).json({ error: "no_organization" });
        return;
      }
      // Verifiser eier
      const own = await pool.query<{ id: string }>(
        `SELECT id::text FROM industries
          WHERE id = $1::uuid
            AND scope = 'custom'
            AND organization_id = $2::uuid
          LIMIT 1`,
        [req.params.id, orgId],
      );
      if (!own.rows[0]) {
        res.status(403).json({ error: "not_owner_or_not_custom" });
        return;
      }
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [req.params.id];
      function add(col: string, value: unknown) {
        if (value === undefined) return;
        params.push(value);
        sets.push(`${col} = $${params.length}`);
      }
      if (typeof req.body?.nameNo === "string") add("name_no", req.body.nameNo.trim());
      if (typeof req.body?.nameEn === "string") add("name_en", req.body.nameEn.trim());
      if ("parentId" in (req.body ?? {})) {
        add("parent_id", req.body.parentId ?? null);
      }
      if ("icon" in (req.body ?? {})) add("icon", sanitizeIcon(req.body.icon));
      if ("colorHex" in (req.body ?? {})) add("color_hex", sanitizeColorHex(req.body.colorHex));
      if (typeof req.body?.displayOrder === "number") add("display_order", req.body.displayOrder);
      if (req.body?.metadata && typeof req.body.metadata === "object") {
        params.push(JSON.stringify(req.body.metadata));
        sets.push(`metadata = $${params.length}::jsonb`);
      }
      const r = await pool.query<IndustryRow>(
        `UPDATE industries SET ${sets.join(", ")}
          WHERE id = $1::uuid
        RETURNING id::text, code, name_no, name_en, parent_id::text,
                  icon, color_hex, scope, organization_id::text,
                  is_active, display_order, metadata,
                  created_at::text, updated_at::text`,
        params,
      );
      res.json({ industry: mapIndustry(r.rows[0]) });
    },
  );

  // ─── DELETE soft-delete ───────────────────────────────────────────
  app.delete(
    "/api/leadgrid/industries/:id",
    requireLeadMapPermission("industries.manage", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const orgId = await resolveMyOrgId(pool, session.userId, null);
      if (!orgId) {
        res.status(400).json({ error: "no_organization" });
        return;
      }
      const r = await pool.query(
        `UPDATE industries
            SET is_active = FALSE, updated_at = NOW()
          WHERE id = $1::uuid
            AND scope = 'custom'
            AND organization_id = $2::uuid`,
        [req.params.id, orgId],
      );
      if (r.rowCount === 0) {
        res.status(403).json({ error: "not_owner_or_not_custom" });
        return;
      }
      res.status(204).end();
    },
  );

  // ─── Mine spesialiseringer ────────────────────────────────────────
  app.get(
    "/api/leadgrid/members/me/industries",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const orgId = await resolveMyOrgId(
        pool,
        session.userId,
        (typeof req.query.organization_id === "string" && req.query.organization_id) || null,
      );
      if (!orgId) {
        res.json({ memberIndustries: [] });
        return;
      }
      const r = await pool.query<MemberIndustryRow>(
        `SELECT organization_id::text, user_id::text, industry_id::text,
                expertise_level, is_primary, notes,
                created_at::text, updated_at::text
           FROM organization_member_industries
          WHERE organization_id = $1::uuid AND user_id = $2::uuid
          ORDER BY is_primary DESC, expertise_level DESC`,
        [orgId, session.userId],
      );
      res.json({ memberIndustries: r.rows.map(mapMemberIndustry) });
    },
  );

  app.put(
    "/api/leadgrid/members/me/industries",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const orgId = await resolveMyOrgId(pool, session.userId, req.body?.organizationId);
      if (!orgId) {
        res.status(400).json({ error: "no_organization" });
        return;
      }
      try {
        const result = await replaceMemberIndustries(
          pool,
          orgId,
          session.userId,
          Array.isArray(req.body?.industries) ? req.body.industries : [],
        );
        res.json({ memberIndustries: result.map(mapMemberIndustry) });
      } catch (err) {
        res.status(400).json({ error: "replace_failed", detail: (err as Error).message });
      }
    },
  );

  // ─── Admin: andre medlemmers spesialiseringer ─────────────────────
  app.get(
    "/api/leadgrid/members/:userId/industries",
    requireLeadMapPermission("industries.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const orgId = await resolveMyOrgId(
        pool,
        session.userId,
        (typeof req.query.organization_id === "string" && req.query.organization_id) || null,
      );
      if (!orgId) {
        res.json({ memberIndustries: [] });
        return;
      }
      const targetUserId = String(req.params.userId ?? "");
      const r = await pool.query<MemberIndustryRow>(
        `SELECT organization_id::text, user_id::text, industry_id::text,
                expertise_level, is_primary, notes,
                created_at::text, updated_at::text
           FROM organization_member_industries
          WHERE organization_id = $1::uuid AND user_id = $2::uuid
          ORDER BY is_primary DESC, expertise_level DESC`,
        [orgId, targetUserId],
      );
      res.json({ memberIndustries: r.rows.map(mapMemberIndustry) });
    },
  );

  app.put(
    "/api/leadgrid/members/:userId/industries",
    requireLeadMapPermission("industries.assign", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const orgId = await resolveMyOrgId(pool, session.userId, req.body?.organizationId);
      if (!orgId) {
        res.status(400).json({ error: "no_organization" });
        return;
      }
      const targetUserId = String(req.params.userId ?? "");
      try {
        const result = await replaceMemberIndustries(
          pool,
          orgId,
          targetUserId,
          Array.isArray(req.body?.industries) ? req.body.industries : [],
        );
        res.json({ memberIndustries: result.map(mapMemberIndustry) });
      } catch (err) {
        res.status(400).json({ error: "replace_failed", detail: (err as Error).message });
      }
    },
  );
}

// =====================================================================
// Helpers (eksportert for test)
// =====================================================================

interface IndustryAssignmentInput {
  industryId: string;
  expertiseLevel?: "general" | "specialist" | "expert";
  isPrimary?: boolean;
  notes?: string | null;
}

/**
 * Replace-all i én transaksjon. Enforcer:
 *   - Maks ÉN is_primary per (org, user).
 *   - expertise_level innenfor allowed-set.
 */
export async function replaceMemberIndustries(
  pool: Pool,
  organizationId: string,
  userId: string,
  inputs: unknown[],
): Promise<MemberIndustryRow[]> {
  // Parse + validér
  const parsed: IndustryAssignmentInput[] = [];
  let primaryCount = 0;
  for (const raw of inputs) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const industryId = obj.industryId;
    if (typeof industryId !== "string" || industryId.length === 0) {
      throw new Error("industryId mangler");
    }
    const expertise =
      typeof obj.expertiseLevel === "string" && VALID_EXPERTISE.has(obj.expertiseLevel as "general")
        ? (obj.expertiseLevel as IndustryAssignmentInput["expertiseLevel"])
        : "general";
    const isPrimary = Boolean(obj.isPrimary);
    if (isPrimary) primaryCount++;
    parsed.push({
      industryId,
      expertiseLevel: expertise,
      isPrimary,
      notes: typeof obj.notes === "string" ? obj.notes : null,
    });
  }
  if (primaryCount > 1) {
    throw new Error("maks 1 is_primary per medlem");
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    // Slett alle eksisterende for (org, user) for å gjøre replace-all.
    await client.query(
      `DELETE FROM organization_member_industries
        WHERE organization_id = $1::uuid AND user_id = $2::uuid`,
      [organizationId, userId],
    );
    for (const p of parsed) {
      await client.query(
        `INSERT INTO organization_member_industries
           (organization_id, user_id, industry_id, expertise_level, is_primary, notes)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
        [organizationId, userId, p.industryId, p.expertiseLevel ?? "general", p.isPrimary ?? false, p.notes ?? null],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const r = await pool.query<MemberIndustryRow>(
    `SELECT organization_id::text, user_id::text, industry_id::text,
            expertise_level, is_primary, notes,
            created_at::text, updated_at::text
       FROM organization_member_industries
      WHERE organization_id = $1::uuid AND user_id = $2::uuid
      ORDER BY is_primary DESC, expertise_level DESC`,
    [organizationId, userId],
  );
  return r.rows;
}

// =====================================================================
// Re-exports for test
// =====================================================================

export const __test = {
  resolveMyOrgId,
  mapIndustry,
  mapMemberIndustry,
  replaceMemberIndustries,
  sanitizeColorHex,
  sanitizeIcon,
};
