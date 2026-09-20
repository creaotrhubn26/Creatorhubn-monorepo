/**
 * Shared ownership guard for casting sub-resources.
 *
 * Casting projects live in the `legacy_compat_store` compat table under the
 * key `casting:project:<id>`, with the owner in the project JSON's
 * `created_by`. Only `GET /api/casting/projects/:id` enforced this; every
 * child resource (props, production days, audition videos, calendar events,
 * offers, contracts, manuscripts) queried purely by caller-supplied id with
 * no owner check — an authenticated cross-tenant IDOR. This module centralises
 * the check so every route resolves ownership the same way.
 *
 * Fail-closed: any read failure (missing table, DB down, missing/`demo-user`/
 * null `created_by`) resolves to "not owner", matching the project-level GET
 * which already treats those as inaccessible.
 */

const LEGACY_COMPAT_TABLE_NAME = "legacy_compat_store";

interface QueryablePool {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

/**
 * Every operational grant the canonical project surface knows about.
 *
 * A grant is held when the member's project role carries it by default, or
 * when the membership row lists it explicitly in `permissions`. The project
 * creator holds all of them. Keeping the rules here — rather than repeated in
 * one hand-written SQL predicate per grant — means a route asks for effective
 * access once and every API answers from the same resolution.
 */
export const CASTING_GRANT_RULES = {
  canEditCasting: {
    roles: [
      "director",
      "producer",
      "casting_director",
      "local_casting_director",
      "extras_casting_director",
    ],
    permissionKeys: ["canEditCasting"],
  },
  canEditProduction: {
    roles: [
      "director",
      "producer",
      "line_producer",
      "production_manager",
      "content_producer",
      "first_ad",
      "first_assistant_director",
      "1st_ad",
      "second_ad",
      "second_assistant_director",
      "2nd_ad",
      "second_second_assistant_director",
      "2nd_2nd_ad",
    ],
    permissionKeys: ["canEditProduction"],
  },
  canManageProduction: {
    roles: ["producer", "line_producer", "production_manager"],
    permissionKeys: ["canManageProduction"],
  },
  canCoordinateProduction: {
    roles: [
      "producer",
      "line_producer",
      "production_manager",
      "production_coordinator",
      "production_secretary",
      "office_production_assistant",
      "office_pa",
      "production_assistant",
    ],
    permissionKeys: ["canCoordinateProduction"],
  },
  canManageLocations: {
    roles: ["producer", "line_producer", "production_manager", "location_manager", "location_scout"],
    permissionKeys: ["canManageLocations"],
  },
  canManageContinuity: {
    roles: ["script_supervisor"],
    permissionKeys: ["canManageContinuity"],
  },
  canCommentContinuity: {
    roles: [
      "script_supervisor",
      "director",
      "producer",
      "first_ad",
      "first_assistant_director",
      "1st_ad",
      "second_ad",
      "second_assistant_director",
      "2nd_ad",
      "second_second_assistant_director",
      "2nd_2nd_ad",
      "set_production_assistant",
      "set_pa",
    ],
    permissionKeys: ["canManageContinuity", "canComment"],
  },
  canManageArtDepartment: {
    roles: [
      "production_designer",
      "set_designer",
      "concept_illustrator",
      "storyboard_artist",
      "set_decorator",
      "on_set_dresser",
      "greensperson",
      "property_master",
      "assistant_property_master",
      "costume_designer",
      "wardrobe_supervisor",
      "key_hair_stylist",
      "key_makeup_artist",
      "construction_coordinator",
    ],
    permissionKeys: ["canManageArtDepartment"],
  },
} as const satisfies Record<string, { roles: readonly string[]; permissionKeys: readonly string[] }>;

export type CastingGrant = keyof typeof CASTING_GRANT_RULES;

export const CASTING_GRANTS = Object.keys(CASTING_GRANT_RULES) as CastingGrant[];

export interface CastingProjectAccess {
  /** The project exists in the canonical `casting_projects` table. */
  readonly projectExists: boolean;
  /** Resolved through the legacy compat store instead of the canonical table. */
  readonly legacyFallback: boolean;
  readonly isOwner: boolean;
  /** Has an active, unexpired membership row. */
  readonly isMember: boolean;
  /** Primary project role, lowercased. `null` for owners without a row. */
  readonly role: string | null;
  /**
   * Every crew role the member holds on this project: the primary role first,
   * then `additional_roles`. Grants are the union across all of them.
   */
  readonly roles: readonly string[];
  /** Explicit grants from the membership row, verbatim. */
  readonly permissions: Record<string, unknown>;
  readonly canAccess: boolean;
  readonly grants: Readonly<Record<CastingGrant, boolean>>;
}

const DENIED_ACCESS: CastingProjectAccess = {
  projectExists: false,
  legacyFallback: false,
  isOwner: false,
  isMember: false,
  role: null,
  roles: Object.freeze([]) as readonly string[],
  permissions: {},
  canAccess: false,
  grants: Object.freeze(
    Object.fromEntries(CASTING_GRANTS.map((grant) => [grant, false])),
  ) as Record<CastingGrant, boolean>,
};

function hasExplicitGrant(
  permissions: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.some((key) => permissions[key] === true);
}

function deriveGrants(
  isOwner: boolean,
  roles: readonly string[],
  permissions: Record<string, unknown>,
): Record<CastingGrant, boolean> {
  const grants = {} as Record<CastingGrant, boolean>;
  for (const grant of CASTING_GRANTS) {
    const rule = CASTING_GRANT_RULES[grant];
    grants[grant] = isOwner
      || roles.some((role) => (rule.roles as readonly string[]).includes(role))
      || hasExplicitGrant(permissions, rule.permissionKeys);
  }
  return grants;
}

/** Normalise one stored role value; returns null for anything unusable. */
function readRole(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalised = value.trim().toLowerCase();
  return normalised.length > 0 ? normalised : null;
}

/**
 * The member's full role set: primary first, then additional_roles, deduped.
 *
 * Without a primary role there is no active membership row, so additional
 * roles are ignored — otherwise a lapsed member's leftover array would still
 * grant access.
 */
function readRoles(primary: string | null, additional: unknown): string[] {
  if (!primary) return [];
  const roles = [primary];
  if (Array.isArray(additional)) {
    for (const entry of additional) {
      const role = readRole(entry);
      if (role && !roles.includes(role)) roles.push(role);
    }
  }
  return roles;
}

function readPermissions(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/**
 * Resolve the caller's effective role and every operational grant in a single
 * round trip.
 *
 * Routes used to ask one question per grant, each its own query with its own
 * copy of the role list. This is the one resolver they all share: the same
 * membership row decides every answer, so a route can no longer see a member
 * as a coordinator for one check and a stranger for the next.
 *
 * Fail-closed. A canonical project that denies access never falls back to
 * legacy ownership; only a project missing from `casting_projects` does.
 */
export async function resolveCastingProjectAccess(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<CastingProjectAccess> {
  if (!projectId || !userId) return DENIED_ACCESS;
  try {
    const result = await pool.query(
      `SELECT
         EXISTS (
           SELECT 1
             FROM casting_projects cp
            WHERE cp.id = $1
         ) AS project_exists,
         EXISTS (
           SELECT 1
             FROM casting_projects cp
            WHERE cp.id = $1
              AND cp.created_by = $2
         ) AS is_owner,
         (
           SELECT LOWER(TRIM(cur.role))
             FROM casting_user_roles cur
            WHERE cur.project_id = $1
              AND cur.user_id = $2
              AND cur.deactivated_at IS NULL
              AND (cur.expires_at IS NULL OR cur.expires_at > NOW())
            LIMIT 1
         ) AS member_role,
         (
           SELECT cur.permissions
             FROM casting_user_roles cur
            WHERE cur.project_id = $1
              AND cur.user_id = $2
              AND cur.deactivated_at IS NULL
              AND (cur.expires_at IS NULL OR cur.expires_at > NOW())
            LIMIT 1
         ) AS member_permissions,
         (
           SELECT cur.additional_roles
             FROM casting_user_roles cur
            WHERE cur.project_id = $1
              AND cur.user_id = $2
              AND cur.deactivated_at IS NULL
              AND (cur.expires_at IS NULL OR cur.expires_at > NOW())
            LIMIT 1
         ) AS member_additional_roles`,
      [projectId, userId],
    );
    const row = result.rows[0];
    if (row?.project_exists === true) {
      const isOwner = row.is_owner === true;
      const role = readRole(row.member_role);
      const roles = readRoles(role, row.member_additional_roles);
      const isMember = role !== null;
      const permissions = readPermissions(row.member_permissions);
      return {
        projectExists: true,
        legacyFallback: false,
        isOwner,
        isMember,
        role,
        roles,
        permissions,
        canAccess: isOwner || isMember,
        grants: deriveGrants(isOwner, roles, permissions),
      };
    }
  } catch {
    // A legacy-only install may not have the canonical tables yet. The
    // compat-store check below remains fail-closed and owner-only.
  }

  const ownsLegacy = await userOwnsCastingProject(pool, projectId, userId);
  if (!ownsLegacy) return DENIED_ACCESS;
  return {
    projectExists: false,
    legacyFallback: true,
    isOwner: true,
    isMember: false,
    role: null,
    roles: [],
    permissions: {},
    canAccess: true,
    grants: deriveGrants(true, [], {}),
  };
}

/**
 * True when the user can open a canonical Role Room project, either as its
 * creator or through an explicit project-role membership. Storyboard Room
 * reads manuscripts from the legacy casting surface, but its project browser
 * reads the canonical `casting_projects` table. Keeping this check here makes
 * those two API surfaces share the same tenant boundary.
 *
 * Legacy projects that have not been mirrored to `casting_projects` still use
 * the strict compat-store owner check as a fallback.
 */
export async function userCanAccessCastingProject(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  const access = await resolveCastingProjectAccess(pool, projectId, userId);
  return access.canAccess;
}

/**
 * True when the user may mutate production-day data for a canonical project.
 *
 * Project membership alone is deliberately not enough: the member must either
 * have an explicit `canEditProduction` grant or one of the production-owner
 * roles whose default contract includes that grant. Expired/deactivated rows
 * are ignored. Legacy-only projects remain owner-only.
 */
export async function userCanEditCastingProduction(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  const access = await resolveCastingProjectAccess(pool, projectId, userId);
  return access.grants.canEditProduction;
}

/** True when the caller owns the casting lane: roles, candidates and auditions. */
export async function userCanEditCasting(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  const access = await resolveCastingProjectAccess(pool, projectId, userId);
  return access.grants.canEditCasting;
}

/**
 * True when the user owns the operational production-management lane.
 * AD roles may edit the shared production day, but must not be able to alter
 * the production manager's approvals, cost deviations or audit trail.
 */
export async function userCanManageCastingProduction(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  const access = await resolveCastingProjectAccess(pool, projectId, userId);
  return access.grants.canManageProduction;
}

/**
 * True when the user owns the coordination lane. The coordinator keeps its own
 * version and audit trail, so production editors do not implicitly inherit it.
 */
export async function userCanCoordinateCastingProduction(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  const access = await resolveCastingProjectAccess(pool, projectId, userId);
  return access.grants.canCoordinateProduction;
}

/**
 * True when the user may mutate location operations. Location security is
 * deliberately absent: that role reads the location lane without writing it.
 */
export async function userCanManageCastingLocations(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  const access = await resolveCastingProjectAccess(pool, projectId, userId);
  return access.grants.canManageLocations;
}

/**
 * True when the user may write the continuity lane: take logs, lined-script
 * discrepancies and revisions.
 */
export async function userCanManageCastingContinuity(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  const access = await resolveCastingProjectAccess(pool, projectId, userId);
  return access.grants.canManageContinuity;
}

/**
 * True when the user may comment on the continuity lane. Commenting is broader
 * than managing: directors and ADs discuss continuity without owning it.
 */
export async function userCanCommentCastingContinuity(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  const access = await resolveCastingProjectAccess(pool, projectId, userId);
  return access.grants.canCommentContinuity;
}

/** Returns the owning user id for a casting project, or null if unknown. */
export async function getCastingProjectOwner(
  pool: QueryablePool,
  projectId: string,
): Promise<string | null> {
  if (!projectId) return null;
  try {
    const result = await pool.query(
      `SELECT store_value FROM ${LEGACY_COMPAT_TABLE_NAME} WHERE store_key = $1 LIMIT 1`,
      [`casting:project:${projectId}`],
    );
    const value = result.rows?.[0]?.store_value as
      | Record<string, unknown>
      | undefined;
    const createdBy =
      value && typeof value === "object" ? value.created_by : null;
    return typeof createdBy === "string" ? createdBy : null;
  } catch {
    return null;
  }
}

/**
 * True when `userId` owns `projectId`. Placeholder/demo owners never match.
 * Use as the authorization gate before reading or mutating a project's
 * sub-resources.
 */
export async function userOwnsCastingProject(
  pool: QueryablePool,
  projectId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const owner = await getCastingProjectOwner(pool, projectId);
  return Boolean(owner) && owner !== "demo-user" && owner === userId;
}

type CompatStoreGet = <T>(storeKey: string) => Promise<T | null>;

/**
 * Same ownership gate for route modules that receive the injected
 * `compatStoreGet` accessor instead of a raw pool. Resolves the project the
 * same way (`casting:project:<id>` → `created_by`) and is equally fail-closed.
 */
export async function userOwnsCastingProjectViaStore(
  compatStoreGet: CompatStoreGet,
  projectId: string | null | undefined,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId || !projectId) return false;
  try {
    const project = await compatStoreGet<{ created_by?: unknown }>(
      `casting:project:${projectId}`,
    );
    const createdBy =
      project && typeof project === "object" ? project.created_by : null;
    return (
      typeof createdBy === "string" &&
      createdBy !== "demo-user" &&
      createdBy === userId
    );
  } catch {
    return false;
  }
}
