import type { Pool } from "pg";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";

const SALES_LEADER_ROLES = new Set(["owner", "admin", "salgssjef"]);
const SALES_VIEWER_ROLES = new Set(["owner", "admin", "salgssjef", "teamleder"]);
const GLOBAL_BYPASS_ROLES = new Set(["super_admin"]);

export async function canViewLeadgridSales(
  pool: Pool,
  organizationId: string,
  userId: string,
  globalRole?: string,
): Promise<boolean> {
  if (GLOBAL_BYPASS_ROLES.has(String(globalRole ?? "").toLowerCase())) return true;
  try {
    const { role, permissions } = await resolveEffectivePermissions(
      pool,
      organizationId,
      userId,
    );
    return (
      (role != null && SALES_VIEWER_ROLES.has(role.toLowerCase())) ||
      permissions.has("sales_leadership.view") ||
      permissions.has("sales_leadership.manage") ||
      permissions.has("permissions.manage")
    );
  } catch {
    return false;
  }
}

/**
 * Sales-management authorization is always evaluated in the active
 * organization. A global session role is only accepted for super-admin;
 * ordinary manager roles must come from organization_members so an account
 * cannot administer another workspace by carrying a stale/global role.
 */
export async function canManageLeadgridSales(
  pool: Pool,
  organizationId: string,
  userId: string,
  globalRole?: string,
): Promise<boolean> {
  if (GLOBAL_BYPASS_ROLES.has(String(globalRole ?? "").toLowerCase())) return true;
  try {
    const { role, permissions } = await resolveEffectivePermissions(
      pool,
      organizationId,
      userId,
    );
    return (
      (role != null && SALES_LEADER_ROLES.has(role.toLowerCase())) ||
      permissions.has("sales_leadership.manage") ||
      permissions.has("permissions.manage")
    );
  } catch {
    return false;
  }
}
