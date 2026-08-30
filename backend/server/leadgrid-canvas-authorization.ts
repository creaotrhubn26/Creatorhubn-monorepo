import type { Pool } from "pg";
import {
  checkAnyEntitlement,
  LEADGRID_CANVAS_FEATURE_KEYS,
} from "./leadgrid-entitlement-guard.js";

const PLATFORM_ADMIN_ROLES = new Set(["super_admin", "admin", "owner"]);
const ORG_ADMIN_ROLES = new Set(["admin", "owner"]);
const LEADER_ROLES = new Set(["markedssjef", "salgssjef", "teamleder"]);

export type CanvasAuthorization = {
  canWrite: boolean;
  canShare: boolean;
  canUploadPdf: boolean;
  canUseLibrary: boolean;
  canRestoreHistory: boolean;
  roleGroup: "admin" | "leder" | "selger";
};

async function firstRole(
  pool: Pool,
  sql: string,
  values: unknown[],
): Promise<string | null> {
  try {
    const result = await pool.query<{ role: string | null }>(sql, values);
    return result.rows[0]?.role
      ? String(result.rows[0].role).toLowerCase()
      : null;
  } catch (error) {
    // A genuinely absent optional membership table means that source cannot
    // contain a restrictive role. Every other failure is indeterminate and
    // must never silently promote a viewer to the legacy seller default.
    if ((error as { code?: string } | null)?.code === "42P01") return null;
    throw error;
  }
}
/**
 * Resolve Canvas role policy inside the already resolved organization.
 * Membership queries are deliberately scoped by both user and organization;
 * a role in another tenant must never confer privileges here.
 */
export async function getCanvasAuthorization(
  pool: Pool,
  userId: string,
  organizationId: string,
): Promise<CanvasAuthorization> {
  const [globalRole, orgRole, enterpriseRole] = await Promise.all([
    firstRole(pool, `SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId]),
    firstRole(
      pool,
      `SELECT role FROM organization_members
        WHERE organization_id::text = $1 AND user_id::text = $2
        LIMIT 1`,
      [organizationId, userId],
    ),
    firstRole(
      pool,
      `SELECT role FROM enterprise_team_members
        WHERE organization_id::text = $1 AND user_id::text = $2
          AND status = 'active'
        LIMIT 1`,
      [organizationId, userId],
    ),
  ]);

  const roles = [globalRole, orgRole, enterpriseRole].filter(
    (role): role is string => Boolean(role),
  );
  const isAdmin =
    PLATFORM_ADMIN_ROLES.has(globalRole ?? "") ||
    ORG_ADMIN_ROLES.has(orgRole ?? "") ||
    ORG_ADMIN_ROLES.has(enterpriseRole ?? "");
  const isLeader = !isAdmin && roles.some((role) => LEADER_ROLES.has(role));
  const isViewer = !isAdmin && !isLeader && roles.includes("viewer");
  const roleGroup = isAdmin ? "admin" : isLeader ? "leder" : "selger";

  let hidden = new Set<string>();
  if (!isAdmin) {
    try {
      const policy = await pool.query<{ skjulte_funksjoner: unknown }>(
        `SELECT skjulte_funksjoner FROM leadgrid_canvas_policy
          WHERE organization_id = $1 AND malgruppe = $2
          LIMIT 1`,
        [organizationId, roleGroup],
      );
      const value = policy.rows[0]?.skjulte_funksjoner;
      if (Array.isArray(value)) hidden = new Set(value.map(String));
    } catch (error) {
      // A pre-policy legacy installation has no table. Permission, timeout,
      // malformed-schema and other errors fail closed by propagating.
      if ((error as { code?: string } | null)?.code !== "42P01") throw error;
    }
  }

  return {
    canWrite: !isViewer,
    canShare: !isViewer && !hidden.has("deling"),
    canUploadPdf: !isViewer && !hidden.has("pdf"),
    canUseLibrary: !isViewer && !hidden.has("bibliotek"),
    canRestoreHistory: !isViewer && !hidden.has("tidsreise"),
    roleGroup,
  };
}

/** WebSocket checks fail closed: a revoked/indeterminate entitlement closes. */
export async function isCanvasEntitledStrict(
  pool: Pool,
  userId: string,
): Promise<boolean> {
  try {
    const decision = await checkAnyEntitlement(
      pool,
      userId,
      LEADGRID_CANVAS_FEATURE_KEYS,
    );
    return decision.allowed;
  } catch {
    return false;
  }
}
