import type { Pool, PoolClient } from "pg";

type Queryer = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export const CREATORHUB_ENTERPRISE_FEATURES = {
  timesheets: "native-timesheets-approvals",
  booking: "public-booking-page",
  vendorProducts: "vendor-product-api",
} as const;

export type CreatorHubEnterpriseFeatureId =
  (typeof CREATORHUB_ENTERPRISE_FEATURES)[keyof typeof CREATORHUB_ENTERPRISE_FEATURES];

export type CreatorHubEnterpriseAccess = {
  organizationId: string;
  userId: string;
  role: "admin" | "member" | "viewer";
  featureId: CreatorHubEnterpriseFeatureId;
  canRead: true;
  canWrite: boolean;
  canAdminister: boolean;
};

export class CreatorHubEnterpriseAccessError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const strength = (role: string): number =>
  role === "admin" ? 3 : role === "member" ? 2 : role === "viewer" ? 1 : 0;

const parseStrings = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return value.replace(/[{}]/g, "").split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

/**
 * Server-authoritative Enterprise entitlement and feature-policy check.
 * A client-supplied organization id only narrows the caller's active
 * memberships; it never grants access. Ambiguous memberships fail closed.
 */
export async function resolveCreatorHubEnterpriseAccess(
  db: Queryer,
  input: {
    userId: string;
    featureId: CreatorHubEnterpriseFeatureId;
    organizationId?: string | null;
  },
): Promise<CreatorHubEnterpriseAccess> {
  const memberships = await db.query(
    `SELECT member.organization_id::text AS organization_id,
            LOWER(member.role::text) AS role,
            entitlement.status AS entitlement_status,
            entitlement.valid_until,
            permission.permission_level,
            permission.allowed_roles,
            settings.admin_only_features,
            settings.disabled_features
       FROM enterprise_team_members member
       JOIN creatorhub_enterprise_entitlements entitlement
         ON entitlement.organization_id = member.organization_id
       LEFT JOIN enterprise_feature_permissions permission
         ON permission.organization_id = member.organization_id
        AND permission.feature_id = $2
       LEFT JOIN enterprise_organization_settings settings
         ON settings.organization_id = member.organization_id
      WHERE member.status = 'active'
        AND member.org_kind = 'enterprise'
        AND member.user_id = $1
        AND ($3::text IS NULL OR member.organization_id = $3)`,
    [input.userId, input.featureId, input.organizationId || null],
  );

  const byOrganization = new Map<string, any>();
  for (const row of memberships.rows) {
    const organizationId = String(row.organization_id || "");
    if (!organizationId) continue;
    const existing = byOrganization.get(organizationId);
    if (!existing || strength(String(row.role)) > strength(String(existing.role))) {
      byOrganization.set(organizationId, row);
    }
  }
  if (byOrganization.size === 0) {
    throw new CreatorHubEnterpriseAccessError(
      403,
      "enterprise_required",
      "Denne funksjonen krever et aktivt CreatorHub Enterprise-medlemskap.",
    );
  }
  if (byOrganization.size !== 1) {
    throw new CreatorHubEnterpriseAccessError(
      409,
      "enterprise_organization_required",
      "Velg hvilken Enterprise-organisasjon som skal brukes.",
    );
  }

  const row = [...byOrganization.values()][0];
  const organizationId = String(row.organization_id);
  const role = String(row.role) as CreatorHubEnterpriseAccess["role"];
  const status = String(row.entitlement_status || "");
  const validUntil = row.valid_until ? new Date(row.valid_until) : null;
  if (
    !["active", "grace"].includes(status) ||
    (validUntil && Number.isFinite(validUntil.getTime()) && validUntil.getTime() <= Date.now())
  ) {
    throw new CreatorHubEnterpriseAccessError(
      403,
      "enterprise_entitlement_inactive",
      "Enterprise-abonnementet er ikke aktivt.",
    );
  }

  const disabled = parseStrings(row.disabled_features).includes(input.featureId);
  const adminOnly = parseStrings(row.admin_only_features).includes(input.featureId);
  const permissionLevel = String(row.permission_level || "").toLowerCase();
  const allowedRoles = parseStrings(row.allowed_roles).map((value) => value.toLowerCase());
  const policyAllows = permissionLevel === "all"
    || (permissionLevel === "admin_only" && role === "admin")
    || (permissionLevel === "admin_member" && ["admin", "member"].includes(role))
    || (permissionLevel === "custom" && allowedRoles.includes(role));
  if (disabled || (adminOnly && role !== "admin") || !policyAllows) {
    throw new CreatorHubEnterpriseAccessError(
      403,
      "enterprise_feature_denied",
      "Organisasjonens tilgangsregler gir ikke tilgang til funksjonen.",
    );
  }

  return {
    organizationId,
    userId: input.userId,
    role,
    featureId: input.featureId,
    canRead: true,
    canWrite: role === "admin" || role === "member",
    canAdminister: role === "admin",
  };
}

/**
 * Resolve an Enterprise feature for a user who has already been verified as
 * an active member of one concrete project. The project's bound organization
 * pays for the feature, while the delegated caller is deliberately limited to
 * the ordinary `member` policy level. This does not grant organization-wide
 * access and must only be used after a server-side project membership check.
 */
export async function resolveCreatorHubDelegatedProjectAccess(
  db: Queryer,
  input: {
    userId: string;
    organizationId: string;
    featureId: CreatorHubEnterpriseFeatureId;
  },
): Promise<CreatorHubEnterpriseAccess> {
  const result = await db.query(
    `SELECT entitlement.status AS entitlement_status,
            entitlement.valid_until,
            permission.permission_level,
            permission.allowed_roles,
            settings.admin_only_features,
            settings.disabled_features
       FROM creatorhub_enterprise_entitlements entitlement
       LEFT JOIN enterprise_feature_permissions permission
         ON permission.organization_id=entitlement.organization_id
        AND permission.feature_id=$2
       LEFT JOIN enterprise_organization_settings settings
         ON settings.organization_id=entitlement.organization_id
      WHERE entitlement.organization_id=$1
      LIMIT 1`,
    [input.organizationId, input.featureId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new CreatorHubEnterpriseAccessError(
      403,
      "enterprise_required",
      "Prosjektet krever et aktivt CreatorHub Enterprise-abonnement.",
    );
  }

  const status = String(row.entitlement_status || "");
  const validUntil = row.valid_until ? new Date(row.valid_until) : null;
  if (
    !["active", "grace"].includes(status)
    || (validUntil && Number.isFinite(validUntil.getTime()) && validUntil.getTime() <= Date.now())
  ) {
    throw new CreatorHubEnterpriseAccessError(
      403,
      "enterprise_entitlement_inactive",
      "Enterprise-abonnementet er ikke aktivt.",
    );
  }

  const role = "member" as const;
  const disabled = parseStrings(row.disabled_features).includes(input.featureId);
  const adminOnly = parseStrings(row.admin_only_features).includes(input.featureId);
  const permissionLevel = String(row.permission_level || "").toLowerCase();
  const allowedRoles = parseStrings(row.allowed_roles).map((value) => value.toLowerCase());
  const policyAllows = permissionLevel === "all"
    || permissionLevel === "admin_member"
    || (permissionLevel === "custom" && allowedRoles.includes(role));
  if (disabled || adminOnly || !policyAllows) {
    throw new CreatorHubEnterpriseAccessError(
      403,
      "enterprise_feature_denied",
      "Organisasjonens tilgangsregler gir ikke tilgang til funksjonen.",
    );
  }

  return {
    organizationId: input.organizationId,
    userId: input.userId,
    role,
    featureId: input.featureId,
    canRead: true,
    canWrite: true,
    canAdminister: false,
  };
}

export function sendCreatorHubEnterpriseError(res: any, error: unknown): void {
  if (error instanceof CreatorHubEnterpriseAccessError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }
  const known = error as { statusCode?: unknown; code?: unknown; message?: unknown };
  if (
    Number.isInteger(known?.statusCode) &&
    typeof known.code === "string" &&
    typeof known.message === "string"
  ) {
    res.status(Number(known.statusCode)).json({ error: known.code, message: known.message });
    return;
  }
  console.error("[creatorhub-enterprise] request failed", {
    code: (error as { code?: string })?.code || "unknown",
  });
  res.status(500).json({ error: "enterprise_operation_unavailable", message: "Forespørselen kunne ikke behandles." });
}
