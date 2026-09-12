export type EnterpriseFeaturePermissionLevel =
  | "all"
  | "admin_only"
  | "admin_member"
  | "disabled";

export interface EnterpriseFeaturePermission {
  featureId: string;
  permissionLevel: EnterpriseFeaturePermissionLevel;
  allowedRoles: string[];
}

export interface EnterpriseFeaturePermissionState {
  adminOnlyFeatures: string[];
  disabledFeatures: string[];
  customPermissions: Record<string, EnterpriseFeaturePermission>;
}

const ALLOWED_ROLES: Record<"all" | "admin_member", string[]> = {
  all: ["admin", "member", "viewer"],
  admin_member: ["admin", "member"],
};

/**
 * Apply one permission transition using the precedence enforced by the
 * Enterprise backend: disabled, admin-only, custom, then the persisted
 * per-feature fallback. Every transition removes obsolete overrides first.
 * `all` is persisted explicitly so a restrictive row-level fallback cannot
 * contradict the selection shown in the UI.
 */
export function transitionEnterpriseFeaturePermission(
  state: EnterpriseFeaturePermissionState,
  featureId: string,
  level: EnterpriseFeaturePermissionLevel,
): EnterpriseFeaturePermissionState {
  const adminOnlyFeatures = state.adminOnlyFeatures.filter(
    (candidate) => candidate !== featureId,
  );
  const disabledFeatures = state.disabledFeatures.filter(
    (candidate) => candidate !== featureId,
  );
  const customPermissions = { ...state.customPermissions };
  delete customPermissions[featureId];

  if (level === "admin_only") {
    adminOnlyFeatures.push(featureId);
  } else if (level === "disabled") {
    disabledFeatures.push(featureId);
  } else {
    customPermissions[featureId] = {
      featureId,
      permissionLevel: level,
      allowedRoles: [...ALLOWED_ROLES[level]],
    };
  }

  return { adminOnlyFeatures, disabledFeatures, customPermissions };
}

/** Enterprise permission management includes enabled features and optional
 * Enterprise features. Optional non-Enterprise add-ons remain outside this
 * organization policy panel. */
export function getConfigurableEnterpriseFeatures<
  T extends { enabled?: boolean; plan?: string },
>(features: readonly T[]): T[] {
  return features.filter(
    (feature) => feature.enabled !== false || feature.plan === "enterprise",
  );
}
