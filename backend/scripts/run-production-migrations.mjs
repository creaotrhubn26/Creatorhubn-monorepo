#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const DEFAULT_MIGRATIONS_DIR = path.resolve(SCRIPT_DIR, "..", "migrations");
const MIGRATION_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]*\.sql$/;
const LEGACY_LEDGER_MANIFEST_FILENAME = "legacy-applied-migrations.json";
const LEGACY_LEDGER_MANIFEST_FORMAT_VERSION = 1;
const LEGACY_LEDGER_BASELINE_ID = "creatorhub-production-ledger-2026-08-31";
const LEGACY_LEDGER_MANIFEST_KEYS = Object.freeze([
  "baselineId",
  "formatVersion",
  "legacyAppliedFilenames",
]);
const LEGACY_REPOSITORY_MIGRATION_FILENAMES = Object.freeze([
  "add-fiken-business-type-profession.sql",
  "add_tutorial_video_to_announcements.sql",
  "create-deletion-audit-tables.sql",
  "create-product-catalog-images.sql",
  "migrate-role-room-integration.sql",
  "migrate-role-room-tables.sql",
  "phase2-timeline-visual-hierarchy.sql",
  "task16-timeline-sync-locks.sql",
]);
const ROLE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const EXPECTED_MIGRATION_LOGIN_ROLE = "creatorhub_migration_login";
const EXPECTED_MIGRATION_OWNER_ROLE = "creatorhub_schema_owner";
const EXPECTED_OWNER_ADMIN_MEMBER_ROLE = "neondb_owner";
const EXPECTED_RUNTIME_LOGIN_ROLE = "creatorhub_runtime_login";
const SCHEMA_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const ALLOWED_POSTGRES_TLS_MODES = new Set([
  "require",
  "verify-ca",
  "verify-full",
]);

const SESSION_IDENTITY_SQL = `
  SELECT
    session_user::text AS session_user,
    current_user::text AS current_user
`;

const ROLE_ATTRIBUTES_SQL = `
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

const ROLE_MEMBERSHIP_SQL = `
  SELECT
    (
      SELECT COUNT(*)::integer
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS member_role
        ON member_role.oid = membership.member
      WHERE member_role.rolname = $1::text
    ) AS login_membership_count,
    (
      SELECT COUNT(*)::integer
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS member_role
        ON member_role.oid = membership.member
      JOIN pg_catalog.pg_roles AS granted_role
        ON granted_role.oid = membership.roleid
      WHERE member_role.rolname = $1::text
        AND granted_role.rolname = $2::text
        AND membership.admin_option = FALSE
        AND membership.inherit_option = FALSE
        AND membership.set_option = TRUE
    ) AS exact_owner_membership_count,
    (
      SELECT COUNT(*)::integer
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS member_role
        ON member_role.oid = membership.member
      WHERE member_role.rolname = $2::text
    ) AS owner_membership_count,
    (
      SELECT COUNT(*)::integer
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS granted_role
        ON granted_role.oid = membership.roleid
      WHERE granted_role.rolname = $2::text
    ) AS owner_direct_member_count,
    (
      SELECT COUNT(*)::integer
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS member_role
        ON member_role.oid = membership.member
      JOIN pg_catalog.pg_roles AS granted_role
        ON granted_role.oid = membership.roleid
      WHERE member_role.rolname = $3::text
        AND granted_role.rolname = $2::text
        AND membership.inherit_option = FALSE
        AND membership.set_option = TRUE
    ) AS owner_admin_member_count,
    (
      SELECT COUNT(*)::integer
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS member_role
        ON member_role.oid = membership.member
      JOIN pg_catalog.pg_roles AS granted_role
        ON granted_role.oid = membership.roleid
      WHERE member_role.rolname = $1::text
        AND granted_role.rolname = $2::text
        AND membership.admin_option = FALSE
        AND membership.inherit_option = FALSE
        AND membership.set_option = TRUE
    ) AS owner_migration_member_count,
    (
      SELECT COUNT(*)::integer
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS member_role
        ON member_role.oid = membership.member
      JOIN pg_catalog.pg_roles AS granted_role
        ON granted_role.oid = membership.roleid
      WHERE member_role.rolname = $4::text
        AND granted_role.rolname = $2::text
        AND membership.admin_option = FALSE
        AND membership.inherit_option = FALSE
        AND membership.set_option = TRUE
    ) AS owner_runtime_member_count
`;

const SCHEMA_PRIVILEGES_SQL = `
  SELECT
    requested.schema_name,
    namespace.oid IS NOT NULL AS schema_exists,
    CASE
      WHEN namespace.oid IS NULL THEN FALSE
      ELSE pg_catalog.has_schema_privilege($1::name, namespace.oid, 'USAGE')
    END AS has_usage,
    CASE
      WHEN namespace.oid IS NULL THEN FALSE
      ELSE pg_catalog.has_schema_privilege($1::name, namespace.oid, 'CREATE')
    END AS has_create
  FROM unnest($2::text[]) AS requested(schema_name)
  LEFT JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.nspname = requested.schema_name
  ORDER BY requested.schema_name
`;

const MIGRATION_SEARCH_PATH = "public, pg_temp";

const MIGRATION_SEARCH_PATH_SQL = `
  SELECT pg_catalog.current_setting('search_path')::text AS search_path
`;

const MIGRATION_TRACKER_RELATION_SQL = `
  SELECT
    relation.oid::integer AS relation_oid,
    relation.relkind,
    pg_catalog.pg_get_userbyid(relation.relowner) AS owner_name
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = '_migrations_applied'
`;

const MIGRATION_TRACKER_COLUMNS_SQL = `
  SELECT
    attribute.attnum::integer AS ordinal,
    attribute.attname AS column_name,
    pg_catalog.format_type(
      attribute.atttypid,
      attribute.atttypmod
    ) AS data_type,
    attribute.attnotnull AS not_null,
    CASE
      WHEN default_entry.oid IS NULL THEN NULL
      ELSE pg_catalog.pg_get_expr(
        default_entry.adbin,
        default_entry.adrelid
      )
    END AS default_expression
  FROM pg_catalog.pg_attribute AS attribute
  LEFT JOIN pg_catalog.pg_attrdef AS default_entry
    ON default_entry.adrelid = attribute.attrelid
   AND default_entry.adnum = attribute.attnum
  WHERE attribute.attrelid = $1::oid
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
  ORDER BY attribute.attnum
`;

const MIGRATION_TRACKER_INDEXES_SQL = `
  SELECT
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index AS index_entry
      JOIN pg_catalog.pg_attribute AS key_attribute
        ON key_attribute.attrelid = index_entry.indrelid
       AND key_attribute.attnum = ANY(index_entry.indkey::smallint[])
      WHERE index_entry.indrelid = $1::oid
        AND index_entry.indisprimary
        AND index_entry.indisvalid
        AND index_entry.indisready
        AND index_entry.indislive
        AND index_entry.indnkeyatts = 1
        AND index_entry.indnatts = 1
        AND index_entry.indexprs IS NULL
        AND index_entry.indpred IS NULL
        AND key_attribute.attname = 'id'
    ) AS has_primary_id,
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index AS index_entry
      JOIN pg_catalog.pg_attribute AS key_attribute
        ON key_attribute.attrelid = index_entry.indrelid
       AND key_attribute.attnum = ANY(index_entry.indkey::smallint[])
      WHERE index_entry.indrelid = $1::oid
        AND index_entry.indisunique
        AND index_entry.indisvalid
        AND index_entry.indisready
        AND index_entry.indislive
        AND index_entry.indnkeyatts = 1
        AND index_entry.indnatts = 1
        AND index_entry.indexprs IS NULL
        AND index_entry.indpred IS NULL
        AND key_attribute.attname = 'filename'
    ) AS has_unique_filename
`;

const MIGRATION_TRACKER_EXPECTED_COLUMNS = Object.freeze([
  Object.freeze({
    ordinal: 1,
    columnName: "id",
    dataType: "integer",
    notNull: true,
    defaultKind: "serial",
  }),
  Object.freeze({
    ordinal: 2,
    columnName: "filename",
    dataType: "character varying(255)",
    notNull: true,
    defaultKind: "none",
  }),
  Object.freeze({
    ordinal: 3,
    columnName: "applied_at",
    dataType: "timestamp without time zone",
    notNull: false,
    defaultKind: "now",
  }),
  Object.freeze({
    ordinal: 4,
    columnName: "checksum_sha256",
    dataType: "character varying(64)",
    notNull: false,
    defaultKind: "none",
  }),
]);

const MIGRATION_LEDGER_FILENAMES_SQL = `
  SELECT filename
  FROM public._migrations_applied
  ORDER BY filename
`;

const OWNERSHIP_AUDIT_SQL = `
  WITH application_objects AS (
    SELECT
      'relation'::text AS object_kind,
      namespace.nspname AS schema_name,
      relation.relname AS object_name,
      pg_catalog.pg_get_userbyid(relation.relowner) AS owner_name
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = ANY($1::text[])
      AND relation.relkind IN ('r', 'p', 'i', 'I', 'S', 'v', 'm', 'f')
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
        ELSE 'function'
      END AS object_kind,
      namespace.nspname AS schema_name,
      routine.proname || '(' ||
        pg_catalog.pg_get_function_identity_arguments(routine.oid) || ')' AS object_name,
      pg_catalog.pg_get_userbyid(routine.proowner) AS owner_name
    FROM pg_catalog.pg_proc AS routine
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname = ANY($1::text[])
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
      pg_catalog.pg_get_userbyid(type_entry.typowner) AS owner_name
    FROM pg_catalog.pg_type AS type_entry
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = type_entry.typnamespace
    LEFT JOIN pg_catalog.pg_class AS type_relation
      ON type_relation.oid = type_entry.typrelid
    WHERE namespace.nspname = ANY($1::text[])
      AND (
        (type_entry.typrelid = 0 AND type_entry.typtype IN ('d', 'e', 'r', 'm'))
        OR type_relation.relkind = 'c'
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
    schema_name,
    object_name,
    owner_name,
    COUNT(*) OVER ()::integer AS mismatch_count
  FROM application_objects
  WHERE owner_name IS DISTINCT FROM $2::text
  ORDER BY object_kind, schema_name, object_name
  LIMIT 51
`;
const LOCK_NAMESPACE = "creatorhub";
const LOCK_NAME = "production-migrations";

function safeErrorMessage(error) {
  if (!(error instanceof Error)) return "unknown_error";
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code || "")
      : "";
  return code ? code + ": " + error.message : error.message;
}

export function requireDatabaseUrl(value = process.env.DATABASE_URL) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    throw new Error("DATABASE_URL is required");
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the postgres or postgresql scheme");
  }
  if (!parsed.hostname || !parsed.username) {
    throw new Error("DATABASE_URL must include a hostname and username");
  }
  if (parsed.hostname.toLowerCase().includes("-pooler.")) {
    throw new Error(
      "DATABASE_URL must use a direct PostgreSQL endpoint, not a pooled endpoint",
    );
  }
  const connectionParameterValues = (parameterName) =>
    [...parsed.searchParams.entries()]
      .filter(([name]) => name.toLowerCase() === parameterName)
      .map(([, parameterValue]) => String(parameterValue).toLowerCase());
  const sslModes = connectionParameterValues("sslmode");
  if (sslModes.length !== 1 || !ALLOWED_POSTGRES_TLS_MODES.has(sslModes[0])) {
    throw new Error(
      "DATABASE_URL must set exactly one sslmode=require, verify-ca, or verify-full",
    );
  }
  const channelBindings = connectionParameterValues("channel_binding");
  if (channelBindings.length !== 1 || channelBindings[0] !== "require") {
    throw new Error(
      "DATABASE_URL must set exactly one channel_binding=require",
    );
  }
  return candidate;
}

export function parseCliOptions(argv = process.argv.slice(2)) {
  const allowedOptions = new Set([
    "--self-test",
    "--preflight-only",
    "--expect-zero",
  ]);
  const unsupportedOptions = argv.filter(
    (option) => !allowedOptions.has(option),
  );
  if (unsupportedOptions.length > 0) {
    throw new Error(
      "Unsupported migration runner option(s): " +
        unsupportedOptions.map((option) => JSON.stringify(option)).join(", "),
    );
  }

  const selfTest = argv.includes("--self-test");
  const preflightOnly = argv.includes("--preflight-only");
  const expectZero = argv.includes("--expect-zero");
  if (selfTest && (preflightOnly || expectZero)) {
    throw new Error(
      "--self-test cannot be combined with --preflight-only or --expect-zero",
    );
  }
  if (preflightOnly && expectZero) {
    throw new Error("--preflight-only and --expect-zero cannot be combined");
  }

  return Object.freeze({
    selfTest,
    preflightOnly,
    expectZero,
  });
}

function requireSafeIdentifier(value, variableName, pattern) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    throw new Error(variableName + " is required");
  }
  if (!pattern.test(candidate)) {
    throw new Error(
      variableName +
        " must be an unquoted lowercase PostgreSQL identifier (max 63 bytes)",
    );
  }
  return candidate;
}

export function requireMigrationRoleConfig(env = process.env) {
  const loginRole = requireSafeIdentifier(
    env.MIGRATION_LOGIN_ROLE,
    "MIGRATION_LOGIN_ROLE",
    ROLE_IDENTIFIER,
  );
  const ownerRole = requireSafeIdentifier(
    env.MIGRATION_OWNER_ROLE,
    "MIGRATION_OWNER_ROLE",
    ROLE_IDENTIFIER,
  );
  if (loginRole !== EXPECTED_MIGRATION_LOGIN_ROLE) {
    throw new Error(
      "MIGRATION_LOGIN_ROLE must be exactly " + EXPECTED_MIGRATION_LOGIN_ROLE,
    );
  }
  if (ownerRole !== EXPECTED_MIGRATION_OWNER_ROLE) {
    throw new Error(
      "MIGRATION_OWNER_ROLE must be exactly " + EXPECTED_MIGRATION_OWNER_ROLE,
    );
  }
  if (loginRole === ownerRole) {
    throw new Error(
      "MIGRATION_LOGIN_ROLE and MIGRATION_OWNER_ROLE must be different roles",
    );
  }

  const schemasValue = String(env.MIGRATION_OWNED_SCHEMAS || "").trim();
  if (!schemasValue) {
    throw new Error("MIGRATION_OWNED_SCHEMAS is required");
  }
  const ownedSchemas = schemasValue
    .split(",")
    .map((schema) =>
      requireSafeIdentifier(
        schema,
        "MIGRATION_OWNED_SCHEMAS entry",
        SCHEMA_IDENTIFIER,
      ),
    );
  if (new Set(ownedSchemas).size !== ownedSchemas.length) {
    throw new Error("MIGRATION_OWNED_SCHEMAS must not contain duplicates");
  }
  if (!ownedSchemas.includes("public")) {
    throw new Error(
      "MIGRATION_OWNED_SCHEMAS must include public for unqualified migrations",
    );
  }

  return Object.freeze({
    loginRole,
    ownerRole,
    ownedSchemas: Object.freeze(ownedSchemas),
  });
}

function quoteIdentifier(identifier) {
  if (!ROLE_IDENTIFIER.test(identifier)) {
    throw new Error("Unsafe PostgreSQL role identifier");
  }
  return '"' + identifier.replaceAll('"', '""') + '"';
}

function requireIdentityRow(result, phase) {
  if (!result || result.rows?.length !== 1) {
    throw new Error(
      "Migration preflight could not determine session identity during " +
        phase,
    );
  }
  return {
    sessionUser: String(result.rows[0].session_user || ""),
    currentUser: String(result.rows[0].current_user || ""),
  };
}

function assertExpectedIdentity(
  identity,
  expectedSession,
  expectedCurrent,
  phase,
) {
  if (
    identity.sessionUser !== expectedSession ||
    identity.currentUser !== expectedCurrent
  ) {
    throw new Error(
      "Migration preflight role mismatch during " +
        phase +
        ": expected session_user=" +
        JSON.stringify(expectedSession) +
        " and current_user=" +
        JSON.stringify(expectedCurrent) +
        ", received session_user=" +
        JSON.stringify(identity.sessionUser) +
        " and current_user=" +
        JSON.stringify(identity.currentUser),
    );
  }
}
function requireSearchPath(result, phase) {
  if (!result || result.rows?.length !== 1) {
    throw new Error(
      "Migration preflight could not determine search_path during " + phase,
    );
  }
  const searchPath = String(result.rows[0].search_path || "");
  if (searchPath !== MIGRATION_SEARCH_PATH) {
    throw new Error(
      "Migration search_path drift during " +
        phase +
        ": expected " +
        JSON.stringify(MIGRATION_SEARCH_PATH) +
        ", received " +
        JSON.stringify(searchPath),
    );
  }
  return searchPath;
}

async function assertMigrationSessionState(client, roleConfig, phase) {
  const identity = requireIdentityRow(
    await client.query(SESSION_IDENTITY_SQL),
    phase,
  );
  assertExpectedIdentity(
    identity,
    roleConfig.loginRole,
    roleConfig.ownerRole,
    phase,
  );
  const searchPath = requireSearchPath(
    await client.query(MIGRATION_SEARCH_PATH_SQL),
    phase,
  );
  return {
    ...identity,
    searchPath,
  };
}

const LOGIN_FORBIDDEN_ROLE_ATTRIBUTES = [
  ["rolinherit", "INHERIT"],
  ["rolsuper", "SUPERUSER"],
  ["rolcreaterole", "CREATEROLE"],
  ["rolcreatedb", "CREATEDB"],
  ["rolreplication", "REPLICATION"],
  ["rolbypassrls", "BYPASSRLS"],
];
const OWNER_FORBIDDEN_ROLE_ATTRIBUTES = LOGIN_FORBIDDEN_ROLE_ATTRIBUTES;

function assertLeastPrivilegeRole(
  role,
  { name, canLogin, forbiddenAttributes },
) {
  if (!role) {
    throw new Error(
      "Migration preflight required PostgreSQL role does not exist: " +
        JSON.stringify(name),
    );
  }
  if (role.rolcanlogin !== canLogin) {
    throw new Error(
      "Migration preflight role " +
        JSON.stringify(name) +
        (canLogin ? " must have LOGIN" : " must be NOLOGIN"),
    );
  }

  const forbidden = forbiddenAttributes
    .filter(([attribute]) => role[attribute] === true)
    .map(([, label]) => label);
  if (forbidden.length > 0) {
    throw new Error(
      "Migration preflight role " +
        JSON.stringify(name) +
        " has forbidden attributes: " +
        forbidden.join(", "),
    );
  }
}

function formatOwnershipMismatch(row) {
  return (
    String(row.object_kind || "object") +
    " " +
    JSON.stringify(
      String(row.schema_name || "") + "." + String(row.object_name || ""),
    ) +
    " owned by " +
    JSON.stringify(String(row.owner_name || "unknown"))
  );
}

async function auditMigrationOwnership(client, roleConfig, phase) {
  const { ownerRole, ownedSchemas } = roleConfig;
  const schemaResult = await client.query(SCHEMA_PRIVILEGES_SQL, [
    ownerRole,
    ownedSchemas,
  ]);
  const schemasByName = new Map(
    schemaResult.rows.map((row) => [String(row.schema_name), row]),
  );
  const schemaFailures = [];
  for (const schemaName of ownedSchemas) {
    const row = schemasByName.get(schemaName);
    if (!row || row.schema_exists !== true) {
      schemaFailures.push(JSON.stringify(schemaName) + " does not exist");
      continue;
    }
    const missing = [];
    if (row.has_usage !== true) missing.push("USAGE");
    if (row.has_create !== true) missing.push("CREATE");
    if (missing.length > 0) {
      schemaFailures.push(
        JSON.stringify(schemaName) + " lacks " + missing.join(" and "),
      );
    }
  }
  if (schemaFailures.length > 0) {
    throw new Error(
      "Migration " +
        phase +
        " schema privilege audit failed: " +
        schemaFailures.join("; "),
    );
  }

  const ownershipResult = await client.query(OWNERSHIP_AUDIT_SQL, [
    ownedSchemas,
    ownerRole,
  ]);
  if (ownershipResult.rows.length === 0) return;

  const mismatchCount = Number(
    ownershipResult.rows[0].mismatch_count || ownershipResult.rows.length,
  );
  const visibleMismatches = ownershipResult.rows
    .slice(0, 20)
    .map(formatOwnershipMismatch);
  const omittedCount = Math.max(0, mismatchCount - visibleMismatches.length);
  throw new Error(
    "Migration " +
      phase +
      " ownership audit found " +
      mismatchCount +
      " object(s) not owned by " +
      JSON.stringify(ownerRole) +
      ": " +
      visibleMismatches.join("; ") +
      (omittedCount > 0 ? "; plus " + omittedCount + " more" : ""),
  );
}

export async function runMigrationPreflight(
  client,
  { roleConfig, log = console.log } = {},
) {
  if (!roleConfig) {
    throw new Error("Migration role configuration is required");
  }
  const { loginRole, ownerRole, ownedSchemas } = roleConfig;

  const initialIdentity = requireIdentityRow(
    await client.query(SESSION_IDENTITY_SQL),
    "initial connection",
  );
  assertExpectedIdentity(
    initialIdentity,
    loginRole,
    loginRole,
    "initial connection",
  );

  const roleResult = await client.query(ROLE_ATTRIBUTES_SQL, [
    [loginRole, ownerRole],
  ]);
  const rolesByName = new Map(
    roleResult.rows.map((row) => [String(row.rolname), row]),
  );
  assertLeastPrivilegeRole(rolesByName.get(loginRole), {
    name: loginRole,
    canLogin: true,
    forbiddenAttributes: LOGIN_FORBIDDEN_ROLE_ATTRIBUTES,
  });
  assertLeastPrivilegeRole(rolesByName.get(ownerRole), {
    name: ownerRole,
    canLogin: false,
    forbiddenAttributes: OWNER_FORBIDDEN_ROLE_ATTRIBUTES,
  });

  const membershipResult = await client.query(ROLE_MEMBERSHIP_SQL, [
    loginRole,
    ownerRole,
    EXPECTED_OWNER_ADMIN_MEMBER_ROLE,
    EXPECTED_RUNTIME_LOGIN_ROLE,
  ]);
  const membership = membershipResult.rows?.[0];
  if (
    membershipResult.rows?.length !== 1 ||
    Number(membership?.login_membership_count) !== 1 ||
    Number(membership?.exact_owner_membership_count) !== 1
  ) {
    throw new Error(
      "Migration login role " +
        JSON.stringify(loginRole) +
        " must have exactly one direct ADMIN FALSE, INHERIT FALSE, SET TRUE membership in owner " +
        JSON.stringify(ownerRole),
    );
  }
  if (Number(membership.owner_membership_count) !== 0) {
    throw new Error(
      "Migration owner role " +
        JSON.stringify(ownerRole) +
        " must not be a member of another role",
    );
  }
  if (
    Number(membership.owner_direct_member_count) !== 3 ||
    Number(membership.owner_admin_member_count) !== 1 ||
    Number(membership.owner_migration_member_count) !== 1 ||
    Number(membership.owner_runtime_member_count) !== 1
  ) {
    throw new Error(
      "Migration owner role " +
        JSON.stringify(ownerRole) +
        " has unexpected direct members or membership options",
    );
  }

  await client.query("SET ROLE " + quoteIdentifier(ownerRole));
  await client.query("SET search_path TO public, pg_temp");
  await assertMigrationSessionState(
    client,
    roleConfig,
    "owner role activation",
  );

  await auditMigrationOwnership(client, roleConfig, "preflight");

  log(
    "Migration role and ownership preflight passed for session_user=" +
      loginRole +
      ", current_user=" +
      ownerRole +
      ", schemas=" +
      ownedSchemas.join(","),
  );
  return {
    sessionUser: loginRole,
    currentUser: ownerRole,
    ownedSchemas: [...ownedSchemas],
  };
}

export function versionSortMigrationFiles(files) {
  for (const filename of files) {
    if (!MIGRATION_FILENAME.test(filename)) {
      throw new Error("Unsafe migration filename: " + JSON.stringify(filename));
    }
  }
  if (files.length === 0) return [];

  const result = spawnSync("sort", ["-V"], {
    input: files.join("\n") + "\n",
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error("sort -V failed: " + String(result.stderr || "").trim());
  }
  return result.stdout.trimEnd().split("\n").filter(Boolean);
}

function summarizeFilenames(filenames, limit = 20) {
  const visible = filenames.slice(0, limit);
  const omittedCount = filenames.length - visible.length;
  return (
    visible.map((filename) => JSON.stringify(filename)).join(", ") +
    (omittedCount > 0 ? "; plus " + omittedCount + " more" : "")
  );
}

function requireSafeMigrationFilename(value, sourceLabel) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    !MIGRATION_FILENAME.test(value)
  ) {
    throw new Error(
      sourceLabel +
        " contains an unsafe migration filename: " +
        JSON.stringify(value),
    );
  }
  return value;
}

function assertUniqueMigrationFilenames(filenames, sourceLabel) {
  const seen = new Set();
  const duplicates = new Set();
  for (const filename of filenames) {
    if (seen.has(filename)) duplicates.add(filename);
    seen.add(filename);
  }
  if (duplicates.size > 0) {
    const sortedDuplicates = versionSortMigrationFiles([...duplicates]);
    throw new Error(
      sourceLabel +
        " contains duplicate migration filename(s): " +
        summarizeFilenames(sortedDuplicates),
    );
  }
}

export function validateLegacyLedgerManifest(
  manifest,
  sourceLabel = LEGACY_LEDGER_MANIFEST_FILENAME,
) {
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    Object.getPrototypeOf(manifest) !== Object.prototype
  ) {
    throw new Error(sourceLabel + " must contain one JSON object");
  }

  const actualKeys = Object.keys(manifest).sort();
  if (
    actualKeys.length !== LEGACY_LEDGER_MANIFEST_KEYS.length ||
    actualKeys.some((key, index) => key !== LEGACY_LEDGER_MANIFEST_KEYS[index])
  ) {
    throw new Error(
      sourceLabel +
        " must contain exactly these keys: " +
        LEGACY_LEDGER_MANIFEST_KEYS.join(", "),
    );
  }
  if (manifest.formatVersion !== LEGACY_LEDGER_MANIFEST_FORMAT_VERSION) {
    throw new Error(
      sourceLabel +
        " formatVersion must be " +
        LEGACY_LEDGER_MANIFEST_FORMAT_VERSION,
    );
  }
  if (manifest.baselineId !== LEGACY_LEDGER_BASELINE_ID) {
    throw new Error(
      sourceLabel +
        " baselineId must be " +
        JSON.stringify(LEGACY_LEDGER_BASELINE_ID),
    );
  }
  if (!Array.isArray(manifest.legacyAppliedFilenames)) {
    throw new Error(sourceLabel + " legacyAppliedFilenames must be an array");
  }

  const legacyAppliedFilenames = manifest.legacyAppliedFilenames.map(
    (filename) => requireSafeMigrationFilename(filename, sourceLabel),
  );
  assertUniqueMigrationFilenames(legacyAppliedFilenames, sourceLabel);
  const sortedFilenames = versionSortMigrationFiles(legacyAppliedFilenames);
  if (
    sortedFilenames.some(
      (filename, index) => filename !== legacyAppliedFilenames[index],
    )
  ) {
    throw new Error(
      sourceLabel + " legacyAppliedFilenames must use version-sort order",
    );
  }

  return Object.freeze({
    formatVersion: manifest.formatVersion,
    baselineId: manifest.baselineId,
    legacyAppliedFilenames: Object.freeze([...legacyAppliedFilenames]),
  });
}

async function loadLegacyLedgerManifest(migrationsDir) {
  const manifestPath = path.join(
    migrationsDir,
    LEGACY_LEDGER_MANIFEST_FILENAME,
  );
  let rawManifest;
  try {
    rawManifest = await readFile(manifestPath, "utf8");
  } catch (error) {
    throw new Error(
      "Could not read required legacy migration ledger manifest " +
        JSON.stringify(manifestPath) +
        ": " +
        safeErrorMessage(error),
      { cause: error },
    );
  }

  let parsedManifest;
  try {
    parsedManifest = JSON.parse(rawManifest);
  } catch (error) {
    throw new Error(
      "Legacy migration ledger manifest is not valid JSON: " +
        safeErrorMessage(error),
      { cause: error },
    );
  }
  const canonicalManifest = JSON.stringify(parsedManifest, null, 2) + "\n";
  if (rawManifest !== canonicalManifest) {
    throw new Error(
      LEGACY_LEDGER_MANIFEST_FILENAME +
        " must be canonical two-space JSON with one trailing newline",
    );
  }
  return validateLegacyLedgerManifest(
    parsedManifest,
    LEGACY_LEDGER_MANIFEST_FILENAME,
  );
}

async function listMigrationFiles(migrationsDir) {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return versionSortMigrationFiles(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name),
  );
}

async function loadMigrationInventory(migrationsDir) {
  const migrationFiles = await listMigrationFiles(migrationsDir);
  assertUniqueMigrationFilenames(migrationFiles, "Repository migrations");
  const manifest = await loadLegacyLedgerManifest(migrationsDir);
  const repositoryFilenames = new Set(migrationFiles);
  const versionedMigrationFiles = migrationFiles.filter((filename) =>
    /^\d/.test(filename),
  );
  const legacyRepositoryMigrationFiles = migrationFiles.filter(
    (filename) => !/^\d/.test(filename),
  );
  const expectedLegacyRepositoryFilenames = new Set(
    LEGACY_REPOSITORY_MIGRATION_FILENAMES,
  );
  const actualLegacyRepositoryFilenames = new Set(
    legacyRepositoryMigrationFiles,
  );
  const missingLegacyRepositoryFiles =
    LEGACY_REPOSITORY_MIGRATION_FILENAMES.filter(
      (filename) => !actualLegacyRepositoryFilenames.has(filename),
    );
  const unexpectedLegacyRepositoryFiles = legacyRepositoryMigrationFiles.filter(
    (filename) => !expectedLegacyRepositoryFilenames.has(filename),
  );
  if (
    missingLegacyRepositoryFiles.length > 0 ||
    unexpectedLegacyRepositoryFiles.length > 0
  ) {
    throw new Error(
      "Repository non-numeric migration baseline mismatch: missing expected " +
        "file(s): " +
        (missingLegacyRepositoryFiles.length > 0
          ? summarizeFilenames(missingLegacyRepositoryFiles)
          : "none") +
        "; unexpected file(s): " +
        (unexpectedLegacyRepositoryFiles.length > 0
          ? summarizeFilenames(unexpectedLegacyRepositoryFiles)
          : "none"),
    );
  }
  const collisions = manifest.legacyAppliedFilenames.filter((filename) =>
    repositoryFilenames.has(filename),
  );
  if (collisions.length > 0) {
    throw new Error(
      LEGACY_LEDGER_MANIFEST_FILENAME +
        " collides with repository SQL migration file(s): " +
        summarizeFilenames(collisions),
    );
  }

  return Object.freeze({
    migrationFiles: Object.freeze([...migrationFiles]),
    versionedMigrationFiles: Object.freeze([...versionedMigrationFiles]),
    legacyRepositoryMigrationFiles: Object.freeze([
      ...legacyRepositoryMigrationFiles,
    ]),
    repositoryFilenames,
    legacyAppliedFilenames: new Set(manifest.legacyAppliedFilenames),
  });
}
function trackerDefaultMatches(defaultKind, expression) {
  const normalized =
    expression === null || expression === undefined ? null : String(expression);
  if (defaultKind === "none") return normalized === null;
  if (defaultKind === "now") return normalized === "now()";
  if (defaultKind === "serial") {
    return normalized !== null && /^nextval\(.+::regclass\)$/.test(normalized);
  }
  return false;
}

async function auditMigrationTracker(client, ownerRole) {
  const relationResult = await client.query(MIGRATION_TRACKER_RELATION_SQL);
  if (relationResult.rows?.length === 0) {
    throw new Error(
      "Required production migration tracker public._migrations_applied does not exist",
    );
  }
  if (relationResult.rows?.length !== 1) {
    throw new Error(
      "Migration tracker relation audit returned an unexpected row count",
    );
  }

  const relation = relationResult.rows[0];
  const relationOid = Number(relation.relation_oid);
  if (!Number.isInteger(relationOid) || relationOid <= 0) {
    throw new Error("Migration tracker relation audit returned an invalid OID");
  }
  if (String(relation.relkind || "") !== "r") {
    throw new Error(
      "public._migrations_applied must be an ordinary PostgreSQL table (relkind r)",
    );
  }
  if (String(relation.owner_name || "") !== ownerRole) {
    throw new Error(
      "public._migrations_applied owner mismatch: expected " +
        JSON.stringify(ownerRole) +
        ", received " +
        JSON.stringify(String(relation.owner_name || "")),
    );
  }

  const columnsResult = await client.query(MIGRATION_TRACKER_COLUMNS_SQL, [
    relationOid,
  ]);
  const columns = Array.isArray(columnsResult.rows) ? columnsResult.rows : [];
  if (columns.length !== MIGRATION_TRACKER_EXPECTED_COLUMNS.length) {
    throw new Error(
      "public._migrations_applied column shape mismatch: expected exactly " +
        MIGRATION_TRACKER_EXPECTED_COLUMNS.length +
        " columns, received " +
        columns.length,
    );
  }
  for (
    let index = 0;
    index < MIGRATION_TRACKER_EXPECTED_COLUMNS.length;
    index += 1
  ) {
    const expected = MIGRATION_TRACKER_EXPECTED_COLUMNS[index];
    const actual = columns[index];
    const matches =
      Number(actual.ordinal) === expected.ordinal &&
      String(actual.column_name || "") === expected.columnName &&
      String(actual.data_type || "") === expected.dataType &&
      actual.not_null === expected.notNull &&
      trackerDefaultMatches(expected.defaultKind, actual.default_expression);
    if (!matches) {
      throw new Error(
        "public._migrations_applied column shape mismatch at ordinal " +
          expected.ordinal +
          ": expected " +
          JSON.stringify({
            name: expected.columnName,
            dataType: expected.dataType,
            notNull: expected.notNull,
            defaultKind: expected.defaultKind,
          }) +
          ", received " +
          JSON.stringify({
            name: String(actual?.column_name || ""),
            dataType: String(actual?.data_type || ""),
            notNull: actual?.not_null,
            defaultExpression: actual?.default_expression ?? null,
          }),
      );
    }
  }

  const indexesResult = await client.query(MIGRATION_TRACKER_INDEXES_SQL, [
    relationOid,
  ]);
  if (indexesResult.rows?.length !== 1) {
    throw new Error(
      "Migration tracker index audit returned an unexpected row count",
    );
  }
  if (indexesResult.rows[0].has_primary_id !== true) {
    throw new Error(
      "public._migrations_applied must have a valid single-column primary key on id",
    );
  }
  if (indexesResult.rows[0].has_unique_filename !== true) {
    throw new Error(
      "public._migrations_applied must have a valid single-column unique index on filename",
    );
  }

  return Object.freeze({ relationOid });
}

function validateAppliedLedgerRows(rows, inventory) {
  if (!Array.isArray(rows)) {
    throw new Error("Migration ledger query did not return a row array");
  }
  const appliedFilenames = rows.map((row) =>
    requireSafeMigrationFilename(
      row && typeof row === "object" ? row.filename : undefined,
      "public._migrations_applied",
    ),
  );
  assertUniqueMigrationFilenames(
    appliedFilenames,
    "public._migrations_applied",
  );

  const unknownLedgerOnlyFilenames = appliedFilenames.filter(
    (filename) =>
      !inventory.repositoryFilenames.has(filename) &&
      !inventory.legacyAppliedFilenames.has(filename),
  );
  if (unknownLedgerOnlyFilenames.length > 0) {
    throw new Error(
      "public._migrations_applied contains unrecognized ledger-only " +
        "filename(s): " +
        summarizeFilenames(
          versionSortMigrationFiles(unknownLedgerOnlyFilenames),
        ) +
        ". Every applied filename must be a repository SQL migration or an " +
        "explicit legacy manifest entry.",
    );
  }
  const applied = new Set(appliedFilenames);
  const missingLegacyFilenames = [...inventory.legacyAppliedFilenames].filter(
    (filename) => !applied.has(filename),
  );
  if (missingLegacyFilenames.length > 0) {
    throw new Error(
      "public._migrations_applied is missing required production legacy " +
        "tombstone(s): " +
        summarizeFilenames(versionSortMigrationFiles(missingLegacyFilenames)),
    );
  }
  const missingLegacyRepositoryFilenames =
    inventory.legacyRepositoryMigrationFiles.filter(
      (filename) => !applied.has(filename),
    );
  if (missingLegacyRepositoryFilenames.length > 0) {
    throw new Error(
      "public._migrations_applied is missing immutable non-numeric " +
        "repository migration baseline file(s): " +
        summarizeFilenames(missingLegacyRepositoryFilenames),
    );
  }

  const firstMissingIndex = inventory.versionedMigrationFiles.findIndex(
    (filename) => !applied.has(filename),
  );
  if (firstMissingIndex >= 0) {
    const laterAppliedFilenames = inventory.versionedMigrationFiles
      .slice(firstMissingIndex + 1)
      .filter((filename) => applied.has(filename));
    if (laterAppliedFilenames.length > 0) {
      throw new Error(
        "public._migrations_applied repository history is not a contiguous " +
          "prefix: missing " +
          JSON.stringify(inventory.versionedMigrationFiles[firstMissingIndex]) +
          " while later migration(s) are marked applied: " +
          summarizeFilenames(laterAppliedFilenames),
      );
    }
  }
  return Object.freeze([...appliedFilenames]);
}

async function inspectMigrationLedger(client, migrationsDir, ownerRole) {
  if (!ROLE_IDENTIFIER.test(String(ownerRole || ""))) {
    throw new Error(
      "A safe canonical migration tracker owner role is required",
    );
  }
  const inventory = await loadMigrationInventory(migrationsDir);
  const tracker = await auditMigrationTracker(client, ownerRole);
  const appliedFilenames = validateAppliedLedgerRows(
    (await client.query(MIGRATION_LEDGER_FILENAMES_SQL)).rows,
    inventory,
  );

  return Object.freeze({
    inventory,
    tracker,
    trackerExists: true,
    appliedFilenames,
    applied: new Set(appliedFilenames),
  });
}
async function preloadPendingMigrations(migrationsDir, migrationState) {
  const pendingFilenames = migrationState.inventory.migrationFiles.filter(
    (filename) => !migrationState.applied.has(filename),
  );
  const preloadedMigrations = [];
  for (const filename of pendingFilenames) {
    const migrationPath = path.join(migrationsDir, filename);
    let sql;
    try {
      sql = await readFile(migrationPath, "utf8");
    } catch (error) {
      throw new Error(
        "Could not preload migration " +
          JSON.stringify(filename) +
          ": " +
          safeErrorMessage(error),
        { cause: error },
      );
    }
    if (sql.includes("\0")) {
      throw new Error(
        "Migration " + filename + " contains an unsupported NUL byte",
      );
    }
    if (/^\s*\\/m.test(sql)) {
      throw new Error(
        "Migration " + filename + " contains unsupported psql meta-commands",
      );
    }
    preloadedMigrations.push(Object.freeze({ filename, sql }));
  }
  return Object.freeze(preloadedMigrations);
}

function assertExactLedgerTransition(
  initialAppliedFilenames,
  appliedNowFilenames,
  finalAppliedFilenames,
) {
  const expected = new Set([
    ...initialAppliedFilenames,
    ...appliedNowFilenames,
  ]);
  const actual = new Set(finalAppliedFilenames);
  const missing = [...expected].filter((filename) => !actual.has(filename));
  const unexpected = [...actual].filter((filename) => !expected.has(filename));
  if (
    expected.size !== actual.size ||
    missing.length > 0 ||
    unexpected.length > 0
  ) {
    throw new Error(
      "Post-migration ledger transition mismatch: missing expected filename(s): " +
        (missing.length > 0
          ? summarizeFilenames(versionSortMigrationFiles(missing))
          : "none") +
        "; unexpected filename(s): " +
        (unexpected.length > 0
          ? summarizeFilenames(versionSortMigrationFiles(unexpected))
          : "none"),
    );
  }
}

async function assertZeroPendingMigrations(
  client,
  {
    migrationsDir = DEFAULT_MIGRATIONS_DIR,
    log = console.log,
    migrationState,
    roleConfig,
  } = {},
) {
  const state =
    migrationState ||
    (await inspectMigrationLedger(
      client,
      migrationsDir,
      roleConfig?.ownerRole,
    ));

  const { applied } = state;
  const migrationFiles = state.inventory.migrationFiles;
  const pendingFiles = migrationFiles.filter(
    (filename) => !applied.has(filename),
  );
  if (pendingFiles.length > 0) {
    const visibleFiles = pendingFiles.slice(0, 20);
    const omittedCount = pendingFiles.length - visibleFiles.length;
    throw new Error(
      "Expected zero pending migrations, but found " +
        pendingFiles.length +
        ": " +
        visibleFiles.join(", ") +
        (omittedCount > 0 ? "; plus " + omittedCount + " more" : ""),
    );
  }

  log("Zero-pending migration invariant passed.");
  return {
    totalCount: migrationFiles.length,
    appliedCount: 0,
    skippedCount: migrationFiles.length,
    expectZero: true,
  };
}

export async function applyPendingMigrations(
  client,
  {
    migrationsDir = DEFAULT_MIGRATIONS_DIR,
    log = console.log,
    migrationState,
    roleConfig,
  } = {},
) {
  if (!roleConfig) {
    throw new Error("Migration role configuration is required");
  }
  const state =
    migrationState ||
    (await inspectMigrationLedger(client, migrationsDir, roleConfig.ownerRole));
  const preloadedMigrations = await preloadPendingMigrations(
    migrationsDir,
    state,
  );

  for (const filename of state.inventory.migrationFiles) {
    if (state.applied.has(filename)) log("SKIP " + filename);
  }

  const appliedNowFilenames = [];
  for (const { filename, sql } of preloadedMigrations) {
    log("APPLY " + filename);
    try {
      await client.query(sql);
      await assertMigrationSessionState(
        client,
        roleConfig,
        "after migration " + filename,
      );
      const insertResult = await client.query(
        "INSERT INTO public._migrations_applied (filename) VALUES ($1)",
        [filename],
      );
      if (insertResult.rowCount !== 1) {
        throw new Error(
          "ledger INSERT did not insert exactly one row for " +
            JSON.stringify(filename) +
            "; rowCount=" +
            JSON.stringify(insertResult.rowCount),
        );
      }
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // A dropped connection releases the session advisory lock itself.
      }
      throw new Error(
        "Migration " + filename + " failed: " + safeErrorMessage(error),
        { cause: error },
      );
    }
    appliedNowFilenames.push(filename);
    log("APPLIED " + filename);
  }

  const finalState = await inspectMigrationLedger(
    client,
    migrationsDir,
    roleConfig.ownerRole,
  );
  assertExactLedgerTransition(
    state.appliedFilenames,
    appliedNowFilenames,
    finalState.appliedFilenames,
  );
  log("Post-migration ledger integrity audit passed.");

  return {
    totalCount: state.inventory.migrationFiles.length,
    appliedCount: appliedNowFilenames.length,
    skippedCount:
      state.inventory.migrationFiles.length - appliedNowFilenames.length,
  };
}

export async function runWithAdvisoryLock(
  client,
  {
    migrationsDir = DEFAULT_MIGRATIONS_DIR,
    log = console.log,
    roleConfig,
    preflightOnly = false,
    expectZero = false,
  } = {},
) {
  if (preflightOnly && expectZero) {
    throw new Error("--preflight-only and --expect-zero cannot be combined");
  }

  await client.query("SET lock_timeout = '30s'");
  await client.query("SET statement_timeout = '10min'");
  await client.query("SET idle_in_transaction_session_timeout = '2min'");

  const lockResult = await client.query(
    "SELECT pg_catalog.pg_try_advisory_lock(" +
      "pg_catalog.hashtext($1::text), " +
      "pg_catalog.hashtext($2::text)" +
      ") AS acquired",
    [LOCK_NAMESPACE, LOCK_NAME],
  );
  if (lockResult.rows[0]?.acquired !== true) {
    throw new Error(
      "Another production migration session already holds the database lock",
    );
  }

  log("Acquired PostgreSQL advisory migration lock.");
  try {
    const effectiveRoleConfig = roleConfig || requireMigrationRoleConfig();
    await runMigrationPreflight(client, {
      roleConfig: effectiveRoleConfig,
      log,
    });
    const migrationState = await inspectMigrationLedger(
      client,
      migrationsDir,
      effectiveRoleConfig.ownerRole,
    );
    log("Migration ledger integrity preflight passed.");
    if (preflightOnly) {
      return {
        totalCount: 0,
        appliedCount: 0,
        skippedCount: 0,
        preflightOnly: true,
      };
    }
    if (expectZero) {
      return await assertZeroPendingMigrations(client, {
        migrationsDir,
        log,
        migrationState,
        roleConfig: effectiveRoleConfig,
      });
    }

    const result = await applyPendingMigrations(client, {
      migrationsDir,
      log,
      migrationState,
      roleConfig: effectiveRoleConfig,
    });
    await assertMigrationSessionState(
      client,
      effectiveRoleConfig,
      "post-migration audit",
    );
    await auditMigrationOwnership(
      client,
      effectiveRoleConfig,
      "post-migration",
    );
    log("Post-migration role and ownership audit passed.");
    return result;
  } finally {
    try {
      await client.query("RESET ROLE");
    } catch (error) {
      log(
        "WARNING: Failed to reset migration role: " + safeErrorMessage(error),
      );
    }
    try {
      await client.query(
        "SELECT pg_catalog.pg_advisory_unlock(" +
          "pg_catalog.hashtext($1::text), " +
          "pg_catalog.hashtext($2::text)" +
          ") AS released",
        [LOCK_NAMESPACE, LOCK_NAME],
      );
      log("Released PostgreSQL advisory migration lock.");
    } catch {
      // Closing the client below also releases every session-level lock.
    }
  }
}
async function writeSelfTestLegacyRepositoryFiles(directory) {
  for (const filename of LEGACY_REPOSITORY_MIGRATION_FILENAMES) {
    await writeFile(
      path.join(directory, filename),
      "-- immutable legacy repository migration self-test fixture\n",
    );
  }
}

async function writeSelfTestMigrationBaseline(directory, manifestText) {
  await writeFile(
    path.join(directory, LEGACY_LEDGER_MANIFEST_FILENAME),
    manifestText,
  );
  await writeSelfTestLegacyRepositoryFiles(directory);
}

async function runPreflightSelfTest(testDir, manifestText) {
  const roleEnvironment = {
    MIGRATION_LOGIN_ROLE: "creatorhub_migration_login",
    MIGRATION_OWNER_ROLE: "creatorhub_schema_owner",
    MIGRATION_OWNED_SCHEMAS: "public",
  };
  const roleConfig = requireMigrationRoleConfig(roleEnvironment);
  assert.deepEqual(roleConfig, {
    loginRole: "creatorhub_migration_login",
    ownerRole: "creatorhub_schema_owner",
    ownedSchemas: ["public"],
  });

  const invalidConfigurations = [
    [{}, /MIGRATION_LOGIN_ROLE is required/],
    [
      { ...roleEnvironment, MIGRATION_LOGIN_ROLE: "creatorhub_migrator" },
      /MIGRATION_LOGIN_ROLE must be exactly creatorhub_migration_login/,
    ],
    [
      {
        ...roleEnvironment,
        MIGRATION_OWNER_ROLE: "creatorhub_migration_login",
      },
      /MIGRATION_OWNER_ROLE must be exactly creatorhub_schema_owner/,
    ],
    [
      { ...roleEnvironment, MIGRATION_OWNER_ROLE: 'owner";drop_role' },
      /unquoted lowercase PostgreSQL identifier/,
    ],
    [
      { ...roleEnvironment, MIGRATION_OWNED_SCHEMAS: "public,public" },
      /must not contain duplicates/,
    ],
    [
      { ...roleEnvironment, MIGRATION_OWNED_SCHEMAS: "public," },
      /entry is required/,
    ],
    [
      { ...roleEnvironment, MIGRATION_OWNED_SCHEMAS: "private_app" },
      /must include public/,
    ],
  ];
  for (const [environment, expectedError] of invalidConfigurations) {
    assert.throws(() => requireMigrationRoleConfig(environment), expectedError);
  }

  assert.match(ROLE_MEMBERSHIP_SQL, /pg_catalog\.pg_auth_members/);
  assert.match(ROLE_MEMBERSHIP_SQL, /membership\.admin_option = FALSE/);
  assert.match(ROLE_MEMBERSHIP_SQL, /membership\.inherit_option = FALSE/);
  assert.match(ROLE_MEMBERSHIP_SQL, /membership\.set_option = TRUE/);
  for (const catalog of ["pg_class", "pg_proc", "pg_type"]) {
    assert.match(
      OWNERSHIP_AUDIT_SQL,
      new RegExp("FROM pg_catalog\\." + catalog),
    );
  }
  assert.match(OWNERSHIP_AUDIT_SQL, /type_relation\.relkind = 'c'/);
  assert.equal(
    (
      OWNERSHIP_AUDIT_SQL.match(
        /refclassid = 'pg_catalog\.pg_extension'::regclass/g,
      ) || []
    ).length,
    3,
  );

  const gatedDir = path.join(testDir, "gated");
  await mkdir(gatedDir);
  await writeSelfTestMigrationBaseline(gatedDir, manifestText);
  await writeFile(
    path.join(gatedDir, "001_preflight_sentinel.sql"),
    "SELECT preflight_sentinel;",
  );
  const legacyBaselineFilenames = Object.freeze([
    ...JSON.parse(manifestText).legacyAppliedFilenames,
  ]);

  function makeRole(name, canLogin, attributes = {}) {
    return {
      rolname: name,
      rolcanlogin: canLogin,
      rolinherit: false,
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolbypassrls: false,
      ...attributes,
    };
  }

  function createPreflightClient(overrides = {}) {
    const calls = [];
    let ownerRoleActive = false;
    let migrationExecuted = false;
    let currentSearchPath = "";
    let ownershipAuditCount = 0;
    const appliedFilenames = [
      ...(overrides.rawAppliedFilenames ?? [
        ...legacyBaselineFilenames,
        ...LEGACY_REPOSITORY_MIGRATION_FILENAMES,
        ...(overrides.appliedFilenames ?? []),
      ]),
    ];
    const defaultRoleRows = [
      makeRole(roleConfig.loginRole, true),
      makeRole(roleConfig.ownerRole, false),
    ];
    const defaultTrackerColumns = [
      {
        ordinal: 1,
        column_name: "id",
        data_type: "integer",
        not_null: true,
        default_expression: "nextval('_migrations_applied_id_seq'::regclass)",
      },
      {
        ordinal: 2,
        column_name: "filename",
        data_type: "character varying(255)",
        not_null: true,
        default_expression: null,
      },
      {
        ordinal: 3,
        column_name: "applied_at",
        data_type: "timestamp without time zone",
        not_null: false,
        default_expression: "now()",
      },
      {
        ordinal: 4,
        column_name: "checksum_sha256",
        data_type: "character varying(64)",
        not_null: false,
        default_expression: null,
      },
    ];
    return {
      calls,
      client: {
        async query(text, values) {
          const sql = String(text);
          calls.push({ text: sql, values });
          if (
            sql === "SET lock_timeout = '30s'" ||
            sql === "SET statement_timeout = '10min'" ||
            sql === "SET idle_in_transaction_session_timeout = '2min'"
          ) {
            return { rows: [] };
          }
          if (sql.includes("pg_try_advisory_lock")) {
            return { rows: [{ acquired: overrides.lockAcquired ?? true }] };
          }
          if (sql === SESSION_IDENTITY_SQL) {
            return {
              rows: [
                ownerRoleActive
                  ? {
                      session_user:
                        (migrationExecuted
                          ? overrides.sessionUserAfterMigration
                          : undefined) ??
                        overrides.activatedSessionUser ??
                        roleConfig.loginRole,
                      current_user:
                        (migrationExecuted
                          ? overrides.currentUserAfterMigration
                          : undefined) ??
                        overrides.activatedCurrentUser ??
                        roleConfig.ownerRole,
                    }
                  : {
                      session_user:
                        overrides.initialSessionUser ?? roleConfig.loginRole,
                      current_user:
                        overrides.initialCurrentUser ?? roleConfig.loginRole,
                    },
              ],
            };
          }
          if (sql === ROLE_ATTRIBUTES_SQL) {
            return { rows: overrides.roleRows ?? defaultRoleRows };
          }
          if (sql === ROLE_MEMBERSHIP_SQL) {
            return {
              rows: [
                {
                  login_membership_count: overrides.loginMembershipCount ?? 1,
                  exact_owner_membership_count:
                    overrides.exactOwnerMembershipCount ?? 1,
                  owner_membership_count: overrides.ownerMembershipCount ?? 0,
                  owner_direct_member_count:
                    overrides.ownerDirectMemberCount ?? 3,
                  owner_admin_member_count:
                    overrides.ownerAdminMemberCount ?? 1,
                  owner_migration_member_count:
                    overrides.ownerMigrationMemberCount ?? 1,
                  owner_runtime_member_count:
                    overrides.ownerRuntimeMemberCount ?? 1,
                },
              ],
            };
          }
          if (sql === 'SET ROLE "creatorhub_schema_owner"') {
            ownerRoleActive = true;
            return { rows: [] };
          }
          if (sql === "SET search_path TO public, pg_temp") {
            currentSearchPath = MIGRATION_SEARCH_PATH;
            return { rows: [] };
          }
          if (sql === MIGRATION_SEARCH_PATH_SQL) {
            return { rows: [{ search_path: currentSearchPath }] };
          }
          if (sql === SCHEMA_PRIVILEGES_SQL) {
            return {
              rows: overrides.schemaRows ?? [
                {
                  schema_name: "public",
                  schema_exists: true,
                  has_usage: true,
                  has_create: true,
                },
              ],
            };
          }
          if (sql === OWNERSHIP_AUDIT_SQL) {
            if (Array.isArray(overrides.ownershipResults)) {
              const rows =
                overrides.ownershipResults[ownershipAuditCount] ?? [];
              ownershipAuditCount += 1;
              return { rows };
            }
            return { rows: overrides.ownershipRows ?? [] };
          }
          if (sql === MIGRATION_TRACKER_RELATION_SQL) {
            return {
              rows:
                overrides.trackerExists === false
                  ? []
                  : [
                      {
                        relation_oid: 4242,
                        relkind: overrides.trackerRelkind ?? "r",
                        owner_name:
                          overrides.trackerOwner ?? roleConfig.ownerRole,
                      },
                    ],
            };
          }
          if (sql === MIGRATION_TRACKER_COLUMNS_SQL) {
            return {
              rows: overrides.trackerColumns ?? defaultTrackerColumns,
            };
          }
          if (sql === MIGRATION_TRACKER_INDEXES_SQL) {
            return {
              rows: [
                {
                  has_primary_id: overrides.hasPrimaryId ?? true,
                  has_unique_filename: overrides.hasUniqueFilename ?? true,
                },
              ],
            };
          }
          if (sql === MIGRATION_LEDGER_FILENAMES_SQL) {
            return {
              rows: appliedFilenames.map((filename) => ({ filename })),
            };
          }
          if (sql === "SELECT preflight_sentinel;") {
            migrationExecuted = true;
            if (overrides.searchPathAfterMigration !== undefined) {
              currentSearchPath = overrides.searchPathAfterMigration;
            }
            if (overrides.ledgerFilenameAfterMigration) {
              appliedFilenames.push(overrides.ledgerFilenameAfterMigration);
            }
            if (overrides.deleteLedgerFilenameAfterMigration) {
              const index = appliedFilenames.indexOf(
                overrides.deleteLedgerFilenameAfterMigration,
              );
              if (index >= 0) appliedFilenames.splice(index, 1);
            }
            return { rows: [] };
          }
          if (sql.startsWith("INSERT INTO public._migrations_applied")) {
            const filename = String(values?.[0]);
            const alreadyExists = appliedFilenames.includes(filename);
            const rowCount =
              overrides.insertRowCount ?? (alreadyExists ? 0 : 1);
            if (rowCount === 1 && !alreadyExists) {
              appliedFilenames.push(filename);
            }
            return { rows: [], rowCount };
          }
          if (sql === "RESET ROLE") {
            ownerRoleActive = false;
            return { rows: [] };
          }
          if (sql.includes("pg_advisory_unlock")) {
            return { rows: [{ released: true }] };
          }
          throw new Error("Unexpected self-test query: " + sql);
        },
      },
    };
  }

  function assertNoMigrationMutation(calls) {
    const sqlCalls = calls.map((call) => call.text);
    assert.equal(
      sqlCalls.some(
        (sql) =>
          sql.startsWith(
            "CREATE TABLE IF NOT EXISTS public._migrations_applied",
          ) ||
          sql === "SELECT preflight_sentinel;" ||
          sql.startsWith("INSERT INTO public._migrations_applied"),
      ),
      false,
      "preflight failure must precede every tracker or migration statement",
    );
  }

  function assertCleanupOrder(calls) {
    const sqlCalls = calls.map((call) => call.text);
    const resetIndex = sqlCalls.indexOf("RESET ROLE");
    const unlockIndex = sqlCalls.findIndex((sql) =>
      sql.includes("pg_advisory_unlock"),
    );
    assert.ok(resetIndex >= 0, "runner must RESET ROLE in finally");
    assert.ok(unlockIndex > resetIndex, "runner must unlock after RESET ROLE");
  }

  async function expectPreflightFailure(overrides, expectedError) {
    const fixture = createPreflightClient(overrides);
    await assert.rejects(
      runWithAdvisoryLock(fixture.client, {
        migrationsDir: gatedDir,
        log: () => undefined,
        roleConfig,
      }),
      expectedError,
    );
    assertNoMigrationMutation(fixture.calls);
    assertCleanupOrder(fixture.calls);
  }

  const passingFixture = createPreflightClient();
  const passingResult = await runWithAdvisoryLock(passingFixture.client, {
    migrationsDir: gatedDir,
    log: () => undefined,
    roleConfig,
  });
  assert.deepEqual(passingResult, {
    totalCount: 9,
    appliedCount: 1,
    skippedCount: 8,
  });
  const passingSql = passingFixture.calls.map((call) => call.text);
  const setRoleIndex = passingSql.indexOf('SET ROLE "creatorhub_schema_owner"');
  const searchPathIndex = passingSql.indexOf(
    "SET search_path TO public, pg_temp",
  );
  const ownershipIndex = passingSql.indexOf(OWNERSHIP_AUDIT_SQL);
  const trackerIndex = passingSql.indexOf(MIGRATION_TRACKER_RELATION_SQL);
  const trackerColumnsIndex = passingSql.indexOf(MIGRATION_TRACKER_COLUMNS_SQL);
  const trackerIndexesIndex = passingSql.indexOf(MIGRATION_TRACKER_INDEXES_SQL);
  const ledgerIndex = passingSql.indexOf(MIGRATION_LEDGER_FILENAMES_SQL);
  assert.ok(setRoleIndex >= 0);
  assert.ok(searchPathIndex > setRoleIndex);
  assert.ok(ownershipIndex > searchPathIndex);
  assert.ok(trackerIndex > ownershipIndex);
  assert.ok(trackerColumnsIndex > trackerIndex);
  assert.ok(trackerIndexesIndex > trackerColumnsIndex);
  assert.ok(ledgerIndex > trackerIndexesIndex);
  assert.ok(passingSql.indexOf("SELECT preflight_sentinel;") > ledgerIndex);
  assert.equal(
    passingSql.some((sql) => sql.startsWith("CREATE TABLE")),
    false,
    "production runner must never create an implicit tracker",
  );
  assertCleanupOrder(passingFixture.calls);

  const postAuditFixture = createPreflightClient({
    ownershipResults: [
      [],
      [
        {
          object_kind: "relation",
          schema_name: "public",
          object_name: "new_wrong_owner_table",
          owner_name: "neondb_owner",
          mismatch_count: 1,
        },
      ],
    ],
  });
  await assert.rejects(
    runWithAdvisoryLock(postAuditFixture.client, {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
    }),
    /post-migration ownership audit found 1 object/,
  );
  assert.equal(
    postAuditFixture.calls.some(
      (call) => call.text === "SELECT preflight_sentinel;",
    ),
    true,
  );
  assertCleanupOrder(postAuditFixture.calls);

  const preflightOnlyFixture = createPreflightClient();
  const preflightOnlyResult = await runWithAdvisoryLock(
    preflightOnlyFixture.client,
    {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
      preflightOnly: true,
    },
  );
  assert.equal(preflightOnlyResult.preflightOnly, true);
  assertNoMigrationMutation(preflightOnlyFixture.calls);
  assertCleanupOrder(preflightOnlyFixture.calls);

  const conflictingOptionsFixture = createPreflightClient();
  await assert.rejects(
    runWithAdvisoryLock(conflictingOptionsFixture.client, {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
      preflightOnly: true,
      expectZero: true,
    }),
    /cannot be combined/,
  );
  assert.equal(conflictingOptionsFixture.calls.length, 0);

  const expectZeroFixture = createPreflightClient({
    appliedFilenames: ["001_preflight_sentinel.sql"],
  });
  const expectZeroResult = await runWithAdvisoryLock(expectZeroFixture.client, {
    migrationsDir: gatedDir,
    log: () => undefined,
    roleConfig,
    expectZero: true,
  });
  assert.deepEqual(expectZeroResult, {
    totalCount: 9,
    appliedCount: 0,
    skippedCount: 9,
    expectZero: true,
  });
  assertNoMigrationMutation(expectZeroFixture.calls);
  assertCleanupOrder(expectZeroFixture.calls);

  const pendingFixture = createPreflightClient();
  await assert.rejects(
    runWithAdvisoryLock(pendingFixture.client, {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
      expectZero: true,
    }),
    /Expected zero pending migrations, but found 1: 001_preflight_sentinel\.sql/,
  );
  assertNoMigrationMutation(pendingFixture.calls);
  assertCleanupOrder(pendingFixture.calls);

  for (const mode of [{ preflightOnly: true }, { expectZero: true }, {}]) {
    const missingTrackerFixture = createPreflightClient({
      trackerExists: false,
    });
    await assert.rejects(
      runWithAdvisoryLock(missingTrackerFixture.client, {
        migrationsDir: gatedDir,
        log: () => undefined,
        roleConfig,
        ...mode,
      }),
      /public\._migrations_applied does not exist/,
    );
    assertNoMigrationMutation(missingTrackerFixture.calls);
    assertCleanupOrder(missingTrackerFixture.calls);
  }

  const legacyTombstoneFixture = createPreflightClient();
  const legacyTombstoneResult = await runWithAdvisoryLock(
    legacyTombstoneFixture.client,
    {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
      preflightOnly: true,
    },
  );
  assert.equal(legacyTombstoneResult.preflightOnly, true);
  assertNoMigrationMutation(legacyTombstoneFixture.calls);
  assertCleanupOrder(legacyTombstoneFixture.calls);
  const missingLegacyFixture = createPreflightClient({
    rawAppliedFilenames: legacyBaselineFilenames.slice(1),
  });
  await assert.rejects(
    runWithAdvisoryLock(missingLegacyFixture.client, {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
      preflightOnly: true,
    }),
    /missing required production legacy tombstone/,
  );
  assertNoMigrationMutation(missingLegacyFixture.calls);
  assertCleanupOrder(missingLegacyFixture.calls);
  const missingLegacyRepositoryFixture = createPreflightClient({
    rawAppliedFilenames: [
      ...legacyBaselineFilenames,
      ...LEGACY_REPOSITORY_MIGRATION_FILENAMES.slice(1),
    ],
  });
  await assert.rejects(
    runWithAdvisoryLock(missingLegacyRepositoryFixture.client, {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
      preflightOnly: true,
    }),
    /missing immutable non-numeric repository migration baseline/,
  );
  assertNoMigrationMutation(missingLegacyRepositoryFixture.calls);
  assertCleanupOrder(missingLegacyRepositoryFixture.calls);

  const prefixDir = path.join(testDir, "non-contiguous-prefix");
  await mkdir(prefixDir);
  await writeSelfTestMigrationBaseline(prefixDir, manifestText);
  await writeFile(path.join(prefixDir, "001_prefix.sql"), "SELECT 1;");
  await writeFile(path.join(prefixDir, "002_later.sql"), "SELECT 2;");
  const prefixGapFixture = createPreflightClient({
    appliedFilenames: ["002_later.sql"],
  });
  await assert.rejects(
    runWithAdvisoryLock(prefixGapFixture.client, {
      migrationsDir: prefixDir,
      log: () => undefined,
      roleConfig,
      preflightOnly: true,
    }),
    /repository history is not a contiguous prefix.*001_prefix\.sql.*002_later\.sql/,
  );
  assertNoMigrationMutation(prefixGapFixture.calls);
  assertCleanupOrder(prefixGapFixture.calls);

  for (const mode of [{ preflightOnly: true }, { expectZero: true }, {}]) {
    const unknownLedgerFixture = createPreflightClient({
      appliedFilenames: ["0999_unreviewed_side_branch.sql"],
    });
    await assert.rejects(
      runWithAdvisoryLock(unknownLedgerFixture.client, {
        migrationsDir: gatedDir,
        log: () => undefined,
        roleConfig,
        ...mode,
      }),
      /unrecognized ledger-only filename.*0999_unreviewed_side_branch\.sql/,
    );
    assertNoMigrationMutation(unknownLedgerFixture.calls);
    assertCleanupOrder(unknownLedgerFixture.calls);
  }
  for (const [overrides, expectedError] of [
    [{ trackerRelkind: "v" }, /must be an ordinary PostgreSQL table/],
    [{ trackerOwner: "neondb_owner" }, /owner mismatch/],
    [{ trackerColumns: [] }, /column shape mismatch/],
    [{ hasPrimaryId: false }, /primary key on id/],
    [{ hasUniqueFilename: false }, /unique index on filename/],
  ]) {
    const trackerShapeFixture = createPreflightClient(overrides);
    await assert.rejects(
      runWithAdvisoryLock(trackerShapeFixture.client, {
        migrationsDir: gatedDir,
        log: () => undefined,
        roleConfig,
        preflightOnly: true,
      }),
      expectedError,
    );
    assert.equal(
      trackerShapeFixture.calls.some(
        (call) => call.text === MIGRATION_LEDGER_FILENAMES_SQL,
      ),
      false,
      "tracker shape and owner must be trusted before ledger rows are read",
    );
    assertNoMigrationMutation(trackerShapeFixture.calls);
    assertCleanupOrder(trackerShapeFixture.calls);
  }

  for (const [appliedFilenames, expectedError] of [
    [
      ["001_preflight_sentinel.sql", "001_preflight_sentinel.sql"],
      /duplicate migration filename/,
    ],
    [["../escape.sql"], /unsafe migration filename/],
    [["unsafe..migration.sql"], /unsafe migration filename/],
  ]) {
    const invalidLedgerFixture = createPreflightClient({ appliedFilenames });
    await assert.rejects(
      runWithAdvisoryLock(invalidLedgerFixture.client, {
        migrationsDir: gatedDir,
        log: () => undefined,
        roleConfig,
        preflightOnly: true,
      }),
      expectedError,
    );
    assertNoMigrationMutation(invalidLedgerFixture.calls);
    assertCleanupOrder(invalidLedgerFixture.calls);
  }

  const postMigrationLedgerDriftFixture = createPreflightClient({
    ledgerFilenameAfterMigration: "0999_injected_during_migration.sql",
  });
  await assert.rejects(
    runWithAdvisoryLock(postMigrationLedgerDriftFixture.client, {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
    }),
    /unrecognized ledger-only filename.*0999_injected_during_migration\.sql/,
  );
  assert.equal(
    postMigrationLedgerDriftFixture.calls.some(
      (call) => call.text === "SELECT preflight_sentinel;",
    ),
    true,
    "post-migration ledger audit must detect drift introduced by migration SQL",
  );
  assertCleanupOrder(postMigrationLedgerDriftFixture.calls);
  for (const [overrides, expectedError] of [
    [
      { currentUserAfterMigration: roleConfig.loginRole },
      /role mismatch during after migration 001_preflight_sentinel\.sql/,
    ],
    [
      { searchPathAfterMigration: "public, pg_catalog" },
      /search_path drift during after migration 001_preflight_sentinel\.sql/,
    ],
  ]) {
    const sessionDriftFixture = createPreflightClient(overrides);
    await assert.rejects(
      runWithAdvisoryLock(sessionDriftFixture.client, {
        migrationsDir: gatedDir,
        log: () => undefined,
        roleConfig,
      }),
      expectedError,
    );
    assert.equal(
      sessionDriftFixture.calls.some((call) =>
        call.text.startsWith("INSERT INTO public._migrations_applied"),
      ),
      false,
      "role/search_path drift must fail before the ledger INSERT",
    );
    assertCleanupOrder(sessionDriftFixture.calls);
  }

  const knownFilenameInjectionFixture = createPreflightClient({
    ledgerFilenameAfterMigration: "001_preflight_sentinel.sql",
  });
  await assert.rejects(
    runWithAdvisoryLock(knownFilenameInjectionFixture.client, {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
    }),
    /ledger INSERT did not insert exactly one row.*rowCount=0/,
  );
  assertCleanupOrder(knownFilenameInjectionFixture.calls);

  const ledgerDeletionFixture = createPreflightClient({
    deleteLedgerFilenameAfterMigration: legacyBaselineFilenames[0],
  });
  await assert.rejects(
    runWithAdvisoryLock(ledgerDeletionFixture.client, {
      migrationsDir: gatedDir,
      log: () => undefined,
      roleConfig,
    }),
    /missing required production legacy tombstone/,
  );
  assertCleanupOrder(ledgerDeletionFixture.calls);

  const preloadDir = path.join(testDir, "preload-before-mutation");
  await mkdir(preloadDir);
  await writeSelfTestMigrationBaseline(preloadDir, manifestText);
  await writeFile(
    path.join(preloadDir, "001_preflight_sentinel.sql"),
    "SELECT preflight_sentinel;",
  );
  await writeFile(
    path.join(preloadDir, "002_invalid_preload.sql"),
    "\\echo unsafe",
  );
  const preloadFailureFixture = createPreflightClient();
  await assert.rejects(
    runWithAdvisoryLock(preloadFailureFixture.client, {
      migrationsDir: preloadDir,
      log: () => undefined,
      roleConfig,
    }),
    /002_invalid_preload\.sql contains unsupported psql meta-commands/,
  );
  assertNoMigrationMutation(preloadFailureFixture.calls);
  assertCleanupOrder(preloadFailureFixture.calls);

  const collisionDir = path.join(testDir, "manifest-collision");
  await mkdir(collisionDir);
  await writeSelfTestMigrationBaseline(collisionDir, manifestText);
  await writeFile(
    path.join(collisionDir, "0000_missing_enum_types.sql"),
    "SELECT 1;",
  );
  await assert.rejects(
    loadMigrationInventory(collisionDir),
    /collides with repository SQL migration file.*0000_missing_enum_types\.sql/,
  );

  const unsafeRepositoryDir = path.join(testDir, "unsafe-repository-name");
  await mkdir(unsafeRepositoryDir);
  await writeSelfTestMigrationBaseline(unsafeRepositoryDir, manifestText);
  await writeFile(
    path.join(unsafeRepositoryDir, "unsafe..migration.sql"),
    "SELECT 1;",
  );
  await assert.rejects(
    loadMigrationInventory(unsafeRepositoryDir),
    /Unsafe migration filename.*unsafe\.\.migration\.sql/,
  );

  const nonCanonicalManifestDir = path.join(testDir, "noncanonical-manifest");
  await mkdir(nonCanonicalManifestDir);
  await writeSelfTestLegacyRepositoryFiles(nonCanonicalManifestDir);
  await writeFile(
    path.join(nonCanonicalManifestDir, LEGACY_LEDGER_MANIFEST_FILENAME),
    manifestText + "\n",
  );
  await assert.rejects(
    loadMigrationInventory(nonCanonicalManifestDir),
    /must be canonical two-space JSON/,
  );

  const missingManifestDir = path.join(testDir, "missing-manifest");
  await mkdir(missingManifestDir);
  await assert.rejects(
    loadMigrationInventory(missingManifestDir),
    /Could not read required legacy migration ledger manifest/,
  );

  const roleFailureCases = [
    [
      { initialSessionUser: "neondb_owner" },
      /role mismatch during initial connection/,
    ],
    [
      { initialCurrentUser: "neondb_owner" },
      /role mismatch during initial connection/,
    ],
    [
      { roleRows: [makeRole(roleConfig.loginRole, true)] },
      /required PostgreSQL role does not exist/,
    ],
    [
      {
        roleRows: [
          makeRole(roleConfig.loginRole, true),
          makeRole(roleConfig.ownerRole, true),
        ],
      },
      /must be NOLOGIN/,
    ],
    [
      {
        roleRows: [
          makeRole(roleConfig.loginRole, true, { rolsuper: true }),
          makeRole(roleConfig.ownerRole, false),
        ],
      },
      /forbidden attributes: SUPERUSER/,
    ],
    [
      {
        roleRows: [
          makeRole(roleConfig.loginRole, true, { rolinherit: true }),
          makeRole(roleConfig.ownerRole, false),
        ],
      },
      /forbidden attributes: INHERIT/,
    ],
    [
      {
        roleRows: [
          makeRole(roleConfig.loginRole, true, { rolcreaterole: true }),
          makeRole(roleConfig.ownerRole, false),
        ],
      },
      /forbidden attributes: CREATEROLE/,
    ],
    [
      {
        roleRows: [
          makeRole(roleConfig.loginRole, true, { rolcreatedb: true }),
          makeRole(roleConfig.ownerRole, false),
        ],
      },
      /forbidden attributes: CREATEDB/,
    ],
    [
      {
        roleRows: [
          makeRole(roleConfig.loginRole, true),
          makeRole(roleConfig.ownerRole, false, { rolinherit: true }),
        ],
      },
      /forbidden attributes: INHERIT/,
    ],
    [
      {
        roleRows: [
          makeRole(roleConfig.loginRole, true),
          makeRole(roleConfig.ownerRole, false, { rolcreatedb: true }),
        ],
      },
      /forbidden attributes: CREATEDB/,
    ],
    [
      { loginMembershipCount: 2 },
      /must have exactly one direct ADMIN FALSE, INHERIT FALSE, SET TRUE membership/,
    ],
    [
      { exactOwnerMembershipCount: 0 },
      /must have exactly one direct ADMIN FALSE, INHERIT FALSE, SET TRUE membership/,
    ],
    [{ ownerMembershipCount: 1 }, /must not be a member of another role/],
    [
      { ownerDirectMemberCount: 4 },
      /unexpected direct members or membership options/,
    ],
    [
      { ownerAdminMemberCount: 0 },
      /unexpected direct members or membership options/,
    ],
    [
      { ownerMigrationMemberCount: 0 },
      /unexpected direct members or membership options/,
    ],
    [
      { ownerRuntimeMemberCount: 0 },
      /unexpected direct members or membership options/,
    ],
    [
      { activatedCurrentUser: roleConfig.loginRole },
      /role mismatch during owner role activation/,
    ],
  ];
  for (const [overrides, expectedError] of roleFailureCases) {
    await expectPreflightFailure(overrides, expectedError);
  }

  await expectPreflightFailure(
    {
      schemaRows: [
        {
          schema_name: "public",
          schema_exists: false,
          has_usage: false,
          has_create: false,
        },
      ],
    },
    /"public" does not exist/,
  );
  await expectPreflightFailure(
    {
      schemaRows: [
        {
          schema_name: "public",
          schema_exists: true,
          has_usage: true,
          has_create: false,
        },
      ],
    },
    /"public" lacks CREATE/,
  );

  for (const [objectKind, objectName] of [
    ["relation", "crm_customers"],
    ["function", "legacy_trigger()"],
    ["type", "legacy_status"],
  ]) {
    await expectPreflightFailure(
      {
        ownershipRows: [
          {
            object_kind: objectKind,
            schema_name: "public",
            object_name: objectName,
            owner_name: "neondb_owner",
            mismatch_count: 1,
          },
        ],
      },
      new RegExp("preflight ownership audit found 1 object.*" + objectKind),
    );
  }

  await expectPreflightFailure(
    {
      ownershipRows: [
        {
          object_kind: "relation",
          schema_name: "public",
          object_name: "crm_customers",
          owner_name: "neondb_owner",
          mismatch_count: 25,
        },
      ],
    },
    /plus 24 more/,
  );
}

async function runSelfTest() {
  assert.throws(() => requireDatabaseUrl(""), /DATABASE_URL is required/);
  assert.throws(() => requireDatabaseUrl("https://example.test"), /scheme/);
  assert.throws(
    () =>
      requireDatabaseUrl(
        "postgresql://user:password@db-pooler.example.test/app?sslmode=require&channel_binding=require",
      ),
    /direct PostgreSQL endpoint/,
  );
  assert.throws(
    () =>
      requireDatabaseUrl(
        "postgresql://user:password@db.example.test/app?sslmode=require",
      ),
    /exactly one channel_binding=require/,
  );
  assert.throws(
    () =>
      requireDatabaseUrl(
        "postgresql://user:password@db.example.test/app?sslmode=disable&channel_binding=require",
      ),
    /exactly one sslmode/,
  );
  assert.equal(
    requireDatabaseUrl(
      "postgresql://user:password@db.example.test/app?sslmode=verify-full&channel_binding=require",
    ),
    "postgresql://user:password@db.example.test/app?sslmode=verify-full&channel_binding=require",
  );
  assert.deepEqual(parseCliOptions(["--expect-zero"]), {
    selfTest: false,
    preflightOnly: false,
    expectZero: true,
  });
  assert.throws(() => parseCliOptions(["--typo"]), /Unsupported/);
  assert.throws(
    () => parseCliOptions(["--preflight-only", "--expect-zero"]),
    /cannot be combined/,
  );

  assert.deepEqual(
    versionSortMigrationFiles([
      "0001_second.sql",
      "001_first.sql",
      "044_short.sql",
      "0044_long.sql",
    ]),
    ["001_first.sql", "0001_second.sql", "0044_long.sql", "044_short.sql"],
  );
  const expectedLegacyAppliedFilenames = [
    "0000b_missing_columns.sql",
    "0000c_missing_tables.sql",
    "0000_missing_enum_types.sql",
    "0448_leadgrid_blog_posts.sql",
    "0450_admin_workspace_projects.sql",
    "0451_admin_workspace_projects_leadgrid_links.sql",
    "0452_admin_workspace_documents.sql",
    "0453_admin_workspace_tasks.sql",
    "0454_admin_workspace_calendar.sql",
    "0455_admin_workspace_funding_opportunities.sql",
    "0456_admin_workspace_document_review.sql",
    "0457_admin_document_context.sql",
    "0458_admin_workspace_project_files.sql",
    "0459_admin_workspace_cv_profiles.sql",
    "0460_leadgrid_workflow_event_ingress_security.sql",
    "0461_leadgrid_public_self_onboard_rate_limits.sql",
    "0462_org_setup_template_plan_integrity.sql",
    "0463_casting_reminder_delivery_claims.sql",
    "0464_users_auth_session_version.sql",
    "0465_leadgrid_canvas_integrity.sql",
    "0470_role_room_linkedin_publish_queue.sql",
    "0471_project_pricing_and_time_tracking.sql",
    "0472_workspace_project_bookings.sql",
    "0473_workspace_project_equipment.sql",
  ];
  const productionManifest = await loadLegacyLedgerManifest(
    DEFAULT_MIGRATIONS_DIR,
  );
  assert.deepEqual(
    [...productionManifest.legacyAppliedFilenames],
    expectedLegacyAppliedFilenames,
    "the versioned production baseline must contain exactly the 24 reviewed ledger-only tombstones",
  );
  const productionInventory = await loadMigrationInventory(
    DEFAULT_MIGRATIONS_DIR,
  );
  assert.equal(productionInventory.legacyAppliedFilenames.size, 24);
  assert.deepEqual(
    productionInventory.legacyRepositoryMigrationFiles,
    LEGACY_REPOSITORY_MIGRATION_FILENAMES,
    "the eight non-numeric repository migrations are an immutable baseline",
  );
  assert.ok(
    productionInventory.migrationFiles.length > 0,
    "the production migration inventory must contain repository SQL files",
  );
  const manifestText = JSON.stringify(productionManifest, null, 2) + "\n";
  const validManifest = {
    formatVersion: LEGACY_LEDGER_MANIFEST_FORMAT_VERSION,
    baselineId: LEGACY_LEDGER_BASELINE_ID,
    legacyAppliedFilenames: [...expectedLegacyAppliedFilenames],
  };
  assert.throws(
    () => validateLegacyLedgerManifest({ ...validManifest, extra: true }),
    /exactly these keys/,
  );
  assert.throws(
    () =>
      validateLegacyLedgerManifest({
        ...validManifest,
        formatVersion: 2,
      }),
    /formatVersion must be 1/,
  );
  assert.throws(
    () =>
      validateLegacyLedgerManifest({
        ...validManifest,
        baselineId: "wrong-baseline",
      }),
    /baselineId must be/,
  );
  assert.throws(
    () =>
      validateLegacyLedgerManifest({
        ...validManifest,
        legacyAppliedFilenames: [
          ...expectedLegacyAppliedFilenames,
          expectedLegacyAppliedFilenames[0],
        ],
      }),
    /duplicate migration filename/,
  );
  assert.throws(
    () =>
      validateLegacyLedgerManifest({
        ...validManifest,
        legacyAppliedFilenames: ["../escape.sql"],
      }),
    /unsafe migration filename/,
  );
  assert.throws(
    () =>
      validateLegacyLedgerManifest({
        ...validManifest,
        legacyAppliedFilenames: [
          expectedLegacyAppliedFilenames[1],
          expectedLegacyAppliedFilenames[0],
        ],
      }),
    /version-sort order/,
  );
  assert.throws(
    () => versionSortMigrationFiles(["unsafe..migration.sql"]),
    /Unsafe migration filename/,
  );

  const testDir = await mkdtemp(
    path.join(tmpdir(), "creatorhub-migrations-self-test-"),
  );
  try {
    await writeSelfTestMigrationBaseline(testDir, manifestText);
    await writeFile(path.join(testDir, "001_ok.sql"), "SELECT 1;");
    await writeFile(path.join(testDir, "002_fail.sql"), "SELECT broken;");
    await writeFile(path.join(testDir, "003_never.sql"), "SELECT 3;");

    const standaloneRoleConfig = {
      loginRole: "creatorhub_migration_login",
      ownerRole: "creatorhub_schema_owner",
      ownedSchemas: ["public"],
    };
    const standaloneAppliedFilenames = [
      ...expectedLegacyAppliedFilenames,
      ...LEGACY_REPOSITORY_MIGRATION_FILENAMES,
    ];
    const executed = [];
    const fakeClient = {
      async query(text, values) {
        executed.push({ text, values });
        if (text === MIGRATION_TRACKER_RELATION_SQL) {
          return {
            rows: [
              {
                relation_oid: 4242,
                relkind: "r",
                owner_name: standaloneRoleConfig.ownerRole,
              },
            ],
          };
        }
        if (text === MIGRATION_TRACKER_COLUMNS_SQL) {
          return {
            rows: [
              {
                ordinal: 1,
                column_name: "id",
                data_type: "integer",
                not_null: true,
                default_expression:
                  "nextval('_migrations_applied_id_seq'::regclass)",
              },
              {
                ordinal: 2,
                column_name: "filename",
                data_type: "character varying(255)",
                not_null: true,
                default_expression: null,
              },
              {
                ordinal: 3,
                column_name: "applied_at",
                data_type: "timestamp without time zone",
                not_null: false,
                default_expression: "now()",
              },
              {
                ordinal: 4,
                column_name: "checksum_sha256",
                data_type: "character varying(64)",
                not_null: false,
                default_expression: null,
              },
            ],
          };
        }
        if (text === MIGRATION_TRACKER_INDEXES_SQL) {
          return {
            rows: [
              {
                has_primary_id: true,
                has_unique_filename: true,
              },
            ],
          };
        }
        if (text === MIGRATION_LEDGER_FILENAMES_SQL) {
          return {
            rows: standaloneAppliedFilenames.map((filename) => ({ filename })),
          };
        }
        if (text === SESSION_IDENTITY_SQL) {
          return {
            rows: [
              {
                session_user: standaloneRoleConfig.loginRole,
                current_user: standaloneRoleConfig.ownerRole,
              },
            ],
          };
        }
        if (text === MIGRATION_SEARCH_PATH_SQL) {
          return { rows: [{ search_path: MIGRATION_SEARCH_PATH }] };
        }
        if (String(text).startsWith("INSERT INTO public._migrations_applied")) {
          standaloneAppliedFilenames.push(String(values?.[0]));
          return { rows: [], rowCount: 1 };
        }
        if (text === "SELECT broken;") {
          const error = new Error("synthetic SQL failure");
          error.code = "42601";
          throw error;
        }
        return { rows: [] };
      },
    };

    await assert.rejects(
      applyPendingMigrations(fakeClient, {
        migrationsDir: testDir,
        log: () => undefined,
        roleConfig: standaloneRoleConfig,
      }),
      /Migration 002_fail\.sql failed: 42601/,
    );
    assert.equal(
      executed.some((call) => call.text === "SELECT 3;"),
      false,
      "runner must stop before the migration after a SQL failure",
    );
    assert.equal(
      executed.filter((call) =>
        String(call.text).startsWith("INSERT INTO public._migrations_applied"),
      ).length,
      1,
      "only successful migrations may be tracked",
    );

    const lockClient = {
      async query(text) {
        if (String(text).includes("pg_try_advisory_lock")) {
          return { rows: [{ acquired: false }] };
        }
        return { rows: [] };
      },
    };
    await assert.rejects(
      runWithAdvisoryLock(lockClient, {
        migrationsDir: testDir,
        log: () => undefined,
      }),
      /already holds the database lock/,
    );

    await runPreflightSelfTest(testDir, manifestText);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }

  console.log("Production migration runner self-test passed.");
}

async function main() {
  const options = parseCliOptions();
  if (options.selfTest) {
    await runSelfTest();
    return;
  }

  const connectionString = requireDatabaseUrl();
  const roleConfig = requireMigrationRoleConfig();
  const { Client } = await import("pg");
  const client = new Client({
    connectionString,
    enableChannelBinding: true,
    application_name: "creatorhub-production-migrations",
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });

  try {
    await client.connect();
    const result = await runWithAdvisoryLock(client, {
      roleConfig,
      preflightOnly: options.preflightOnly,
      expectZero: options.expectZero,
    });
    if (result.preflightOnly) {
      console.log("Migration preflight complete; no migrations executed.");
      return;
    }
    console.log(
      "Migration run complete: " +
        result.appliedCount +
        " applied, " +
        result.skippedCount +
        " skipped, " +
        result.totalCount +
        " total.",
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error("Production migration failed: " + safeErrorMessage(error));
    process.exitCode = 1;
  });
}
