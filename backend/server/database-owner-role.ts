import type { Pool } from "pg";

export const EXPECTED_DATABASE_LOGIN_ROLE = "creatorhub_runtime_login";
export const EXPECTED_DATABASE_OWNER_ROLE = "creatorhub_schema_owner";
const EXPECTED_DATABASE_OWNER_ADMIN_ROLE = "neondb_owner";
const EXPECTED_DATABASE_MIGRATION_LOGIN_ROLE = "creatorhub_migration_login";
const EXPECTED_DATABASE_STATEMENT_TIMEOUT = "30s";

type DatabaseRoleEnvironment = NodeJS.ProcessEnv;

type DatabaseIdentityRow = {
  session_user: string;
  current_user: string;
  statement_timeout: string;
  runtime_role_setting_count: number;
  exact_runtime_role_setting_count: number;
  runtime_timeout_setting_count: number;
  exact_runtime_timeout_setting_count: number;
  login_can_login: boolean;
  login_inherits: boolean;
  login_is_superuser: boolean;
  login_can_create_role: boolean;
  login_can_create_database: boolean;
  login_can_replicate: boolean;
  login_bypasses_rls: boolean;
  owner_can_login: boolean;
  owner_inherits: boolean;
  owner_is_superuser: boolean;
  owner_can_create_role: boolean;
  owner_can_create_database: boolean;
  owner_can_replicate: boolean;
  owner_bypasses_rls: boolean;
  login_membership_count: number;
  exact_owner_membership_count: number;
  owner_membership_count: number;
  owner_direct_member_count: number;
  owner_admin_grant_count: number;
  owner_admin_creator_grant_count: number;
  owner_admin_member_count: number;
  owner_migration_member_count: number;
  owner_runtime_member_count: number;
};

function productionRuntime(env: DatabaseRoleEnvironment): boolean {
  return env.NODE_ENV === "production" || env.RENDER === "true";
}

export function expectedDatabaseRoles(
  env: DatabaseRoleEnvironment = process.env,
): { loginRole: string; ownerRole: string } | null {
  const loginRole = String(env.DATABASE_LOGIN_ROLE ?? "").trim();
  const ownerRole = String(env.DATABASE_OWNER_ROLE ?? "").trim();
  const configured = Boolean(loginRole || ownerRole);

  if (!configured && !productionRuntime(env)) return null;
  if (!loginRole || !ownerRole) {
    throw new Error(
      "DATABASE_LOGIN_ROLE and DATABASE_OWNER_ROLE must both be configured",
    );
  }
  if (loginRole !== EXPECTED_DATABASE_LOGIN_ROLE) {
    throw new Error(
      "DATABASE_LOGIN_ROLE must be exactly " + EXPECTED_DATABASE_LOGIN_ROLE,
    );
  }
  if (ownerRole !== EXPECTED_DATABASE_OWNER_ROLE) {
    throw new Error(
      "DATABASE_OWNER_ROLE must be exactly " + EXPECTED_DATABASE_OWNER_ROLE,
    );
  }
  return { loginRole, ownerRole };
}

/**
 * Verify the database-bound default role before any runtime schema guard runs.
 * The bootstrap owns the ALTER ROLE ... IN DATABASE SET role configuration;
 * the application only checks that every production start received it.
 */
export async function verifyDatabaseOwnerSession(
  pool: Pick<Pool, "query">,
  env: DatabaseRoleEnvironment = process.env,
): Promise<void> {
  const expected = expectedDatabaseRoles(env);
  if (!expected) return;

  const result = await pool.query<DatabaseIdentityRow>(
    `SELECT
       session_user::text AS session_user,
       current_user::text AS current_user,
       current_setting('statement_timeout')::text AS statement_timeout,
       runtime_settings.role_setting_count AS runtime_role_setting_count,
       runtime_settings.exact_role_setting_count AS exact_runtime_role_setting_count,
       runtime_settings.timeout_setting_count AS runtime_timeout_setting_count,
       runtime_settings.exact_timeout_setting_count AS exact_runtime_timeout_setting_count,
       login.rolcanlogin AS login_can_login,
       login.rolinherit AS login_inherits,
       login.rolsuper AS login_is_superuser,
       login.rolcreaterole AS login_can_create_role,
       login.rolcreatedb AS login_can_create_database,
       login.rolreplication AS login_can_replicate,
       login.rolbypassrls AS login_bypasses_rls,
       owner.rolcanlogin AS owner_can_login,
       owner.rolinherit AS owner_inherits,
       owner.rolsuper AS owner_is_superuser,
       owner.rolcreaterole AS owner_can_create_role,
       owner.rolcreatedb AS owner_can_create_database,
       owner.rolreplication AS owner_can_replicate,
       owner.rolbypassrls AS owner_bypasses_rls,
       (
         SELECT COUNT(*)::integer
         FROM pg_catalog.pg_auth_members AS membership
         WHERE membership.member = login.oid
       ) AS login_membership_count,
       (
         SELECT COUNT(*)::integer
         FROM pg_catalog.pg_auth_members AS membership
         WHERE membership.member = login.oid
           AND membership.roleid = owner.oid
           AND membership.admin_option = FALSE
           AND membership.inherit_option = FALSE
           AND membership.set_option = TRUE
       ) AS exact_owner_membership_count,
       (
         SELECT COUNT(*)::integer
         FROM pg_catalog.pg_auth_members AS membership
         WHERE membership.member = owner.oid
       ) AS owner_membership_count,
       owner_members.owner_direct_member_count,
       owner_members.owner_admin_grant_count,
       owner_members.owner_admin_creator_grant_count,
       owner_members.owner_admin_member_count,
       owner_members.owner_migration_member_count,
       owner_members.owner_runtime_member_count
     FROM pg_catalog.pg_roles AS login
     CROSS JOIN pg_catalog.pg_roles AS owner
     CROSS JOIN LATERAL (
       SELECT
         COUNT(*)::integer AS owner_direct_member_count,
         COUNT(*) FILTER (
           WHERE member_role.rolname = $3
         )::integer AS owner_admin_grant_count,
         COUNT(*) FILTER (
           WHERE member_role.rolname = $3
             AND membership.admin_option = TRUE
             AND membership.inherit_option = FALSE
             AND membership.set_option = FALSE
         )::integer AS owner_admin_creator_grant_count,
         COUNT(*) FILTER (
           WHERE member_role.rolname = $3
             AND membership.admin_option = FALSE
             AND membership.inherit_option = FALSE
             AND membership.set_option = TRUE
         )::integer AS owner_admin_member_count,
         COUNT(*) FILTER (
           WHERE member_role.rolname = $4
             AND membership.admin_option = FALSE
             AND membership.inherit_option = FALSE
             AND membership.set_option = TRUE
         )::integer AS owner_migration_member_count,
         COUNT(*) FILTER (
           WHERE member_role.rolname = $5
             AND membership.admin_option = FALSE
             AND membership.inherit_option = FALSE
             AND membership.set_option = TRUE
         )::integer AS owner_runtime_member_count
       FROM pg_catalog.pg_auth_members AS membership
       JOIN pg_catalog.pg_roles AS member_role
         ON member_role.oid = membership.member
       WHERE membership.roleid = owner.oid
     ) AS owner_members
     CROSS JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (
           WHERE configured.setting LIKE 'role=%'
         )::integer AS role_setting_count,
         COUNT(*) FILTER (
           WHERE configured.setting = 'role=' || $2::text
         )::integer AS exact_role_setting_count,
         COUNT(*) FILTER (
           WHERE configured.setting LIKE 'statement_timeout=%'
         )::integer AS timeout_setting_count,
         COUNT(*) FILTER (
           WHERE configured.setting = 'statement_timeout=' || $6::text
         )::integer AS exact_timeout_setting_count
       FROM pg_catalog.pg_db_role_setting AS role_setting
       JOIN pg_catalog.pg_database AS database_entry
         ON database_entry.oid = role_setting.setdatabase
       CROSS JOIN LATERAL unnest(role_setting.setconfig) AS configured(setting)
       WHERE role_setting.setrole = login.oid
         AND database_entry.datname = current_database()
     ) AS runtime_settings
     WHERE login.rolname = $1
       AND owner.rolname = $2`,
    [
      expected.loginRole,
      expected.ownerRole,
      EXPECTED_DATABASE_OWNER_ADMIN_ROLE,
      EXPECTED_DATABASE_MIGRATION_LOGIN_ROLE,
      EXPECTED_DATABASE_LOGIN_ROLE,
      EXPECTED_DATABASE_STATEMENT_TIMEOUT,
    ],
  );
  const identity = result.rows[0];
  if (!identity) {
    throw new Error("Database owner role does not exist");
  }
  if (identity.session_user !== expected.loginRole) {
    throw new Error("Unexpected database session_user");
  }
  if (identity.current_user !== expected.ownerRole) {
    throw new Error(
      "Database default role is not active; ownership-safe boot refused",
    );
  }
  if (identity.statement_timeout !== EXPECTED_DATABASE_STATEMENT_TIMEOUT) {
    throw new Error("Database statement_timeout is not active");
  }
  if (
    identity.runtime_role_setting_count !== 1 ||
    identity.exact_runtime_role_setting_count !== 1 ||
    identity.runtime_timeout_setting_count !== 1 ||
    identity.exact_runtime_timeout_setting_count !== 1
  ) {
    throw new Error("Database-bound runtime settings are not exact");
  }
  if (
    !identity.login_can_login ||
    identity.login_inherits ||
    identity.login_is_superuser ||
    identity.login_can_create_role ||
    identity.login_can_create_database ||
    identity.login_can_replicate ||
    identity.login_bypasses_rls
  ) {
    throw new Error("Database login role has unsafe role attributes");
  }
  if (
    identity.owner_can_login ||
    identity.owner_inherits ||
    identity.owner_is_superuser ||
    identity.owner_can_create_role ||
    identity.owner_can_create_database ||
    identity.owner_can_replicate ||
    identity.owner_bypasses_rls
  ) {
    throw new Error("Database owner role has unsafe role attributes");
  }
  if (
    identity.login_membership_count !== 1 ||
    identity.exact_owner_membership_count !== 1
  ) {
    throw new Error(
      "Database login must have exactly one non-inheriting SET membership in the schema owner",
    );
  }
  if (identity.owner_membership_count !== 0) {
    throw new Error("Database owner role must not be a member of another role");
  }
  if (
    identity.owner_direct_member_count !== 4 ||
    identity.owner_admin_grant_count !== 2 ||
    identity.owner_admin_creator_grant_count !== 1 ||
    identity.owner_admin_member_count !== 1 ||
    identity.owner_migration_member_count !== 1 ||
    identity.owner_runtime_member_count !== 1
  ) {
    throw new Error(
      "Database owner role has unexpected direct members or membership options",
    );
  }
}
