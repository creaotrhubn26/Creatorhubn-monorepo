#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const OWNER_LOGIN_ROLE = "neondb_owner";
const MIGRATOR_LOGIN_ROLE = "creatorhub_migrator";
const MIGRATION_LOGIN_ROLE = "creatorhub_migration_login";
const RUNTIME_LOGIN_ROLE = "creatorhub_runtime_login";
const SCHEMA_OWNER_ROLE = "creatorhub_schema_owner";
const APPLICATION_SCHEMA = "public";
const LOCK_NAMESPACE = "creatorhub";
const LOCK_NAME = "production-migrations";
const MIN_POSTGRES_18 = 180000;
const MAX_POSTGRES_18 = 190000;
const STATEMENT_BATCH_SIZE = 100;
const RUNTIME_STATEMENT_TIMEOUT = "30s";
const ALLOWED_POSTGRES_TLS_MODES = new Set([
  "require",
  "verify-ca",
  "verify-full",
]);
const NEON_ENDPOINT_LABEL = /^ep-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const OWNER_URL_ENV = "OWNERSHIP_ADMIN_DATABASE_URL";
const MIGRATOR_URL_ENV = "OWNERSHIP_LEGACY_MIGRATOR_DATABASE_URL";
const MIGRATION_URL_ENV = "OWNERSHIP_NEW_MIGRATION_DATABASE_URL";
const RUNTIME_URL_ENV = "OWNERSHIP_NEW_RUNTIME_POOLED_DATABASE_URL";
const CONFIRM_HOST_ENV = "OWNERSHIP_CONFIRM_HOST";

const SESSION_IDENTITY_SQL = `
  SELECT
    session_user::text AS session_user,
    current_user::text AS current_user,
    current_database()::text AS database_name,
    current_setting('statement_timeout')::text AS statement_timeout,
    current_setting('server_version_num')::integer AS server_version_num,
    current_setting('server_version')::text AS server_version
`;

const TARGET_ROLE_SQL = `
  SELECT
    rolname,
    rolcanlogin,
    rolinherit,
    rolsuper,
    rolcreaterole,
    rolcreatedb,
    rolreplication,
    rolbypassrls
  FROM pg_catalog.pg_roles
  WHERE rolname = $1::text
`;

const TARGET_MEMBER_OF_SQL = `
  SELECT granted_role.rolname AS granted_role
  FROM pg_catalog.pg_auth_members AS membership
  JOIN pg_catalog.pg_roles AS member_role
    ON member_role.oid = membership.member
  JOIN pg_catalog.pg_roles AS granted_role
    ON granted_role.oid = membership.roleid
  WHERE member_role.rolname = $1::text
  ORDER BY granted_role.rolname
`;

const LOGIN_MEMBERSHIPS_SQL = `
  SELECT
    granted_role.rolname AS granted_role,
    grantor_role.rolname AS grantor_role,
    membership.admin_option,
    membership.inherit_option,
    membership.set_option
  FROM pg_catalog.pg_auth_members AS membership
  JOIN pg_catalog.pg_roles AS member_role
    ON member_role.oid = membership.member
  JOIN pg_catalog.pg_roles AS granted_role
    ON granted_role.oid = membership.roleid
  JOIN pg_catalog.pg_roles AS grantor_role
    ON grantor_role.oid = membership.grantor
  WHERE member_role.rolname = $1::text
  ORDER BY granted_role.rolname, grantor_role.rolname
`;

const TARGET_MEMBERS_SQL = `
  SELECT
    member_role.rolname AS member_name,
    bool_or(membership.admin_option) AS admin_option,
    bool_or(membership.inherit_option) AS inherit_option,
    bool_or(membership.set_option) AS set_option,
    COUNT(*)::integer AS grant_count,
    COUNT(*) FILTER (
      WHERE membership.admin_option = TRUE
        AND membership.inherit_option = FALSE
        AND membership.set_option = FALSE
    )::integer AS admin_only_grant_count,
    COUNT(*) FILTER (
      WHERE membership.admin_option = FALSE
        AND membership.inherit_option = FALSE
        AND membership.set_option = TRUE
    )::integer AS set_only_grant_count
  FROM pg_catalog.pg_auth_members AS membership
  JOIN pg_catalog.pg_roles AS granted_role
    ON granted_role.oid = membership.roleid
  JOIN pg_catalog.pg_roles AS member_role
    ON member_role.oid = membership.member
  WHERE granted_role.rolname = $1::text
  GROUP BY member_role.rolname
  ORDER BY member_role.rolname
`;

const LOGIN_ROLES_SQL = `
  SELECT
    rolname,
    rolcanlogin,
    rolinherit,
    rolsuper,
    rolcreaterole,
    rolcreatedb,
    rolreplication,
    rolbypassrls
  FROM pg_catalog.pg_roles
  WHERE rolname = ANY($1::text[])
`;

const OWNERSHIP_AUDIT_SQL = `
  WITH application_objects AS (
    SELECT
      'relation'::text AS object_kind,
      relation.oid AS object_oid,
      namespace.nspname AS schema_name,
      relation.relname AS object_name,
      pg_catalog.pg_get_userbyid(relation.relowner) AS owner_name
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = $1::text
      AND relation.relkind IN ('r', 'p', 'f', 'v', 'm', 'S', 'i', 'I')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        WHERE dependency.classid = 'pg_catalog.pg_class'::regclass
          AND dependency.objid = relation.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
          AND dependency.deptype = 'e'
      )

    UNION ALL

    SELECT
      CASE routine.prokind
        WHEN 'p' THEN 'procedure'
        WHEN 'a' THEN 'aggregate'
        ELSE 'function'
      END AS object_kind,
      routine.oid AS object_oid,
      namespace.nspname AS schema_name,
      routine.proname || '(' ||
        pg_catalog.pg_get_function_identity_arguments(routine.oid) || ')' AS object_name,
      pg_catalog.pg_get_userbyid(routine.proowner) AS owner_name
    FROM pg_catalog.pg_proc AS routine
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname = $1::text
      AND routine.prokind IN ('f', 'p', 'a', 'w')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        WHERE dependency.classid = 'pg_catalog.pg_proc'::regclass
          AND dependency.objid = routine.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
          AND dependency.deptype = 'e'
      )

    UNION ALL

    SELECT
      'type'::text AS object_kind,
      type_entry.oid AS object_oid,
      namespace.nspname AS schema_name,
      type_entry.typname AS object_name,
      pg_catalog.pg_get_userbyid(type_entry.typowner) AS owner_name
    FROM pg_catalog.pg_type AS type_entry
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = type_entry.typnamespace
    LEFT JOIN pg_catalog.pg_class AS type_relation
      ON type_relation.oid = type_entry.typrelid
    WHERE namespace.nspname = $1::text
      AND (
        (
          type_entry.typrelid = 0
          AND (
            (type_entry.typtype = 'b' AND type_entry.typelem = 0)
            OR type_entry.typtype IN ('d', 'e', 'r', 'm')
          )
        )
        OR (type_entry.typtype = 'c' AND type_relation.relkind = 'c')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        WHERE dependency.classid = 'pg_catalog.pg_type'::regclass
          AND dependency.objid = type_entry.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
          AND dependency.deptype = 'e'
      )
  )
  SELECT
    object_kind,
    object_oid,
    schema_name,
    object_name,
    owner_name
  FROM application_objects
  ORDER BY object_kind, schema_name, object_name, object_oid
`;

const RELATION_TRANSFER_SQL = `
  SELECT
    relation.oid AS object_oid,
    'relation'::text AS catalog_kind,
    namespace.nspname || '.' || relation.relname AS object_identity,
    CASE relation.relkind
      WHEN 'r' THEN pg_catalog.format(
        'ALTER TABLE ONLY %I.%I OWNER TO %I',
        namespace.nspname,
        relation.relname,
        $2::text
      )
      WHEN 'p' THEN pg_catalog.format(
        'ALTER TABLE ONLY %I.%I OWNER TO %I',
        namespace.nspname,
        relation.relname,
        $2::text
      )
      WHEN 'f' THEN pg_catalog.format(
        'ALTER FOREIGN TABLE ONLY %I.%I OWNER TO %I',
        namespace.nspname,
        relation.relname,
        $2::text
      )
      WHEN 'v' THEN pg_catalog.format(
        'ALTER VIEW %I.%I OWNER TO %I',
        namespace.nspname,
        relation.relname,
        $2::text
      )
      WHEN 'm' THEN pg_catalog.format(
        'ALTER MATERIALIZED VIEW %I.%I OWNER TO %I',
        namespace.nspname,
        relation.relname,
        $2::text
      )
      WHEN 'S' THEN pg_catalog.format(
        'ALTER SEQUENCE %I.%I OWNER TO %I',
        namespace.nspname,
        relation.relname,
        $2::text
      )
    END AS ddl
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  JOIN pg_catalog.pg_roles AS owner_role
    ON owner_role.oid = relation.relowner
  WHERE namespace.nspname = $3::text
    AND owner_role.rolname = $1::text
    AND relation.relkind IN ('r', 'p', 'f', 'v', 'm', 'S')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_depend AS dependency
      WHERE dependency.classid = 'pg_catalog.pg_class'::regclass
        AND dependency.objid = relation.oid
        AND dependency.objsubid = 0
        AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
        AND dependency.deptype = 'e'
    )
  ORDER BY
    CASE relation.relkind
      WHEN 'p' THEN 1
      WHEN 'r' THEN 2
      WHEN 'f' THEN 3
      WHEN 'v' THEN 4
      WHEN 'm' THEN 5
      WHEN 'S' THEN 6
    END,
    relation.relispartition,
    namespace.nspname,
    relation.relname,
    relation.oid
`;

const ROUTINE_TRANSFER_SQL = `
  SELECT
    routine.oid AS object_oid,
    'routine'::text AS catalog_kind,
    namespace.nspname || '.' || routine.proname || '(' ||
      pg_catalog.pg_get_function_identity_arguments(routine.oid) || ')' AS object_identity,
    CASE routine.prokind
      WHEN 'p' THEN pg_catalog.format(
        'ALTER PROCEDURE %I.%I(%s) OWNER TO %I',
        namespace.nspname,
        routine.proname,
        pg_catalog.pg_get_function_identity_arguments(routine.oid),
        $2::text
      )
      WHEN 'a' THEN pg_catalog.format(
        'ALTER AGGREGATE %I.%I(%s) OWNER TO %I',
        namespace.nspname,
        routine.proname,
        pg_catalog.pg_get_function_identity_arguments(routine.oid),
        $2::text
      )
      ELSE pg_catalog.format(
        'ALTER FUNCTION %I.%I(%s) OWNER TO %I',
        namespace.nspname,
        routine.proname,
        pg_catalog.pg_get_function_identity_arguments(routine.oid),
        $2::text
      )
    END AS ddl
  FROM pg_catalog.pg_proc AS routine
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = routine.pronamespace
  JOIN pg_catalog.pg_roles AS owner_role
    ON owner_role.oid = routine.proowner
  WHERE namespace.nspname = $3::text
    AND owner_role.rolname = $1::text
    AND routine.prokind IN ('f', 'p', 'a', 'w')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_depend AS dependency
      WHERE dependency.classid = 'pg_catalog.pg_proc'::regclass
        AND dependency.objid = routine.oid
        AND dependency.objsubid = 0
        AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
        AND dependency.deptype = 'e'
    )
  ORDER BY namespace.nspname, routine.proname, routine.oid
`;

const TYPE_TRANSFER_SQL = `
  SELECT
    type_entry.oid AS object_oid,
    'type'::text AS catalog_kind,
    namespace.nspname || '.' || type_entry.typname AS object_identity,
    CASE type_entry.typtype
      WHEN 'd' THEN pg_catalog.format(
        'ALTER DOMAIN %I.%I OWNER TO %I',
        namespace.nspname,
        type_entry.typname,
        $2::text
      )
      ELSE pg_catalog.format(
        'ALTER TYPE %I.%I OWNER TO %I',
        namespace.nspname,
        type_entry.typname,
        $2::text
      )
    END AS ddl
  FROM pg_catalog.pg_type AS type_entry
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = type_entry.typnamespace
  JOIN pg_catalog.pg_roles AS owner_role
    ON owner_role.oid = type_entry.typowner
  LEFT JOIN pg_catalog.pg_class AS type_relation
    ON type_relation.oid = type_entry.typrelid
  WHERE namespace.nspname = $3::text
    AND owner_role.rolname = $1::text
    AND (
      (
        type_entry.typrelid = 0
        AND (
          (type_entry.typtype = 'b' AND type_entry.typelem = 0)
          OR type_entry.typtype IN ('d', 'e', 'r', 'm')
        )
      )
      OR (type_entry.typtype = 'c' AND type_relation.relkind = 'c')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_depend AS dependency
      WHERE dependency.classid = 'pg_catalog.pg_type'::regclass
        AND dependency.objid = type_entry.oid
        AND dependency.objsubid = 0
        AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
        AND dependency.deptype = 'e'
    )
  ORDER BY
    CASE type_entry.typtype
      WHEN 'm' THEN 1
      WHEN 'r' THEN 2
      ELSE 3
    END,
    namespace.nspname,
    type_entry.typname,
    type_entry.oid
`;

const OBJECT_OWNER_LOOKUP_SQL = Object.freeze({
  relation: `
    SELECT
      oid::text AS object_oid,
      pg_catalog.pg_get_userbyid(relowner) AS owner_name
    FROM pg_catalog.pg_class
    WHERE oid = ANY($1::oid[])
  `,
  routine: `
    SELECT
      oid::text AS object_oid,
      pg_catalog.pg_get_userbyid(proowner) AS owner_name
    FROM pg_catalog.pg_proc
    WHERE oid = ANY($1::oid[])
  `,
  type: `
    SELECT
      oid::text AS object_oid,
      pg_catalog.pg_get_userbyid(typowner) AS owner_name
    FROM pg_catalog.pg_type
    WHERE oid = ANY($1::oid[])
  `,
});

const OBJECT_GRANTS_SQL = `
  SELECT grant_statement
  FROM (
    SELECT
      1 AS object_order,
      namespace.nspname,
      relation.relname AS object_name,
      relation.oid AS object_oid,
      CASE relation.relkind
        WHEN 'S' THEN pg_catalog.format(
          'GRANT USAGE, SELECT ON SEQUENCE %I.%I TO %I',
          namespace.nspname,
          relation.relname,
          $2::text
        )
        ELSE pg_catalog.format(
          'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I',
          namespace.nspname,
          relation.relname,
          $2::text
        )
      END AS grant_statement
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = relation.relowner
    WHERE namespace.nspname = $3::text
      AND owner_role.rolname = $1::text
      AND relation.relkind IN ('r', 'p', 'f', 'v', 'm', 'S')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        WHERE dependency.classid = 'pg_catalog.pg_class'::regclass
          AND dependency.objid = relation.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
          AND dependency.deptype = 'e'
      )

    UNION ALL

    SELECT
      2 AS object_order,
      namespace.nspname,
      routine.proname AS object_name,
      routine.oid AS object_oid,
      CASE routine.prokind
        WHEN 'p' THEN pg_catalog.format(
          'GRANT EXECUTE ON PROCEDURE %I.%I(%s) TO %I',
          namespace.nspname,
          routine.proname,
          pg_catalog.pg_get_function_identity_arguments(routine.oid),
          $2::text
        )
        ELSE pg_catalog.format(
          'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO %I',
          namespace.nspname,
          routine.proname,
          pg_catalog.pg_get_function_identity_arguments(routine.oid),
          $2::text
        )
      END AS grant_statement
    FROM pg_catalog.pg_proc AS routine
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = routine.pronamespace
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = routine.proowner
    WHERE namespace.nspname = $3::text
      AND owner_role.rolname = $1::text
      AND routine.prokind IN ('f', 'p', 'a', 'w')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        WHERE dependency.classid = 'pg_catalog.pg_proc'::regclass
          AND dependency.objid = routine.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
          AND dependency.deptype = 'e'
      )

    UNION ALL

    SELECT
      3 AS object_order,
      namespace.nspname,
      type_entry.typname AS object_name,
      type_entry.oid AS object_oid,
      CASE type_entry.typtype
        WHEN 'd' THEN pg_catalog.format(
          'GRANT USAGE ON DOMAIN %I.%I TO %I',
          namespace.nspname,
          type_entry.typname,
          $2::text
        )
        ELSE pg_catalog.format(
          'GRANT USAGE ON TYPE %I.%I TO %I',
          namespace.nspname,
          type_entry.typname,
          $2::text
        )
      END AS grant_statement
    FROM pg_catalog.pg_type AS type_entry
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = type_entry.typnamespace
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = type_entry.typowner
    LEFT JOIN pg_catalog.pg_class AS type_relation
      ON type_relation.oid = type_entry.typrelid
    WHERE namespace.nspname = $3::text
      AND owner_role.rolname = $1::text
      AND (
        (
          type_entry.typrelid = 0
          AND (
            (type_entry.typtype = 'b' AND type_entry.typelem = 0)
            OR type_entry.typtype IN ('d', 'e', 'r', 'm')
          )
        )
        OR (type_entry.typtype = 'c' AND type_relation.relkind = 'c')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        WHERE dependency.classid = 'pg_catalog.pg_type'::regclass
          AND dependency.objid = type_entry.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
          AND dependency.deptype = 'e'
      )
  ) AS grants
  ORDER BY object_order, nspname, object_name, object_oid
`;

const RUNTIME_ACL_AUDIT_SQL = `
  WITH required_privileges AS (
    SELECT
      'relation'::text AS object_kind,
      namespace.nspname AS schema_name,
      relation.relname AS object_name,
      required.privilege_type,
      relation.relacl AS object_acl,
      CASE
        WHEN relation.relkind = 'S' THEN 'S'::\"char\"
        ELSE 'r'::\"char\"
      END AS acl_kind,
      relation.relowner AS owner_oid
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL unnest(
      CASE
        WHEN relation.relkind = 'S'
          THEN ARRAY['USAGE', 'SELECT']::text[]
        ELSE ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]
      END
    ) AS required(privilege_type)
    WHERE namespace.nspname = $1::text
      AND relation.relkind IN ('r', 'p', 'f', 'v', 'm', 'S')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        WHERE dependency.classid = 'pg_catalog.pg_class'::regclass
          AND dependency.objid = relation.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
          AND dependency.deptype = 'e'
      )

    UNION ALL

    SELECT
      'routine'::text AS object_kind,
      namespace.nspname AS schema_name,
      routine.proname || '(' ||
        pg_catalog.pg_get_function_identity_arguments(routine.oid) || ')' AS object_name,
      'EXECUTE'::text AS privilege_type,
      routine.proacl AS object_acl,
      'f'::\"char\" AS acl_kind,
      routine.proowner AS owner_oid
    FROM pg_catalog.pg_proc AS routine
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname = $1::text
      AND routine.prokind IN ('f', 'p', 'a', 'w')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        WHERE dependency.classid = 'pg_catalog.pg_proc'::regclass
          AND dependency.objid = routine.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
          AND dependency.deptype = 'e'
      )

    UNION ALL

    SELECT
      'type'::text AS object_kind,
      namespace.nspname AS schema_name,
      type_entry.typname AS object_name,
      'USAGE'::text AS privilege_type,
      type_entry.typacl AS object_acl,
      'T'::\"char\" AS acl_kind,
      type_entry.typowner AS owner_oid
    FROM pg_catalog.pg_type AS type_entry
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = type_entry.typnamespace
    LEFT JOIN pg_catalog.pg_class AS type_relation
      ON type_relation.oid = type_entry.typrelid
    WHERE namespace.nspname = $1::text
      AND (
        (
          type_entry.typrelid = 0
          AND (
            (type_entry.typtype = 'b' AND type_entry.typelem = 0)
            OR type_entry.typtype IN ('d', 'e', 'r', 'm')
          )
        )
        OR (type_entry.typtype = 'c' AND type_relation.relkind = 'c')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_depend AS dependency
        WHERE dependency.classid = 'pg_catalog.pg_type'::regclass
          AND dependency.objid = type_entry.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
          AND dependency.deptype = 'e'
      )
  ), missing_privileges AS (
    SELECT
      required.object_kind,
      required.schema_name,
      required.object_name,
      required.privilege_type
    FROM required_privileges AS required
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.aclexplode(
        COALESCE(
          required.object_acl,
          pg_catalog.acldefault(required.acl_kind, required.owner_oid)
        )
      ) AS acl
      JOIN pg_catalog.pg_roles AS grantee
        ON grantee.oid = acl.grantee
      WHERE grantee.rolname = $2::text
        AND upper(acl.privilege_type) = required.privilege_type
    )
  )
  SELECT
    object_kind,
    schema_name,
    object_name,
    privilege_type,
    COUNT(*) OVER ()::integer AS mismatch_count
  FROM missing_privileges
  ORDER BY object_kind, schema_name, object_name, privilege_type
  LIMIT 51
`;

const DEFAULT_ACL_SQL = `
  SELECT
    default_acl.defaclobjtype::text AS object_type,
    upper(acl.privilege_type) AS privilege_type
  FROM pg_catalog.pg_default_acl AS default_acl
  JOIN pg_catalog.pg_roles AS owner_role
    ON owner_role.oid = default_acl.defaclrole
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = default_acl.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl) AS acl
  JOIN pg_catalog.pg_roles AS grantee
    ON grantee.oid = acl.grantee
  WHERE owner_role.rolname = $1::text
    AND namespace.nspname = $2::text
    AND grantee.rolname = $3::text
  ORDER BY default_acl.defaclobjtype, acl.privilege_type
`;

const DATABASE_ROLE_SETTING_SQL = `
  SELECT setting
  FROM pg_catalog.pg_db_role_setting AS role_setting
  JOIN pg_catalog.pg_roles AS role_entry
    ON role_entry.oid = role_setting.setrole
  JOIN pg_catalog.pg_database AS database_entry
    ON database_entry.oid = role_setting.setdatabase
  CROSS JOIN LATERAL unnest(role_setting.setconfig) AS configured(setting)
  WHERE role_entry.rolname = $1::text
    AND database_entry.datname = $2::text
    AND (
      configured.setting LIKE 'role=%'
      OR configured.setting LIKE 'statement_timeout=%'
    )
  ORDER BY configured.setting
`;

const SCHEMA_PRIVILEGE_SQL = `
  SELECT
    CASE
      WHEN role_entry.oid IS NULL THEN FALSE
      ELSE pg_catalog.has_schema_privilege(role_entry.oid, namespace.oid, 'USAGE')
    END AS has_usage,
    CASE
      WHEN role_entry.oid IS NULL THEN FALSE
      ELSE pg_catalog.has_schema_privilege(role_entry.oid, namespace.oid, 'CREATE')
    END AS has_create
  FROM pg_catalog.pg_namespace AS namespace
  LEFT JOIN pg_catalog.pg_roles AS role_entry
    ON role_entry.rolname = $1::text
  WHERE namespace.nspname = $2::text
`;

const DEFAULT_PRIVILEGES = Object.freeze({
  r: Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]),
  S: Object.freeze(["USAGE", "SELECT"]),
  f: Object.freeze(["EXECUTE"]),
  T: Object.freeze(["USAGE"]),
});

function parseCli(args) {
  const known = new Set(["--apply", "--dry-run", "--self-test", "--help"]);
  for (const argument of args) {
    if (!known.has(argument)) {
      throw new Error("Unknown argument: " + JSON.stringify(argument));
    }
  }
  if (new Set(args).size !== args.length) {
    throw new Error("Arguments must not be repeated");
  }
  const modes = ["--apply", "--dry-run", "--self-test", "--help"].filter(
    (mode) => args.includes(mode),
  );
  if (modes.length > 1) {
    throw new Error(
      "Choose only one of --apply, --dry-run, --self-test, or --help",
    );
  }
  if (args.includes("--apply")) return Object.freeze({ mode: "apply" });
  if (args.includes("--self-test")) return Object.freeze({ mode: "self-test" });
  if (args.includes("--help")) return Object.freeze({ mode: "help" });
  return Object.freeze({ mode: "dry-run" });
}

function printUsage(log = console.log) {
  log(`Usage:
  node backend/scripts/bootstrap-production-ownership.mjs
  node backend/scripts/bootstrap-production-ownership.mjs --dry-run
  node backend/scripts/bootstrap-production-ownership.mjs --apply
  node backend/scripts/bootstrap-production-ownership.mjs --self-test

Dry-run is the default. --apply additionally requires ${CONFIRM_HOST_ENV} to
exactly equal the direct owner hostname.

Required database URLs:
  ${OWNER_URL_ENV}       direct legacy/admin URL, user ${OWNER_LOGIN_ROLE}
  ${MIGRATOR_URL_ENV}    direct legacy source URL, user ${MIGRATOR_LOGIN_ROLE}
  ${MIGRATION_URL_ENV}   direct new URL, user ${MIGRATION_LOGIN_ROLE}
  ${RUNTIME_URL_ENV}     pooled new URL, user ${RUNTIME_LOGIN_ROLE}`);
}

function decodeUrlComponent(value, label) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(label + " contains invalid percent encoding");
  }
}

function isNeonPoolerHostname(hostname) {
  const firstLabel =
    String(hostname || "")
      .toLowerCase()
      .split(".")[0] || "";
  return firstLabel.endsWith("-pooler");
}

function normalizeNeonEndpoint(hostname) {
  const labels = String(hostname || "")
    .toLowerCase()
    .split(".");
  if (labels[0]?.endsWith("-pooler")) {
    labels[0] = labels[0].slice(0, -"-pooler".length);
  }
  return labels.join(".");
}

function directNeonConnectionString(pooledUrl) {
  const parsed = new URL(pooledUrl);
  const labels = parsed.hostname.split(".");
  if (!labels[0]?.endsWith("-pooler")) {
    throw new Error("Expected a Neon pooled endpoint");
  }
  labels[0] = labels[0].slice(0, -"-pooler".length);
  parsed.hostname = labels.join(".");
  return parsed.toString();
}

function parseDatabaseUrl(
  value,
  { variableName, expectedUser, pooled, requireStrongPassword = false },
) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(variableName + " is required");

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(variableName + " must be a valid PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(
      variableName + " must use the postgres or postgresql scheme",
    );
  }
  if (!parsed.hostname || !parsed.username) {
    throw new Error(variableName + " must include a hostname and username");
  }
  const hostname = parsed.hostname.toLowerCase();
  const hostnameLabels = hostname.split(".");
  const pooler = isNeonPoolerHostname(hostname);
  const endpointLabel = pooler
    ? hostnameLabels[0].slice(0, -"-pooler".length)
    : hostnameLabels[0];
  if (
    hostnameLabels.length < 3 ||
    !hostname.endsWith(".neon.tech") ||
    !NEON_ENDPOINT_LABEL.test(endpointLabel)
  ) {
    throw new Error(variableName + " must use an ep-* Neon endpoint");
  }

  const connectionParameterValues = (parameterName) =>
    [...parsed.searchParams.entries()]
      .filter(([name]) => name.toLowerCase() === parameterName)
      .map(([, parameterValue]) => String(parameterValue).toLowerCase());
  const sslModes = connectionParameterValues("sslmode");
  if (sslModes.length !== 1 || !ALLOWED_POSTGRES_TLS_MODES.has(sslModes[0])) {
    throw new Error(
      variableName +
        " must set exactly one sslmode=require, verify-ca, or verify-full",
    );
  }
  const channelBindings = connectionParameterValues("channel_binding");
  if (channelBindings.length !== 1 || channelBindings[0] !== "require") {
    throw new Error(
      variableName + " must set exactly one channel_binding=require",
    );
  }

  const username = decodeUrlComponent(
    parsed.username,
    variableName + " username",
  );
  if (username !== expectedUser) {
    throw new Error(
      variableName +
        " must authenticate exactly as " +
        JSON.stringify(expectedUser),
    );
  }
  const encodedPassword = parsed.password;
  const password = decodeUrlComponent(
    encodedPassword,
    variableName + " password",
  );
  if (requireStrongPassword && !/^[A-Za-z0-9_-]{32,256}$/.test(password)) {
    throw new Error(
      variableName + " must include a 32-256 character base64url password",
    );
  }
  if (!parsed.pathname.startsWith("/") || parsed.pathname.length <= 1) {
    throw new Error(variableName + " must include an explicit database name");
  }
  const encodedDatabase = parsed.pathname.slice(1);
  if (encodedDatabase.includes("/")) {
    throw new Error(variableName + " must select exactly one database");
  }
  const database = decodeUrlComponent(
    encodedDatabase,
    variableName + " database name",
  );
  if (!database) {
    throw new Error(variableName + " must include an explicit database name");
  }

  if (pooled === true && !pooler) {
    throw new Error(variableName + " must use the Neon pooled endpoint");
  }
  if (pooled === false && pooler) {
    throw new Error(variableName + " must use a direct, non-pooled endpoint");
  }

  return Object.freeze({
    raw,
    variableName,
    username,
    encodedPassword,
    password,
    hostname,
    normalizedEndpoint: normalizeNeonEndpoint(hostname),
    port: parsed.port || "5432",
    database,
    pooled: pooler,
  });
}

function assertSameDatabaseTarget(
  left,
  right,
  { allowPoolerDifference = false } = {},
) {
  const leftHost = allowPoolerDifference
    ? left.normalizedEndpoint
    : left.hostname;
  const rightHost = allowPoolerDifference
    ? right.normalizedEndpoint
    : right.hostname;
  if (
    leftHost !== rightHost ||
    left.port !== right.port ||
    left.database !== right.database
  ) {
    throw new Error(
      left.variableName +
        " and " +
        right.variableName +
        " must resolve to the same endpoint, port, and database",
    );
  }
}

function assertExactConfirmation(actual, expectedHostname) {
  if (String(actual || "") !== expectedHostname) {
    throw new Error(
      CONFIRM_HOST_ENV +
        " must exactly equal the direct owner hostname " +
        JSON.stringify(expectedHostname),
    );
  }
}

function requireConfiguration(env, { apply }) {
  const owner = parseDatabaseUrl(env[OWNER_URL_ENV], {
    variableName: OWNER_URL_ENV,
    expectedUser: OWNER_LOGIN_ROLE,
    pooled: false,
  });
  const migrator = parseDatabaseUrl(env[MIGRATOR_URL_ENV], {
    variableName: MIGRATOR_URL_ENV,
    expectedUser: MIGRATOR_LOGIN_ROLE,
    pooled: false,
  });
  assertSameDatabaseTarget(owner, migrator);

  const migration = parseDatabaseUrl(env[MIGRATION_URL_ENV], {
    variableName: MIGRATION_URL_ENV,
    expectedUser: MIGRATION_LOGIN_ROLE,
    pooled: false,
    requireStrongPassword: true,
  });
  const runtime = parseDatabaseUrl(env[RUNTIME_URL_ENV], {
    variableName: RUNTIME_URL_ENV,
    expectedUser: RUNTIME_LOGIN_ROLE,
    pooled: true,
    requireStrongPassword: true,
  });
  assertSameDatabaseTarget(owner, migration);
  assertSameDatabaseTarget(owner, runtime, { allowPoolerDifference: true });
  if (migration.password === runtime.password) {
    throw new Error(
      MIGRATION_URL_ENV +
        " and " +
        RUNTIME_URL_ENV +
        " must use different passwords",
    );
  }
  if (apply) assertExactConfirmation(env[CONFIRM_HOST_ENV], owner.hostname);
  return Object.freeze({ owner, migrator, migration, runtime });
}

function quoteIdentifier(identifier) {
  return '"' + String(identifier).replaceAll('"', '""') + '"';
}

function quoteLiteral(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function configurationSecrets(configuration) {
  const secrets = [];
  for (const databaseConfig of Object.values(configuration || {})) {
    if (!databaseConfig || typeof databaseConfig !== "object") continue;
    secrets.push(
      databaseConfig.raw,
      databaseConfig.encodedPassword,
      databaseConfig.password,
    );
  }
  return secrets.filter(Boolean);
}

function redactSecrets(value, secrets = []) {
  let message = String(value || "unknown_error");
  for (const secret of secrets) {
    const candidate = String(secret || "");
    if (candidate) message = message.split(candidate).join("[REDACTED_URL]");
  }
  message = message.replace(
    /\b(postgres(?:ql)?:\/\/)[^\s@]+@/giu,
    "$1[REDACTED]@",
  );
  message = message.replace(
    /\bpassword\s*=\s*(?:'[^']*'|"[^"]*"|[^\s;]+)/giu,
    "password=[REDACTED]",
  );
  return message;
}

function safeErrorMessage(error, secrets = []) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code || "")
      : "";
  return redactSecrets(code ? code + ": " + message : message, secrets);
}

function assertPostgres18(serverVersionNumber) {
  const version = Number(serverVersionNumber);
  if (
    !Number.isInteger(version) ||
    version < MIN_POSTGRES_18 ||
    version >= MAX_POSTGRES_18
  ) {
    throw new Error(
      "Ownership bootstrap requires PostgreSQL 18.x; received server_version_num=" +
        JSON.stringify(serverVersionNumber),
    );
  }
  return version;
}

async function configureSession(client) {
  await client.query("SET lock_timeout = '5s'");
  await client.query("SET statement_timeout = '2min'");
  await client.query("SET idle_in_transaction_session_timeout = '2min'");
}

async function resetAndAssertSession(
  client,
  expectedRole,
  expectedDatabase,
  phase,
) {
  await client.query("RESET ROLE");
  // A database-bound `role` setting survives RESET ROLE. Explicitly selecting
  // the login role is therefore required on safe bootstrap reruns.
  await client.query("SET ROLE " + quoteIdentifier(expectedRole));
  const result = await client.query(SESSION_IDENTITY_SQL);
  if (result.rows?.length !== 1) {
    throw new Error("Could not determine database identity during " + phase);
  }
  const row = result.rows[0];
  const sessionUser = String(row.session_user || "");
  const currentUser = String(row.current_user || "");
  const databaseName = String(row.database_name || "");
  if (sessionUser !== expectedRole || currentUser !== expectedRole) {
    throw new Error(
      "Database identity mismatch during " +
        phase +
        ": expected session_user=current_user=" +
        JSON.stringify(expectedRole) +
        ", received session_user=" +
        JSON.stringify(sessionUser) +
        ", current_user=" +
        JSON.stringify(currentUser),
    );
  }
  if (databaseName !== expectedDatabase) {
    throw new Error(
      "Database mismatch during " +
        phase +
        ": expected " +
        JSON.stringify(expectedDatabase) +
        ", received " +
        JSON.stringify(databaseName),
    );
  }
  const serverVersionNumber = assertPostgres18(row.server_version_num);
  return Object.freeze({
    sessionUser,
    currentUser,
    databaseName,
    serverVersionNumber,
    serverVersion: String(row.server_version || ""),
  });
}

async function assertActiveRole(
  client,
  expectedSession,
  expectedCurrent,
  phase,
) {
  const result = await client.query(SESSION_IDENTITY_SQL);
  const row = result.rows?.[0];
  if (
    !row ||
    String(row.session_user || "") !== expectedSession ||
    String(row.current_user || "") !== expectedCurrent
  ) {
    throw new Error(
      "Role activation mismatch during " +
        phase +
        ": expected session_user=" +
        JSON.stringify(expectedSession) +
        ", current_user=" +
        JSON.stringify(expectedCurrent),
    );
  }
}

async function acquireMigrationLock(client) {
  const result = await client.query(
    "SELECT pg_try_advisory_lock(hashtext($1::text), hashtext($2::text)) AS acquired",
    [LOCK_NAMESPACE, LOCK_NAME],
  );
  if (result.rows?.[0]?.acquired !== true) {
    throw new Error(
      "Another production migration or ownership bootstrap holds the database lock",
    );
  }
}

async function releaseMigrationLock(client) {
  await client.query(
    "SELECT pg_advisory_unlock(hashtext($1::text), hashtext($2::text)) AS released",
    [LOCK_NAMESPACE, LOCK_NAME],
  );
}

function expectedMemberships() {
  return new Map([
    [
      OWNER_LOGIN_ROLE,
      // Neon/PostgreSQL 18 records the creator's automatic ADMIN-only grant
      // separately from the explicit self-grant that enables SET ROLE.
      Object.freeze({
        grantCount: 2,
        adminOnlyGrantCount: 1,
        setOnlyGrantCount: 1,
        admin: true,
        inherit: false,
        set: true,
      }),
    ],
    [
      MIGRATION_LOGIN_ROLE,
      Object.freeze({
        grantCount: 1,
        adminOnlyGrantCount: 0,
        setOnlyGrantCount: 1,
        admin: false,
        inherit: false,
        set: true,
      }),
    ],
    [
      RUNTIME_LOGIN_ROLE,
      Object.freeze({
        grantCount: 1,
        adminOnlyGrantCount: 0,
        setOnlyGrantCount: 1,
        admin: false,
        inherit: false,
        set: true,
      }),
    ],
  ]);
}

function validateTargetRoleShape(role, { allowMissing }) {
  if (!role) {
    if (allowMissing) return;
    throw new Error("Required NOLOGIN owner role does not exist");
  }
  const expected = {
    rolcanlogin: false,
    rolinherit: false,
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
  };
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => role[key] !== value)
    .map(([key, value]) => key + "=" + String(value));
  if (mismatches.length > 0) {
    throw new Error(
      "Existing role " +
        JSON.stringify(SCHEMA_OWNER_ROLE) +
        " has unsafe attributes; expected " +
        mismatches.join(", "),
    );
  }
}

function validateLoginRoleShape(role, roleName, { allowMissing }) {
  if (!role) {
    if (allowMissing) return;
    throw new Error(
      "Required least-privilege login role does not exist: " +
        JSON.stringify(roleName),
    );
  }
  const expected = {
    rolcanlogin: true,
    rolinherit: false,
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
  };
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => role[key] !== value)
    .map(([key, value]) => key + "=" + String(value));
  if (mismatches.length > 0) {
    throw new Error(
      "Existing login role " +
        JSON.stringify(roleName) +
        " has unsafe attributes; expected " +
        mismatches.join(", "),
    );
  }
}

async function readLoginTopology(client, roleName) {
  const roleResult = await client.query(TARGET_ROLE_SQL, [roleName]);
  const membershipResult = await client.query(LOGIN_MEMBERSHIPS_SQL, [
    roleName,
  ]);
  return Object.freeze({
    role: roleResult.rows?.[0] || null,
    memberships: membershipResult.rows || [],
  });
}

function loginTopologyProblems(topology, roleName) {
  validateLoginRoleShape(topology.role, roleName, { allowMissing: true });
  if (!topology.role) return ["login role " + roleName + " is missing"];
  if (topology.memberships.length !== 1) {
    return [
      "login role " + roleName + " must have exactly one direct membership",
    ];
  }
  const membership = topology.memberships[0];
  if (
    String(membership.granted_role) !== SCHEMA_OWNER_ROLE ||
    membership.admin_option !== false ||
    membership.inherit_option !== false ||
    membership.set_option !== true
  ) {
    return [
      "login role " +
        roleName +
        " must have only ADMIN FALSE, INHERIT FALSE, SET TRUE in " +
        SCHEMA_OWNER_ROLE,
    ];
  }
  return [];
}

async function createLoginRoleIfMissing(client, roleName, password) {
  const topology = await readLoginTopology(client, roleName);
  validateLoginRoleShape(topology.role, roleName, { allowMissing: true });
  if (topology.role) {
    const unexpected = topology.memberships.filter(
      (membership) =>
        String(membership.granted_role) !== SCHEMA_OWNER_ROLE ||
        membership.admin_option !== false ||
        membership.inherit_option !== false ||
        membership.set_option !== true,
    );
    if (topology.memberships.length > 1 || unexpected.length > 0) {
      throw new Error(
        "Refusing to modify existing login role with unexpected membership: " +
          roleName,
      );
    }
    return false;
  }

  try {
    // Neon requires SQL-created role passwords in plain text and stores them
    // encrypted. The caller forces SCRAM inside the same TLS/channel-bound
    // transaction, and all outer error paths redact the supplied credential.
    await client.query(
      "CREATE ROLE " +
        quoteIdentifier(roleName) +
        " LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE" +
        " NOREPLICATION NOBYPASSRLS PASSWORD " +
        quoteLiteral(password),
    );
  } catch (error) {
    throw new Error(
      "Failed to create least-privilege login role " +
        JSON.stringify(roleName) +
        "; no existing password was changed (" +
        safeErrorMessage(error, [password]) +
        ")",
      { cause: error },
    );
  }
  return true;
}
async function readTopology(client) {
  const roleResult = await client.query(TARGET_ROLE_SQL, [SCHEMA_OWNER_ROLE]);
  const memberOfResult = await client.query(TARGET_MEMBER_OF_SQL, [
    SCHEMA_OWNER_ROLE,
  ]);
  const membersResult = await client.query(TARGET_MEMBERS_SQL, [
    SCHEMA_OWNER_ROLE,
  ]);
  return Object.freeze({
    role: roleResult.rows?.[0] || null,
    memberOf: (memberOfResult.rows || []).map((row) =>
      String(row.granted_role),
    ),
    members: membersResult.rows || [],
  });
}

function topologyProblems(topology) {
  validateTargetRoleShape(topology.role, { allowMissing: true });
  if (!topology.role) return ["owner role is missing"];

  const problems = [];
  if (topology.memberOf.length > 0) {
    problems.push(
      "owner role is unexpectedly a member of " + topology.memberOf.join(", "),
    );
  }
  const expected = expectedMemberships();
  const actualNames = new Set(
    topology.members.map((row) => String(row.member_name)),
  );
  for (const memberName of actualNames) {
    if (!expected.has(memberName)) {
      problems.push("unexpected owner-role member " + memberName);
    }
  }
  for (const [memberName, options] of expected) {
    const row = topology.members.find(
      (candidate) => String(candidate.member_name) === memberName,
    );
    if (!row) {
      problems.push("missing membership for " + memberName);
      continue;
    }
    if (
      Number(row.grant_count) !== options.grantCount ||
      Number(row.admin_only_grant_count) !== options.adminOnlyGrantCount ||
      Number(row.set_only_grant_count) !== options.setOnlyGrantCount ||
      row.admin_option !== options.admin ||
      row.inherit_option !== options.inherit ||
      row.set_option !== options.set
    ) {
      problems.push(
        "membership options differ for " +
          memberName +
          " (expected ADMIN " +
          String(options.admin).toUpperCase() +
          ", INHERIT " +
          String(options.inherit).toUpperCase() +
          ", SET " +
          String(options.set).toUpperCase() +
          ")",
      );
    }
  }
  return problems;
}

async function assertLoginRoles(client) {
  const result = await client.query(LOGIN_ROLES_SQL, [
    [OWNER_LOGIN_ROLE, MIGRATOR_LOGIN_ROLE],
  ]);
  const byName = new Map(
    (result.rows || []).map((row) => [String(row.rolname), row]),
  );
  for (const roleName of [OWNER_LOGIN_ROLE, MIGRATOR_LOGIN_ROLE]) {
    const role = byName.get(roleName);
    if (!role || role.rolcanlogin !== true) {
      throw new Error(
        "Required direct login role is missing or NOLOGIN: " +
          JSON.stringify(roleName),
      );
    }
  }
}

async function ensureRoleTopology(
  ownerClient,
  { migrationPassword, runtimePassword },
) {
  let topology = await readTopology(ownerClient);
  validateTargetRoleShape(topology.role, { allowMissing: true });
  if (topology.role && topology.memberOf.length > 0) {
    throw new Error(
      "Refusing to modify owner role because it is a member of: " +
        topology.memberOf.join(", "),
    );
  }
  const unexpectedMembers = topology.members
    .map((row) => String(row.member_name))
    .filter(
      (name) =>
        ![
          OWNER_LOGIN_ROLE,
          MIGRATOR_LOGIN_ROLE,
          MIGRATION_LOGIN_ROLE,
          RUNTIME_LOGIN_ROLE,
        ].includes(name),
    );
  if (unexpectedMembers.length > 0) {
    throw new Error(
      "Refusing to modify owner role with unexpected members: " +
        unexpectedMembers.join(", "),
    );
  }

  if (!topology.role) {
    await ownerClient.query(
      "CREATE ROLE " +
        quoteIdentifier(SCHEMA_OWNER_ROLE) +
        " NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE" +
        " NOINHERIT NOREPLICATION NOBYPASSRLS",
    );
  }
  await createLoginRoleIfMissing(
    ownerClient,
    MIGRATION_LOGIN_ROLE,
    migrationPassword,
  );
  await createLoginRoleIfMissing(
    ownerClient,
    RUNTIME_LOGIN_ROLE,
    runtimePassword,
  );

  for (const loginRole of [
    OWNER_LOGIN_ROLE,
    MIGRATOR_LOGIN_ROLE,
    MIGRATION_LOGIN_ROLE,
    RUNTIME_LOGIN_ROLE,
  ]) {
    await ownerClient.query(
      "GRANT " +
        quoteIdentifier(SCHEMA_OWNER_ROLE) +
        " TO " +
        quoteIdentifier(loginRole) +
        " WITH ADMIN FALSE, INHERIT FALSE, SET TRUE",
    );
  }
  await ownerClient.query(
    "GRANT USAGE, CREATE ON SCHEMA " +
      quoteIdentifier(APPLICATION_SCHEMA) +
      " TO " +
      quoteIdentifier(SCHEMA_OWNER_ROLE),
  );
  for (const runtimeRole of [OWNER_LOGIN_ROLE, RUNTIME_LOGIN_ROLE]) {
    await ownerClient.query(
      "GRANT USAGE ON SCHEMA " +
        quoteIdentifier(APPLICATION_SCHEMA) +
        " TO " +
        quoteIdentifier(runtimeRole),
    );
  }

  const migrationTopology = await readLoginTopology(
    ownerClient,
    MIGRATION_LOGIN_ROLE,
  );
  const runtimeTopology = await readLoginTopology(
    ownerClient,
    RUNTIME_LOGIN_ROLE,
  );
  const loginProblems = [
    ...loginTopologyProblems(migrationTopology, MIGRATION_LOGIN_ROLE),
    ...loginTopologyProblems(runtimeTopology, RUNTIME_LOGIN_ROLE),
  ];
  if (loginProblems.length > 0) {
    throw new Error(
      "Least-privilege login topology did not converge: " +
        loginProblems.join("; "),
    );
  }
}

async function applyRoleTopologyAtomically(
  ownerClient,
  credentials,
  converge = ensureRoleTopology,
) {
  let transactionStarted = false;
  try {
    await ownerClient.query("BEGIN");
    transactionStarted = true;
    await ownerClient.query("SET LOCAL password_encryption = 'scram-sha-256'");
    await converge(ownerClient, credentials);
    await ownerClient.query("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try {
        await ownerClient.query("ROLLBACK");
      } catch {
        // Closing the owner connection is the final rollback fallback.
      }
    }
    throw error;
  }
}

async function finalizeRoleTopology(ownerClient) {
  await ownerClient.query(
    "REVOKE " +
      quoteIdentifier(SCHEMA_OWNER_ROLE) +
      " FROM " +
      quoteIdentifier(MIGRATOR_LOGIN_ROLE),
  );
  const ownerTopology = await readTopology(ownerClient);
  const migrationTopology = await readLoginTopology(
    ownerClient,
    MIGRATION_LOGIN_ROLE,
  );
  const runtimeTopology = await readLoginTopology(
    ownerClient,
    RUNTIME_LOGIN_ROLE,
  );
  const problems = [
    ...topologyProblems(ownerTopology),
    ...loginTopologyProblems(migrationTopology, MIGRATION_LOGIN_ROLE),
    ...loginTopologyProblems(runtimeTopology, RUNTIME_LOGIN_ROLE),
  ];
  if (problems.length > 0) {
    throw new Error(
      "Final ownership role topology did not converge: " + problems.join("; "),
    );
  }
}

function groupOwnershipRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const owner = String(row.owner_name || "<unknown>");
    const kind = String(row.object_kind || "object");
    const key = owner + "\u0000" + kind;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  return [...grouped.entries()]
    .map(([key, count]) => {
      const [owner, kind] = key.split("\u0000");
      return { owner, kind, count };
    })
    .sort((left, right) =>
      (left.owner + "\u0000" + left.kind).localeCompare(
        right.owner + "\u0000" + right.kind,
      ),
    );
}

function assertOnlyTransferableOwners(rows) {
  const allowed = new Set([
    OWNER_LOGIN_ROLE,
    MIGRATOR_LOGIN_ROLE,
    SCHEMA_OWNER_ROLE,
  ]);
  const unsupported = rows.filter(
    (row) => !allowed.has(String(row.owner_name || "")),
  );
  if (unsupported.length > 0) {
    const sample = unsupported
      .slice(0, 10)
      .map(
        (row) =>
          String(row.object_kind) +
          " " +
          JSON.stringify(
            String(row.schema_name) + "." + String(row.object_name),
          ) +
          " owned by " +
          JSON.stringify(String(row.owner_name || "<unknown>")),
      );
    throw new Error(
      "Public non-extension objects include unsupported owners: " +
        sample.join("; ") +
        (unsupported.length > sample.length
          ? "; plus " + (unsupported.length - sample.length) + " more"
          : ""),
    );
  }
}

function splitIntoBatches(items, batchSize = STATEMENT_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Batch size must be a positive integer");
  }
  const batches = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

function requireObjectOid(row, phase) {
  const oid = String(row?.object_oid ?? "");
  if (!/^[1-9][0-9]*$/.test(oid)) {
    throw new Error(
      "Invalid object OID during " + phase + ": " + JSON.stringify(oid),
    );
  }
  return oid;
}

function objectIdentity(row) {
  return String(
    row?.object_identity || "object OID " + requireObjectOid(row, "identity"),
  );
}

function selectRowsForOwnershipTransfer(
  expectedRows,
  ownerRows,
  { sourceRole, targetRole, phase, requireTarget = false },
) {
  const expectedByOid = new Map();
  for (const row of expectedRows) {
    const oid = requireObjectOid(row, phase);
    if (expectedByOid.has(oid)) {
      throw new Error(
        "Duplicate expected object OID during " + phase + ": " + oid,
      );
    }
    expectedByOid.set(oid, row);
  }

  const ownersByOid = new Map();
  for (const row of ownerRows) {
    const oid = requireObjectOid(row, phase);
    if (!expectedByOid.has(oid)) {
      throw new Error("Unexpected object OID during " + phase + ": " + oid);
    }
    if (ownersByOid.has(oid)) {
      throw new Error(
        "Duplicate catalog object OID during " + phase + ": " + oid,
      );
    }
    ownersByOid.set(oid, String(row.owner_name || ""));
  }

  const pending = [];
  for (const [oid, row] of expectedByOid) {
    if (!ownersByOid.has(oid)) {
      throw new Error(
        "Concurrent catalog drift detected during " +
          phase +
          ": " +
          JSON.stringify(objectIdentity(row)) +
          " disappeared",
      );
    }
    const currentOwner = ownersByOid.get(oid);
    if (currentOwner === targetRole) continue;
    if (requireTarget) {
      throw new Error(
        "Post-transfer owner audit failed during " +
          phase +
          " for " +
          JSON.stringify(objectIdentity(row)) +
          ": expected " +
          JSON.stringify(targetRole) +
          ", received " +
          JSON.stringify(currentOwner || "<unknown>"),
      );
    }
    if (currentOwner !== sourceRole) {
      throw new Error(
        "Concurrent ownership drift detected during " +
          phase +
          " for " +
          JSON.stringify(objectIdentity(row)) +
          ": expected " +
          JSON.stringify(sourceRole) +
          " or " +
          JSON.stringify(targetRole) +
          ", received " +
          JSON.stringify(currentOwner || "<unknown>"),
      );
    }
    pending.push(row);
  }
  return pending;
}

async function readObjectOwners(client, catalogKind, rows) {
  const lookupSql = OBJECT_OWNER_LOOKUP_SQL[catalogKind];
  if (!lookupSql) throw new Error("Unsupported ownership catalog kind");
  const objectOids = rows.map((row) =>
    requireObjectOid(row, catalogKind + " owner lookup"),
  );
  if (objectOids.length === 0) return [];
  const result = await client.query(lookupSql, [objectOids]);
  return result.rows || [];
}

async function executeStatementBatches(
  client,
  statements,
  batchSize = STATEMENT_BATCH_SIZE,
) {
  const normalized = statements.map((statement) => {
    if (typeof statement !== "string" || !statement.trim()) {
      throw new Error("Batched database statements must be non-empty strings");
    }
    return statement.trim();
  });
  for (const batch of splitIntoBatches(normalized, batchSize)) {
    // These statements are produced by pg_catalog.format with quoted
    // identifiers. Omitting query values deliberately selects pg's simple
    // query protocol so PostgreSQL executes the batch in one round trip.
    await client.query(batch.join(";\n") + ";");
  }
  return normalized.length;
}

async function grantExistingRuntimeObjectAccess(client, runtimeRole) {
  const grants = await client.query(OBJECT_GRANTS_SQL, [
    SCHEMA_OWNER_ROLE,
    runtimeRole,
    APPLICATION_SCHEMA,
  ]);
  return executeStatementBatches(
    client,
    (grants.rows || []).map((row) => String(row.grant_statement || "")),
  );
}

async function transferOwnedObjects(client, sourceRole, log) {
  const identity = await client.query(SESSION_IDENTITY_SQL);
  const databaseName = String(identity.rows?.[0]?.database_name || "");
  if (!databaseName) {
    throw new Error("Could not determine database before ownership transfer");
  }
  await resetAndAssertSession(
    client,
    sourceRole,
    databaseName,
    "ownership transfer reset",
  );

  const transferQueries = [
    RELATION_TRANSFER_SQL,
    ROUTINE_TRANSFER_SQL,
    TYPE_TRANSFER_SQL,
  ];
  let changed = 0;
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '2min'");
    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '2min'",
    );
    for (const transferQuery of transferQueries) {
      const result = await client.query(transferQuery, [
        sourceRole,
        SCHEMA_OWNER_ROLE,
        APPLICATION_SCHEMA,
      ]);
      const transferRows = result.rows || [];
      for (const batch of splitIntoBatches(transferRows)) {
        const catalogKinds = new Set(
          batch.map((row) => String(row.catalog_kind || "")),
        );
        if (catalogKinds.size !== 1) {
          throw new Error("Ownership transfer batch mixed catalog kinds");
        }
        const catalogKind = [...catalogKinds][0];
        const preOwners = await readObjectOwners(client, catalogKind, batch);
        const pending = selectRowsForOwnershipTransfer(batch, preOwners, {
          sourceRole,
          targetRole: SCHEMA_OWNER_ROLE,
          phase: catalogKind + " pre-transfer audit",
        });
        if (pending.length > 0) {
          await executeStatementBatches(
            client,
            pending.map((row) => String(row.ddl || "")),
          );
          changed += pending.length;
        }
        const postOwners = await readObjectOwners(client, catalogKind, batch);
        selectRowsForOwnershipTransfer(batch, postOwners, {
          sourceRole,
          targetRole: SCHEMA_OWNER_ROLE,
          phase: catalogKind + " post-transfer audit",
          requireTarget: true,
        });
      }
    }
    await client.query("SET LOCAL ROLE " + quoteIdentifier(SCHEMA_OWNER_ROLE));
    await assertActiveRole(
      client,
      sourceRole,
      SCHEMA_OWNER_ROLE,
      "atomic post-transfer runtime grants",
    );
    for (const runtimeRole of [OWNER_LOGIN_ROLE, RUNTIME_LOGIN_ROLE]) {
      await grantExistingRuntimeObjectAccess(client, runtimeRole);
    }
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Closing the direct connection is the final rollback fallback.
    }
    throw error;
  } finally {
    try {
      await client.query("RESET ROLE");
    } catch {
      // The outer cleanup resets again before closing the connection.
    }
  }
  log(
    "Transferred " +
      changed +
      " public non-extension object(s) from " +
      sourceRole +
      ".",
  );
  return changed;
}

async function grantRuntimeAccess(ownerClient, databaseName) {
  await ownerClient.query("SET ROLE " + quoteIdentifier(SCHEMA_OWNER_ROLE));
  await assertActiveRole(
    ownerClient,
    OWNER_LOGIN_ROLE,
    SCHEMA_OWNER_ROLE,
    "runtime grant activation",
  );
  await ownerClient.query("BEGIN");
  try {
    await ownerClient.query("SET LOCAL lock_timeout = '5s'");
    await ownerClient.query("SET LOCAL statement_timeout = '2min'");
    for (const runtimeRole of [OWNER_LOGIN_ROLE, RUNTIME_LOGIN_ROLE]) {
      await grantExistingRuntimeObjectAccess(ownerClient, runtimeRole);
    }

    const prefix =
      "ALTER DEFAULT PRIVILEGES FOR ROLE " +
      quoteIdentifier(SCHEMA_OWNER_ROLE) +
      " IN SCHEMA " +
      quoteIdentifier(APPLICATION_SCHEMA) +
      " GRANT ";
    await ownerClient.query(
      prefix +
        "SELECT, INSERT, UPDATE, DELETE ON TABLES TO " +
        quoteIdentifier(RUNTIME_LOGIN_ROLE),
    );
    await ownerClient.query(
      prefix +
        "USAGE, SELECT ON SEQUENCES TO " +
        quoteIdentifier(RUNTIME_LOGIN_ROLE),
    );
    await ownerClient.query(
      prefix + "EXECUTE ON ROUTINES TO " + quoteIdentifier(RUNTIME_LOGIN_ROLE),
    );
    await ownerClient.query(
      prefix + "USAGE ON TYPES TO " + quoteIdentifier(RUNTIME_LOGIN_ROLE),
    );
    await ownerClient.query("COMMIT");
  } catch (error) {
    try {
      await ownerClient.query("ROLLBACK");
    } catch {
      // Closing the direct connection is the final rollback fallback.
    }
    throw error;
  } finally {
    await ownerClient.query("RESET ROLE");
  }

  await resetAndAssertSession(
    ownerClient,
    OWNER_LOGIN_ROLE,
    databaseName,
    "database role-setting activation",
  );
  for (const runtimeRole of [OWNER_LOGIN_ROLE, RUNTIME_LOGIN_ROLE]) {
    await ownerClient.query(
      "ALTER ROLE " +
        quoteIdentifier(runtimeRole) +
        " IN DATABASE " +
        quoteIdentifier(databaseName) +
        " SET role TO " +
        quoteLiteral(SCHEMA_OWNER_ROLE),
    );
  }
  await ownerClient.query(
    "ALTER ROLE " +
      quoteIdentifier(RUNTIME_LOGIN_ROLE) +
      " IN DATABASE " +
      quoteIdentifier(databaseName) +
      " SET statement_timeout TO " +
      quoteLiteral(RUNTIME_STATEMENT_TIMEOUT),
  );
}

function defaultAclProblems(rows) {
  const actual = new Map();
  for (const row of rows) {
    const objectType = String(row.object_type || "");
    if (!actual.has(objectType)) actual.set(objectType, new Set());
    actual.get(objectType).add(String(row.privilege_type || "").toUpperCase());
  }
  const problems = [];
  for (const [objectType, requiredPrivileges] of Object.entries(
    DEFAULT_PRIVILEGES,
  )) {
    const actualPrivileges = actual.get(objectType) || new Set();
    for (const privilege of requiredPrivileges) {
      if (!actualPrivileges.has(privilege)) {
        problems.push("default " + objectType + " lacks " + privilege);
      }
    }
  }
  return problems;
}

function runtimeSettingsReady(rows) {
  const settings = (rows || []).map((row) => String(row.setting)).sort();
  return (
    settings.length === 2 &&
    settings[0] === "role=" + SCHEMA_OWNER_ROLE &&
    settings[1] === "statement_timeout=" + RUNTIME_STATEMENT_TIMEOUT
  );
}

async function collectAudit(ownerClient, databaseName) {
  // A pg Client is a single session. Queue these queries explicitly: pg 8.20
  // deprecates concurrent query calls on one Client, and pg 9 will reject them.
  const topology = await readTopology(ownerClient);
  const migrationTopology = await readLoginTopology(
    ownerClient,
    MIGRATION_LOGIN_ROLE,
  );
  const runtimeTopology = await readLoginTopology(
    ownerClient,
    RUNTIME_LOGIN_ROLE,
  );
  const objects = await ownerClient.query(OWNERSHIP_AUDIT_SQL, [
    APPLICATION_SCHEMA,
  ]);
  const runtimeAcl = await ownerClient.query(RUNTIME_ACL_AUDIT_SQL, [
    APPLICATION_SCHEMA,
    RUNTIME_LOGIN_ROLE,
  ]);
  const defaults = await ownerClient.query(DEFAULT_ACL_SQL, [
    SCHEMA_OWNER_ROLE,
    APPLICATION_SCHEMA,
    RUNTIME_LOGIN_ROLE,
  ]);
  const roleSetting = await ownerClient.query(DATABASE_ROLE_SETTING_SQL, [
    RUNTIME_LOGIN_ROLE,
    databaseName,
  ]);
  const ownerSchema = await ownerClient.query(SCHEMA_PRIVILEGE_SQL, [
    SCHEMA_OWNER_ROLE,
    APPLICATION_SCHEMA,
  ]);
  const runtimeSchema = await ownerClient.query(SCHEMA_PRIVILEGE_SQL, [
    RUNTIME_LOGIN_ROLE,
    APPLICATION_SCHEMA,
  ]);

  const objectRows = objects.rows || [];
  const ownershipMismatches = objectRows.filter(
    (row) => String(row.owner_name || "") !== SCHEMA_OWNER_ROLE,
  );
  const settingRows = roleSetting.rows || [];
  const roleSettingReady = runtimeSettingsReady(settingRows);
  return Object.freeze({
    topology,
    migrationTopology,
    runtimeTopology,
    objectRows,
    ownershipMismatches,
    runtimeAclMismatches: runtimeAcl.rows || [],
    defaultAclProblems: defaultAclProblems(defaults.rows || []),
    roleSettingRows: settingRows,
    roleSettingReady,
    ownerSchema: ownerSchema.rows?.[0] || null,
    runtimeSchema: runtimeSchema.rows?.[0] || null,
  });
}

function auditProblems(audit) {
  const problems = [
    ...topologyProblems(audit.topology),
    ...loginTopologyProblems(audit.migrationTopology, MIGRATION_LOGIN_ROLE),
    ...loginTopologyProblems(audit.runtimeTopology, RUNTIME_LOGIN_ROLE),
  ];
  if (audit.ownershipMismatches.length > 0) {
    problems.push(
      audit.ownershipMismatches.length + " object ownership mismatch(es)",
    );
  }
  if (audit.runtimeAclMismatches.length > 0) {
    const count = Number(
      audit.runtimeAclMismatches[0]?.mismatch_count ||
        audit.runtimeAclMismatches.length,
    );
    problems.push(count + " runtime object privilege mismatch(es)");
  }
  problems.push(...audit.defaultAclProblems);
  if (!audit.roleSettingReady) {
    problems.push(
      "database-bound runtime settings are not exactly role=" +
        SCHEMA_OWNER_ROLE +
        " and statement_timeout=" +
        RUNTIME_STATEMENT_TIMEOUT,
    );
  }
  if (
    audit.ownerSchema?.has_usage !== true ||
    audit.ownerSchema?.has_create !== true
  ) {
    problems.push("schema owner lacks public USAGE or CREATE");
  }
  if (audit.runtimeSchema?.has_usage !== true) {
    problems.push("runtime login lacks public USAGE");
  }
  return problems;
}

function formatOwnershipSample(rows) {
  return rows
    .slice(0, 10)
    .map(
      (row) =>
        String(row.object_kind) +
        " " +
        JSON.stringify(
          String(row.schema_name) + "." + String(row.object_name),
        ) +
        " owned by " +
        JSON.stringify(String(row.owner_name || "<unknown>")),
    );
}

function assertZeroDrift(audit) {
  const problems = auditProblems(audit);
  if (problems.length === 0) return;
  const details = [];
  if (audit.ownershipMismatches.length > 0) {
    details.push(...formatOwnershipSample(audit.ownershipMismatches));
  }
  if (audit.runtimeAclMismatches.length > 0) {
    details.push(
      ...audit.runtimeAclMismatches
        .slice(0, 10)
        .map(
          (row) =>
            String(row.object_kind) +
            " " +
            JSON.stringify(
              String(row.schema_name) + "." + String(row.object_name),
            ) +
            " lacks direct " +
            String(row.privilege_type),
        ),
    );
  }
  throw new Error(
    "Zero-drift ownership audit failed: " +
      problems.join("; ") +
      (details.length > 0 ? ". Sample: " + details.join("; ") : ""),
  );
}

function logDryRun(audit, log) {
  log("Dry-run inventory for schema " + APPLICATION_SCHEMA + ":");
  for (const group of groupOwnershipRows(audit.objectRows)) {
    log("  " + group.owner + ": " + group.count + " " + group.kind + "(s)");
  }
  const problems = auditProblems(audit);
  if (problems.length === 0) {
    log("Ownership bootstrap is already at zero drift.");
  } else {
    log("Planned bootstrap is required: " + problems.join("; ") + ".");
  }
}

async function verifyRuntimePool(Client, runtimeConfig, log) {
  const client = new Client({
    connectionString: runtimeConfig.raw,
    enableChannelBinding: true,
    application_name: "creatorhub-ownership-runtime-canary",
    connectionTimeoutMillis: 15_000,
    query_timeout: 130_000,
  });
  await client.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '2min'",
    );
    const identity = await client.query(SESSION_IDENTITY_SQL);
    const row = identity.rows?.[0];
    if (
      !row ||
      String(row.session_user || "") !== RUNTIME_LOGIN_ROLE ||
      String(row.current_user || "") !== SCHEMA_OWNER_ROLE
    ) {
      throw new Error(
        "Pooled runtime identity must be session_user=" +
          RUNTIME_LOGIN_ROLE +
          ", current_user=" +
          SCHEMA_OWNER_ROLE,
      );
    }
    if (String(row.database_name || "") !== runtimeConfig.database) {
      throw new Error("Pooled runtime connected to an unexpected database");
    }
    assertPostgres18(row.server_version_num);
    if (String(row.statement_timeout || "") !== RUNTIME_STATEMENT_TIMEOUT) {
      throw new Error(
        "Pooled runtime statement_timeout must be " + RUNTIME_STATEMENT_TIMEOUT,
      );
    }
    await client.query("SET LOCAL statement_timeout = '2min'");

    const canaryName =
      "__creatorhub_ownership_canary_" + randomUUID().replaceAll("-", "");
    const qualifiedCanary =
      quoteIdentifier(APPLICATION_SCHEMA) + "." + quoteIdentifier(canaryName);
    await client.query(
      "CREATE TABLE " +
        qualifiedCanary +
        " (id integer PRIMARY KEY, value text NOT NULL)",
    );
    await client.query(
      "ALTER TABLE " + qualifiedCanary + " ADD COLUMN touched_at timestamptz",
    );
    const ownerResult = await client.query(
      `
        SELECT pg_catalog.pg_get_userbyid(relation.relowner) AS owner_name
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = $1::text
          AND relation.relname = $2::text
      `,
      [APPLICATION_SCHEMA, canaryName],
    );
    if (String(ownerResult.rows?.[0]?.owner_name || "") !== SCHEMA_OWNER_ROLE) {
      throw new Error(
        "Pooled runtime canary was not owned by the schema owner",
      );
    }
    await client.query(
      "INSERT INTO " + qualifiedCanary + " (id, value) VALUES (1, $1::text)",
      ["created"],
    );
    await client.query(
      "UPDATE " + qualifiedCanary + " SET value = $1::text WHERE id = 1",
      ["updated"],
    );
    const readResult = await client.query(
      "SELECT value FROM " + qualifiedCanary + " WHERE id = 1",
    );
    if (readResult.rows?.[0]?.value !== "updated") {
      throw new Error("Pooled runtime canary read/write verification failed");
    }
    await client.query("DELETE FROM " + qualifiedCanary + " WHERE id = 1");
    await client.query("ROLLBACK");
    transactionStarted = false;
    log("Pooled runtime role and rollback-only DDL/DML canary passed.");
  } finally {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Closing the pooled client is the final rollback fallback.
      }
    }
    await client.end().catch(() => {});
  }
}

async function loadPgClient() {
  const pg = await import("pg");
  const Client = pg.Client || pg.default?.Client;
  if (!Client) throw new Error("The pg package did not expose Client");
  return Client;
}

function createDirectClient(Client, databaseConfig, applicationName) {
  return new Client({
    connectionString: databaseConfig.raw,
    enableChannelBinding: true,
    application_name: applicationName,
    connectionTimeoutMillis: 15_000,
    query_timeout: 130_000,
  });
}

async function verifyMigrationLogin(
  Client,
  migrationConfig,
  expectedServerVersionNumber,
  log,
) {
  const client = createDirectClient(
    Client,
    migrationConfig,
    "creatorhub-ownership-new-migration-canary",
  );
  await client.connect();
  try {
    await configureSession(client);
    const identity = await client.query(SESSION_IDENTITY_SQL);
    const row = identity.rows?.[0];
    if (
      !row ||
      String(row.session_user || "") !== MIGRATION_LOGIN_ROLE ||
      String(row.current_user || "") !== MIGRATION_LOGIN_ROLE
    ) {
      throw new Error(
        "Direct migration identity must be session_user=current_user=" +
          MIGRATION_LOGIN_ROLE,
      );
    }
    if (String(row.database_name || "") !== migrationConfig.database) {
      throw new Error(
        "Direct migration login connected to an unexpected database",
      );
    }
    const serverVersionNumber = assertPostgres18(row.server_version_num);
    if (serverVersionNumber !== expectedServerVersionNumber) {
      throw new Error(
        "New migration login reported a different database server",
      );
    }

    await client.query("SET ROLE " + quoteIdentifier(SCHEMA_OWNER_ROLE));
    await assertActiveRole(
      client,
      MIGRATION_LOGIN_ROLE,
      SCHEMA_OWNER_ROLE,
      "new migration owner activation",
    );
    await client.query("RESET ROLE");
    await assertActiveRole(
      client,
      MIGRATION_LOGIN_ROLE,
      MIGRATION_LOGIN_ROLE,
      "new migration login reset",
    );
    log("Direct least-privilege migration credential and SET ROLE passed.");
  } finally {
    try {
      await client.query("RESET ROLE");
    } catch {
      // Closing the direct client clears role state.
    }
    await client.end().catch(() => {});
  }
}

async function verifyRuntimeLogin(
  Client,
  runtimeConfig,
  expectedServerVersionNumber,
  log,
) {
  // Do not seed Neon's transaction pool before ALTER ROLE ... SET role is
  // installed. A direct auth canary proves the credential and SET membership;
  // the final canary is the first pooled connection for this new login.
  const client = new Client({
    connectionString: directNeonConnectionString(runtimeConfig.raw),
    enableChannelBinding: true,
    application_name: "creatorhub-ownership-new-runtime-auth-canary",
    connectionTimeoutMillis: 15_000,
    query_timeout: 130_000,
  });
  await client.connect();
  try {
    await configureSession(client);
    // A prior safe bootstrap may already have installed the database-bound
    // owner default. Select the login explicitly so this canary is rerunnable.
    await client.query("SET ROLE " + quoteIdentifier(RUNTIME_LOGIN_ROLE));
    const identity = await client.query(SESSION_IDENTITY_SQL);
    const row = identity.rows?.[0];
    if (
      !row ||
      String(row.session_user || "") !== RUNTIME_LOGIN_ROLE ||
      String(row.current_user || "") !== RUNTIME_LOGIN_ROLE
    ) {
      throw new Error(
        "Direct runtime authentication must use session_user=current_user=" +
          RUNTIME_LOGIN_ROLE,
      );
    }
    if (String(row.database_name || "") !== runtimeConfig.database) {
      throw new Error(
        "Direct runtime authentication connected to an unexpected database",
      );
    }
    const serverVersionNumber = assertPostgres18(row.server_version_num);
    if (serverVersionNumber !== expectedServerVersionNumber) {
      throw new Error("New runtime login reported a different database server");
    }

    await client.query("SET ROLE " + quoteIdentifier(SCHEMA_OWNER_ROLE));
    await assertActiveRole(
      client,
      RUNTIME_LOGIN_ROLE,
      SCHEMA_OWNER_ROLE,
      "new runtime owner activation",
    );
    await client.query("RESET ROLE");
    await client.query("SET ROLE " + quoteIdentifier(RUNTIME_LOGIN_ROLE));
    await assertActiveRole(
      client,
      RUNTIME_LOGIN_ROLE,
      RUNTIME_LOGIN_ROLE,
      "new runtime login reset",
    );
    log("Direct least-privilege runtime credential and SET ROLE passed.");
  } finally {
    try {
      await client.query("RESET ROLE");
    } catch {
      // Closing the direct client clears role state.
    }
    await client.end().catch(() => {});
  }
}

async function runBootstrap({ apply, env = process.env, log = console.log }) {
  const configuration = requireConfiguration(env, { apply });
  const Client = await loadPgClient();
  const ownerClient = createDirectClient(
    Client,
    configuration.owner,
    "creatorhub-ownership-owner",
  );
  const migratorClient = createDirectClient(
    Client,
    configuration.migrator,
    "creatorhub-ownership-migrator",
  );
  let lockAcquired = false;
  let ownerConnected = false;
  let migratorConnected = false;
  try {
    await ownerClient.connect();
    ownerConnected = true;
    await configureSession(ownerClient);
    const ownerIdentity = await resetAndAssertSession(
      ownerClient,
      OWNER_LOGIN_ROLE,
      configuration.owner.database,
      "direct owner connection",
    );

    await migratorClient.connect();
    migratorConnected = true;
    await configureSession(migratorClient);
    const migratorIdentity = await resetAndAssertSession(
      migratorClient,
      MIGRATOR_LOGIN_ROLE,
      configuration.migrator.database,
      "direct migrator connection",
    );
    if (
      ownerIdentity.serverVersionNumber !== migratorIdentity.serverVersionNumber
    ) {
      throw new Error(
        "Owner and migrator connections reported different servers",
      );
    }

    await acquireMigrationLock(ownerClient);
    lockAcquired = true;
    log(
      "Acquired production migration lock on host " +
        configuration.owner.hostname +
        ", database " +
        configuration.owner.database +
        ", PostgreSQL " +
        ownerIdentity.serverVersion +
        ".",
    );
    await assertLoginRoles(ownerClient);

    const initialTopology = await readTopology(ownerClient);
    validateTargetRoleShape(initialTopology.role, { allowMissing: true });
    if (initialTopology.role && initialTopology.memberOf.length > 0) {
      throw new Error(
        "Owner role must not be a member of any other role: " +
          initialTopology.memberOf.join(", "),
      );
    }
    const inventory = await ownerClient.query(OWNERSHIP_AUDIT_SQL, [
      APPLICATION_SCHEMA,
    ]);
    assertOnlyTransferableOwners(inventory.rows || []);

    if (apply) {
      await applyRoleTopologyAtomically(ownerClient, {
        migrationPassword: configuration.migration.password,
        runtimePassword: configuration.runtime.password,
      });
      await verifyMigrationLogin(
        Client,
        configuration.migration,
        ownerIdentity.serverVersionNumber,
        log,
      );
      await verifyRuntimeLogin(
        Client,
        configuration.runtime,
        ownerIdentity.serverVersionNumber,
        log,
      );
      await transferOwnedObjects(ownerClient, OWNER_LOGIN_ROLE, log);
      await transferOwnedObjects(migratorClient, MIGRATOR_LOGIN_ROLE, log);
      await resetAndAssertSession(
        ownerClient,
        OWNER_LOGIN_ROLE,
        configuration.owner.database,
        "pre-grant owner reset",
      );
      await grantRuntimeAccess(ownerClient, configuration.owner.database);
      await finalizeRoleTopology(ownerClient);
      const audit = await collectAudit(
        ownerClient,
        configuration.owner.database,
      );
      assertZeroDrift(audit);
      log(
        "Zero-drift ownership, membership, grants, and role-setting audit passed.",
      );

      await verifyRuntimePool(Client, configuration.runtime, log);
      return audit;
    }

    const audit = await collectAudit(ownerClient, configuration.owner.database);
    logDryRun(audit, log);
    if (configuration.runtime) {
      const topologyReady =
        topologyProblems(audit.topology).length === 0 &&
        loginTopologyProblems(audit.migrationTopology, MIGRATION_LOGIN_ROLE)
          .length === 0 &&
        loginTopologyProblems(audit.runtimeTopology, RUNTIME_LOGIN_ROLE)
          .length === 0;
      if (topologyReady && audit.roleSettingReady) {
        await verifyRuntimePool(Client, configuration.runtime, log);
      } else {
        log("Pooled runtime canary skipped until role topology is applied.");
      }
    }
    log(
      "Dry-run complete with no persistent changes. Use --apply with exact host confirmation to converge.",
    );
    return audit;
  } catch (error) {
    throw new Error(
      safeErrorMessage(error, configurationSecrets(configuration)),
    );
  } finally {
    if (migratorConnected) {
      try {
        await migratorClient.query("RESET ROLE");
      } catch {
        // Closing the connection also clears role state.
      }
    }
    if (ownerConnected) {
      try {
        await ownerClient.query("RESET ROLE");
      } catch {
        // Closing the connection also clears role state.
      }
    }
    if (lockAcquired) {
      try {
        await releaseMigrationLock(ownerClient);
        log("Released production migration lock.");
      } catch {
        // Closing the direct owner connection releases the session lock.
      }
    }
    if (migratorConnected) await migratorClient.end().catch(() => {});
    if (ownerConnected) await ownerClient.end().catch(() => {});
  }
}

async function runSelfTest() {
  assert.deepEqual(parseCli([]), { mode: "dry-run" });
  assert.deepEqual(parseCli(["--dry-run"]), { mode: "dry-run" });
  assert.deepEqual(parseCli(["--apply"]), { mode: "apply" });
  assert.deepEqual(parseCli(["--self-test"]), { mode: "self-test" });
  assert.throws(() => parseCli(["--apply", "--dry-run"]), /Choose only one/);
  assert.throws(() => parseCli(["--unknown"]), /Unknown argument/);
  assert.throws(() => parseCli(["--apply", "--apply"]), /must not be repeated/);

  const ownerUrl =
    "postgresql://neondb_owner@ep-example.eu.neon.tech/creatorhub?sslmode=require&channel_binding=require";
  const migratorUrl =
    "postgresql://creatorhub_migrator@ep-example.eu.neon.tech/creatorhub?sslmode=require&channel_binding=require";
  const migrationPassword = "migration_0123456789abcdefghijklmnop";
  const runtimePassword = "runtime_0123456789abcdefghijklmnopqrs";
  const migrationUrl =
    "postgresql://creatorhub_migration_login:" +
    migrationPassword +
    "@ep-example.eu.neon.tech/creatorhub?sslmode=require&channel_binding=require";
  const runtimeUrl =
    "postgresql://creatorhub_runtime_login:" +
    runtimePassword +
    "@ep-example-pooler.eu.neon.tech/creatorhub?sslmode=require&channel_binding=require";
  const owner = parseDatabaseUrl(ownerUrl, {
    variableName: OWNER_URL_ENV,
    expectedUser: OWNER_LOGIN_ROLE,
    pooled: false,
  });
  const migrator = parseDatabaseUrl(migratorUrl, {
    variableName: MIGRATOR_URL_ENV,
    expectedUser: MIGRATOR_LOGIN_ROLE,
    pooled: false,
  });
  const migration = parseDatabaseUrl(migrationUrl, {
    variableName: MIGRATION_URL_ENV,
    expectedUser: MIGRATION_LOGIN_ROLE,
    pooled: false,
    requireStrongPassword: true,
  });
  const runtime = parseDatabaseUrl(runtimeUrl, {
    variableName: RUNTIME_URL_ENV,
    expectedUser: RUNTIME_LOGIN_ROLE,
    pooled: true,
    requireStrongPassword: true,
  });
  assertSameDatabaseTarget(owner, migrator);
  assertSameDatabaseTarget(owner, migration);
  assertSameDatabaseTarget(owner, runtime, { allowPoolerDifference: true });
  assert.equal(runtime.normalizedEndpoint, owner.hostname);
  const directRuntimeUrl = new URL(directNeonConnectionString(runtimeUrl));
  assert.equal(directRuntimeUrl.hostname, owner.hostname);
  assert.equal(
    decodeURIComponent(directRuntimeUrl.username),
    RUNTIME_LOGIN_ROLE,
  );
  assert.equal(decodeURIComponent(directRuntimeUrl.password), runtimePassword);
  assert.throws(
    () => directNeonConnectionString(migrationUrl),
    /Expected a Neon pooled endpoint/,
  );
  const assertSecureRuntimeUrlRejection = (candidate, expectedError) => {
    assert.throws(
      () =>
        parseDatabaseUrl(candidate, {
          variableName: RUNTIME_URL_ENV,
          expectedUser: RUNTIME_LOGIN_ROLE,
          pooled: true,
          requireStrongPassword: true,
        }),
      (error) => {
        assert.match(error.message, expectedError);
        assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//);
        assert.doesNotMatch(error.message, new RegExp(runtimePassword));
        return true;
      },
    );
  };
  assertSecureRuntimeUrlRejection(
    runtimeUrl.replace(".neon.tech", ".example.com"),
    /ep-\* Neon endpoint/,
  );
  assertSecureRuntimeUrlRejection(
    runtimeUrl.replace("ep-example-pooler", "db-example-pooler"),
    /ep-\* Neon endpoint/,
  );
  assertSecureRuntimeUrlRejection(
    runtimeUrl.replace("sslmode=require", "sslmode=disable"),
    /exactly one sslmode/,
  );
  assertSecureRuntimeUrlRejection(
    runtimeUrl.replace(
      "sslmode=require",
      "sslmode=require&sslmode=verify-full",
    ),
    /exactly one sslmode/,
  );
  assertSecureRuntimeUrlRejection(
    runtimeUrl.replace("sslmode=require&", ""),
    /exactly one sslmode/,
  );
  assertSecureRuntimeUrlRejection(
    runtimeUrl.replace("channel_binding=require", "channel_binding=prefer"),
    /exactly one channel_binding=require/,
  );
  assertSecureRuntimeUrlRejection(
    runtimeUrl.replace("&channel_binding=require", ""),
    /exactly one channel_binding=require/,
  );
  assertSecureRuntimeUrlRejection(
    runtimeUrl + "&channel_binding=require",
    /exactly one channel_binding=require/,
  );
  assert.throws(
    () =>
      parseDatabaseUrl(runtimeUrl, {
        variableName: OWNER_URL_ENV,
        expectedUser: RUNTIME_LOGIN_ROLE,
        pooled: false,
      }),
    /direct, non-pooled/,
  );
  assert.throws(
    () =>
      parseDatabaseUrl(runtimeUrl.replace("-pooler.", "."), {
        variableName: RUNTIME_URL_ENV,
        expectedUser: RUNTIME_LOGIN_ROLE,
        pooled: true,
      }),
    /pooled endpoint/,
  );
  assert.throws(
    () =>
      parseDatabaseUrl(migratorUrl, {
        variableName: MIGRATOR_URL_ENV,
        expectedUser: OWNER_LOGIN_ROLE,
        pooled: false,
      }),
    /authenticate exactly/,
  );
  assert.throws(
    () =>
      assertSameDatabaseTarget(
        owner,
        parseDatabaseUrl(
          migratorUrl.replace("/creatorhub?", "/other_database?"),
          {
            variableName: MIGRATOR_URL_ENV,
            expectedUser: MIGRATOR_LOGIN_ROLE,
            pooled: false,
          },
        ),
      ),
    /same endpoint, port, and database/,
  );
  assertExactConfirmation(owner.hostname, owner.hostname);
  assert.throws(
    () => assertExactConfirmation(owner.hostname.toUpperCase(), owner.hostname),
    /must exactly equal/,
  );

  const configEnv = {
    [OWNER_URL_ENV]: ownerUrl,
    [MIGRATOR_URL_ENV]: migratorUrl,
    [MIGRATION_URL_ENV]: migrationUrl,
    [RUNTIME_URL_ENV]: runtimeUrl,
    [CONFIRM_HOST_ENV]: owner.hostname,
  };
  const requiredConfiguration = requireConfiguration(configEnv, {
    apply: true,
  });
  assert.equal(requiredConfiguration.migration.username, MIGRATION_LOGIN_ROLE);
  assert.equal(requiredConfiguration.runtime.username, RUNTIME_LOGIN_ROLE);
  assert.throws(
    () =>
      requireConfiguration(
        {
          ...configEnv,
          [MIGRATION_URL_ENV]: "",
          OWNERSHIP_MIGRATION_DATABASE_URL: migrationUrl,
        },
        { apply: false },
      ),
    /OWNERSHIP_NEW_MIGRATION_DATABASE_URL is required/,
  );
  assert.throws(
    () =>
      requireConfiguration(
        {
          ...configEnv,
          [RUNTIME_URL_ENV]: runtimeUrl.replace(
            runtimePassword,
            migrationPassword,
          ),
        },
        { apply: false },
      ),
    /must use different passwords/,
  );
  assert.throws(
    () =>
      parseDatabaseUrl(migrationUrl.replace(migrationPassword, "short"), {
        variableName: MIGRATION_URL_ENV,
        expectedUser: MIGRATION_LOGIN_ROLE,
        pooled: false,
        requireStrongPassword: true,
      }),
    /32-256 character base64url password/,
  );
  assert.equal(quoteLiteral("a'b"), "'a''b'");
  assert.equal(
    runtimeSettingsReady([
      { setting: "statement_timeout=30s" },
      { setting: "role=creatorhub_schema_owner" },
    ]),
    true,
  );
  assert.equal(
    runtimeSettingsReady([{ setting: "role=creatorhub_schema_owner" }]),
    false,
  );
  assert.equal(
    runtimeSettingsReady([
      { setting: "statement_timeout=0" },
      { setting: "role=creatorhub_schema_owner" },
    ]),
    false,
  );
  const redacted = redactSecrets(
    "failed " + ownerUrl + " password=another-secret",
    [ownerUrl],
  );
  assert.doesNotMatch(redacted, /another-secret/);
  assert.match(redacted, /REDACTED/);
  const credentialRedacted = redactSecrets(
    "failed " + migrationUrl + " " + migrationPassword,
    configurationSecrets(requiredConfiguration),
  );
  assert.doesNotMatch(credentialRedacted, new RegExp(migrationPassword));
  assert.doesNotMatch(credentialRedacted, new RegExp(runtimePassword));
  assert.doesNotMatch(credentialRedacted, /creatorhub_migration_login:[^@]+@/);
  assert.equal(assertPostgres18(180006), 180006);
  assert.throws(() => assertPostgres18(170012), /PostgreSQL 18/);
  assert.throws(() => assertPostgres18(190000), /PostgreSQL 18/);

  const healthyLoginRole = {
    rolcanlogin: true,
    rolinherit: false,
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
  };
  const createQueries = [];
  const createdRole = await createLoginRoleIfMissing(
    {
      async query(sql) {
        if (sql === TARGET_ROLE_SQL) return { rows: [] };
        if (sql === LOGIN_MEMBERSHIPS_SQL) return { rows: [] };
        createQueries.push(String(sql));
        return { rows: [] };
      },
    },
    MIGRATION_LOGIN_ROLE,
    migrationPassword,
  );
  assert.equal(createdRole, true);
  assert.equal(createQueries.length, 1);
  assert.ok(
    createQueries[0].includes("PASSWORD " + quoteLiteral(migrationPassword)),
  );
  assert.doesNotMatch(createQueries[0], /PASSWORD 'SCRAM-SHA-256\$/);

  await assert.rejects(
    createLoginRoleIfMissing(
      {
        async query(sql) {
          if (sql === TARGET_ROLE_SQL) return { rows: [] };
          if (sql === LOGIN_MEMBERSHIPS_SQL) return { rows: [] };
          const error = new Error("Neon rejected password=" + runtimePassword);
          error.code = "42501";
          throw error;
        },
      },
      RUNTIME_LOGIN_ROLE,
      runtimePassword,
    ),
    (error) => {
      assert.match(error.message, /42501/);
      assert.match(error.message, /Neon rejected/);
      assert.doesNotMatch(error.message, new RegExp(runtimePassword));
      return true;
    },
  );

  const atomicQueries = [];
  await applyRoleTopologyAtomically(
    {
      async query(sql) {
        atomicQueries.push(String(sql));
        return { rows: [] };
      },
    },
    { migrationPassword, runtimePassword },
    async (_client, credentials) => {
      assert.deepEqual(credentials, { migrationPassword, runtimePassword });
      atomicQueries.push("CONVERGE");
    },
  );
  assert.deepEqual(atomicQueries, [
    "BEGIN",
    "SET LOCAL password_encryption = 'scram-sha-256'",
    "CONVERGE",
    "COMMIT",
  ]);

  const rollbackQueries = [];
  await assert.rejects(
    applyRoleTopologyAtomically(
      {
        async query(sql) {
          rollbackQueries.push(String(sql));
          return { rows: [] };
        },
      },
      { migrationPassword, runtimePassword },
      async () => {
        rollbackQueries.push("CONVERGE");
        throw new Error("topology failure");
      },
    ),
    /topology failure/,
  );
  assert.deepEqual(rollbackQueries, [
    "BEGIN",
    "SET LOCAL password_encryption = 'scram-sha-256'",
    "CONVERGE",
    "ROLLBACK",
  ]);
  const exactLoginMembership = {
    granted_role: SCHEMA_OWNER_ROLE,
    grantor_role: OWNER_LOGIN_ROLE,
    admin_option: false,
    inherit_option: false,
    set_option: true,
  };
  const existingQueries = [];
  const existingRole = await createLoginRoleIfMissing(
    {
      async query(sql) {
        existingQueries.push(sql);
        if (sql === TARGET_ROLE_SQL) return { rows: [healthyLoginRole] };
        if (sql === LOGIN_MEMBERSHIPS_SQL) {
          return { rows: [exactLoginMembership] };
        }
        throw new Error("unexpected existing-role query");
      },
    },
    RUNTIME_LOGIN_ROLE,
    runtimePassword,
  );
  assert.equal(existingRole, false);
  assert.deepEqual(existingQueries, [TARGET_ROLE_SQL, LOGIN_MEMBERSHIPS_SQL]);
  assert.equal(STATEMENT_BATCH_SIZE, 100);
  assert.deepEqual(
    splitIntoBatches(Array.from({ length: 205 }, (_, index) => index)).map(
      (batch) => batch.length,
    ),
    [100, 100, 5],
  );
  assert.throws(() => splitIntoBatches([1], 0), /positive integer/);

  const transferFixture = [
    {
      object_oid: "101",
      object_identity: "public.first",
      ddl: "ALTER TABLE ONLY public.first OWNER TO creatorhub_schema_owner",
    },
    {
      object_oid: "102",
      object_identity: "public.second",
      ddl: "ALTER TABLE ONLY public.second OWNER TO creatorhub_schema_owner",
    },
  ];
  const pendingFixture = selectRowsForOwnershipTransfer(
    transferFixture,
    [
      { object_oid: "101", owner_name: OWNER_LOGIN_ROLE },
      { object_oid: "102", owner_name: SCHEMA_OWNER_ROLE },
    ],
    {
      sourceRole: OWNER_LOGIN_ROLE,
      targetRole: SCHEMA_OWNER_ROLE,
      phase: "self-test pre-transfer",
    },
  );
  assert.deepEqual(pendingFixture, [transferFixture[0]]);
  assert.deepEqual(
    selectRowsForOwnershipTransfer(
      transferFixture,
      transferFixture.map((row) => ({
        object_oid: row.object_oid,
        owner_name: SCHEMA_OWNER_ROLE,
      })),
      {
        sourceRole: OWNER_LOGIN_ROLE,
        targetRole: SCHEMA_OWNER_ROLE,
        phase: "self-test post-transfer",
        requireTarget: true,
      },
    ),
    [],
  );
  assert.throws(
    () =>
      selectRowsForOwnershipTransfer(
        transferFixture,
        [{ object_oid: "101", owner_name: OWNER_LOGIN_ROLE }],
        {
          sourceRole: OWNER_LOGIN_ROLE,
          targetRole: SCHEMA_OWNER_ROLE,
          phase: "self-test missing object",
        },
      ),
    /catalog drift.*disappeared/,
  );
  assert.throws(
    () =>
      selectRowsForOwnershipTransfer(
        [transferFixture[0]],
        [{ object_oid: "101", owner_name: "unexpected_owner" }],
        {
          sourceRole: OWNER_LOGIN_ROLE,
          targetRole: SCHEMA_OWNER_ROLE,
          phase: "self-test changed owner",
        },
      ),
    /ownership drift/,
  );

  const statementBatchCalls = [];
  const statementCount = await executeStatementBatches(
    {
      async query(...args) {
        statementBatchCalls.push(args);
        return { rows: [] };
      },
    },
    Array.from({ length: 205 }, (_, index) => "SELECT " + index),
  );
  assert.equal(statementCount, 205);
  assert.deepEqual(
    statementBatchCalls.map((call) => call.length),
    [1, 1, 1],
  );
  assert.deepEqual(
    statementBatchCalls.map(
      ([sql]) => (String(sql).match(/SELECT/g) || []).length,
    ),
    [100, 100, 5],
  );

  const healthyTopology = {
    role: {
      rolcanlogin: false,
      rolinherit: false,
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolbypassrls: false,
    },
    memberOf: [],
    members: [
      {
        member_name: OWNER_LOGIN_ROLE,
        grant_count: 2,
        admin_only_grant_count: 1,
        set_only_grant_count: 1,
        admin_option: true,
        inherit_option: false,
        set_option: true,
      },
      {
        member_name: MIGRATION_LOGIN_ROLE,
        grant_count: 1,
        admin_only_grant_count: 0,
        set_only_grant_count: 1,
        admin_option: false,
        inherit_option: false,
        set_option: true,
      },
      {
        member_name: RUNTIME_LOGIN_ROLE,
        grant_count: 1,
        admin_only_grant_count: 0,
        set_only_grant_count: 1,
        admin_option: false,
        inherit_option: false,
        set_option: true,
      },
    ],
  };
  assert.deepEqual(topologyProblems(healthyTopology), []);
  assert.match(
    topologyProblems({
      ...healthyTopology,
      members: [
        ...healthyTopology.members,
        {
          member_name: "unexpected_role",
          admin_option: false,
          inherit_option: false,
          set_option: true,
        },
      ],
    }).join(" "),
    /unexpected owner-role member/,
  );
  assert.match(
    topologyProblems({
      ...healthyTopology,
      members: healthyTopology.members.map((row) =>
        row.member_name === RUNTIME_LOGIN_ROLE
          ? { ...row, grant_count: 2 }
          : row,
      ),
    }).join(" "),
    /membership options differ/,
  );
  const healthyLoginTopology = {
    role: healthyLoginRole,
    memberships: [exactLoginMembership],
  };
  assert.deepEqual(
    loginTopologyProblems(healthyLoginTopology, RUNTIME_LOGIN_ROLE),
    [],
  );
  assert.match(
    loginTopologyProblems(
      { ...healthyLoginTopology, memberships: [] },
      RUNTIME_LOGIN_ROLE,
    ).join(" "),
    /exactly one direct membership/,
  );
  assert.match(
    topologyProblems({
      ...healthyTopology,
      memberOf: ["neon_superuser"],
    }).join(" "),
    /unexpectedly a member/,
  );
  assert.throws(
    () =>
      loginTopologyProblems(
        {
          ...healthyLoginTopology,
          role: { ...healthyLoginRole, rolinherit: true },
        },
        RUNTIME_LOGIN_ROLE,
      ),
    /unsafe attributes/,
  );
  assert.deepEqual(
    defaultAclProblems([
      ...DEFAULT_PRIVILEGES.r.map((privilege_type) => ({
        object_type: "r",
        privilege_type,
      })),
      ...DEFAULT_PRIVILEGES.S.map((privilege_type) => ({
        object_type: "S",
        privilege_type,
      })),
      ...DEFAULT_PRIVILEGES.f.map((privilege_type) => ({
        object_type: "f",
        privilege_type,
      })),
      ...DEFAULT_PRIVILEGES.T.map((privilege_type) => ({
        object_type: "T",
        privilege_type,
      })),
    ]),
    [],
  );

  const allSql = [
    OWNERSHIP_AUDIT_SQL,
    RELATION_TRANSFER_SQL,
    ROUTINE_TRANSFER_SQL,
    TYPE_TRANSFER_SQL,
    OBJECT_GRANTS_SQL,
  ].join("\n");
  assert.doesNotMatch(allSql, /REASSIGN\s+OWNED/i);
  assert.match(RELATION_TRANSFER_SQL, /'r', 'p', 'f', 'v', 'm', 'S'/);
  assert.match(RELATION_TRANSFER_SQL, /ALTER TABLE ONLY/);
  assert.match(RELATION_TRANSFER_SQL, /ALTER FOREIGN TABLE ONLY/);
  assert.match(ROUTINE_TRANSFER_SQL, /pg_get_function_identity_arguments/);
  assert.match(TYPE_TRANSFER_SQL, /ALTER DOMAIN/);
  assert.match(OBJECT_GRANTS_SQL, /GRANT USAGE ON DOMAIN/);
  assert.match(OBJECT_GRANTS_SQL, /GRANT USAGE ON TYPE/);
  for (const lookupSql of Object.values(OBJECT_OWNER_LOOKUP_SQL)) {
    assert.match(lookupSql, /oid = ANY\(\$1::oid\[\]\)/);
  }
  assert.equal(
    (allSql.match(/refclassid = 'pg_catalog\.pg_extension'::regclass/g) || [])
      .length,
    9,
  );
  assert.match(TARGET_MEMBERS_SQL, /inherit_option/);
  assert.match(TARGET_MEMBERS_SQL, /set_option/);
  assert.match(TARGET_MEMBERS_SQL, /admin_only_grant_count/);
  assert.match(TARGET_MEMBERS_SQL, /set_only_grant_count/);
  assert.match(createDirectClient.toString(), /enableChannelBinding: true/);
  const runtimePoolSource = verifyRuntimePool.toString();
  assert.match(runtimePoolSource, /enableChannelBinding: true/);
  assert.doesNotMatch(runtimePoolSource, /configureSession/);
  assert.ok(
    runtimePoolSource.indexOf('client.query("BEGIN")') <
      runtimePoolSource.indexOf("SESSION_IDENTITY_SQL"),
  );
  assert.match(verifyRuntimeLogin.toString(), /enableChannelBinding: true/);
  const bootstrapSource = runBootstrap.toString();
  const runtimeCanaryIndex = bootstrapSource.indexOf(
    "await verifyRuntimeLogin(",
  );
  const firstTransferIndex = bootstrapSource.indexOf(
    "await transferOwnedObjects(",
  );
  assert.ok(runtimeCanaryIndex >= 0 && runtimeCanaryIndex < firstTransferIndex);

  console.log("Ownership bootstrap self-test passed.");
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  if (cli.mode === "help") {
    printUsage();
    return;
  }
  if (cli.mode === "self-test") {
    await runSelfTest();
    return;
  }
  await runBootstrap({ apply: cli.mode === "apply" });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((error) => {
    const secrets = [
      process.env[OWNER_URL_ENV],
      process.env[MIGRATOR_URL_ENV],
      process.env[MIGRATION_URL_ENV],
      process.env[RUNTIME_URL_ENV],
    ];
    console.error(
      "Ownership bootstrap failed: " + safeErrorMessage(error, secrets),
    );
    process.exitCode = 1;
  });
}

export {
  parseCli,
  parseDatabaseUrl,
  redactSecrets,
  requireConfiguration,
  runBootstrap,
};
