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
