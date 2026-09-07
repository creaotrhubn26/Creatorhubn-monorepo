import process from "node:process";
import { pathToFileURL } from "node:url";

const ACTIVE_KEY_SUMMARY_SQL = `WITH eligible_projects AS (
  SELECT organization_id,
         COUNT(*)::int AS project_count
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
     AND (status IS NULL OR status NOT IN ('archived', 'deleted'))
     AND (project_type IS NULL OR project_type NOT IN (
       'feature_film', 'documentary', 'film', 'short_film',
       'tv_series', 'commercial', 'music_video', 'casting'
     ))
   GROUP BY organization_id
), active_legacy AS (
  SELECT k.organization_id,
         COUNT(*)::int AS key_count
    FROM leadgrid_api_keys k
   WHERE k.revoked_at IS NULL
     AND __LEGACY_PREDICATE__
   GROUP BY k.organization_id
)
SELECT COALESCE(SUM(a.key_count), 0)::int AS active_legacy_keys,
       COUNT(*)::int AS organizations_with_active_legacy_keys,
       COALESCE(SUM(
         CASE WHEN COALESCE(e.project_count, 0) = 1
              THEN a.key_count ELSE 0 END
       ), 0)::int AS keys_auto_bindable,
       COALESCE(SUM(
         CASE WHEN COALESCE(e.project_count, 0) <> 1
              THEN a.key_count ELSE 0 END
       ), 0)::int AS keys_requiring_rotation,
       COUNT(*) FILTER (
         WHERE COALESCE(e.project_count, 0) <> 1
       )::int AS organizations_requiring_rotation
  FROM active_legacy a
  LEFT JOIN eligible_projects e USING (organization_id)`;

function integer(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Invalid aggregate returned for " + field);
  }
  return parsed;
}

export function normalizeSummary(row = {}) {
  return {
    activeLegacyKeys: integer(row.active_legacy_keys ?? 0, "activeLegacyKeys"),
    organizationsWithActiveLegacyKeys: integer(
      row.organizations_with_active_legacy_keys ?? 0,
      "organizationsWithActiveLegacyKeys",
    ),
    keysAutoBindable: integer(row.keys_auto_bindable ?? 0, "keysAutoBindable"),
    keysRequiringRotation: integer(
      row.keys_requiring_rotation ?? 0,
      "keysRequiringRotation",
    ),
    organizationsRequiringRotation: integer(
      row.organizations_requiring_rotation ?? 0,
      "organizationsRequiringRotation",
    ),
  };
}

function requireDirectDatabaseUrl(value) {
  if (!value) throw new Error("DATABASE_URL is required");
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  if (url.hostname.includes("-pooler.")) {
    throw new Error("DATABASE_URL must use the direct production endpoint");
  }
  return value;
}

function requireOwnerRole(value) {
  if (!value) throw new Error("MIGRATION_OWNER_ROLE is required");
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error("MIGRATION_OWNER_ROLE must be a simple PostgreSQL identifier");
  }
  return value;
}

export async function inspectLeadgridApiKeyScope(client, ownerRole) {
  const validatedOwnerRole = requireOwnerRole(ownerRole);
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    await client.query('SET LOCAL ROLE "' + validatedOwnerRole + '"');
    const identity = await client.query("SELECT current_user AS current_user");
    if (identity.rows[0]?.current_user !== validatedOwnerRole) {
      throw new Error("Could not activate the configured migration owner role");
    }
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");

    const relations = await client.query(`
      SELECT to_regclass('public.leadgrid_api_keys') IS NOT NULL AS has_keys,
             to_regclass('public.leadgrid_projects') IS NOT NULL AS has_projects
    `);
    const relation = relations.rows[0] ?? {};
    if (!relation.has_keys || !relation.has_projects) {
      throw new Error(
        "Required Leadgrid API-key/project tables are missing; refusing production migration",
      );
    }

    const columns = await client.query(`
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'leadgrid_api_keys'
         AND column_name = 'access_scope'
    `);
    const hasAccessScope = columns.rowCount === 1;
    const predicate = hasAccessScope ? "k.access_scope IS NULL" : "TRUE";
    const result = await client.query(
      ACTIVE_KEY_SUMMARY_SQL.replace("__LEGACY_PREDICATE__", predicate),
    );
    return normalizeSummary(result.rows[0]);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
  }
}

async function selfTest() {
  const summary = normalizeSummary({
    active_legacy_keys: "3",
    organizations_with_active_legacy_keys: "2",
    keys_auto_bindable: "1",
    keys_requiring_rotation: "2",
    organizations_requiring_rotation: "1",
  });
  if (summary.keysRequiringRotation !== 2 || summary.keysAutoBindable !== 1) {
    throw new Error("Summary normalization self-test failed");
  }
  if (!ACTIVE_KEY_SUMMARY_SQL.includes("__LEGACY_PREDICATE__")) {
    throw new Error("Legacy predicate placeholder is missing");
  }
  let rejectedPooler = false;
  try {
    requireDirectDatabaseUrl(
      "postgresql://user@example-pooler.test/app?sslmode=require",
    );
  } catch {
    rejectedPooler = true;
  }
  if (!rejectedPooler) throw new Error("Pooler rejection self-test failed");
  if (requireOwnerRole("creatorhub_schema_owner") !== "creatorhub_schema_owner") {
    throw new Error("Owner-role validation self-test failed");
  }
  let rejectedOwnerRole = false;
  try {
    requireOwnerRole('creatorhub_schema_owner"; RESET ROLE; --');
  } catch {
    rejectedOwnerRole = true;
  }
  if (!rejectedOwnerRole) throw new Error("Unsafe owner role was accepted");
  console.log("Leadgrid API-key scope preflight self-test passed.");
}

async function main() {
  if (process.argv.slice(2).includes("--self-test")) {
    await selfTest();
    return;
  }
  if (process.argv.length > 2) throw new Error("Unsupported argument");

  const connectionString = requireDirectDatabaseUrl(process.env.DATABASE_URL);
  const ownerRole = requireOwnerRole(process.env.MIGRATION_OWNER_ROLE);
  const { Client } = await import("pg");
  const client = new Client({
    connectionString,
    enableChannelBinding: true,
    application_name: "leadgrid-api-key-scope-preflight",
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });

  try {
    await client.connect();
    const summary = await inspectLeadgridApiKeyScope(client, ownerRole);
    console.log("Leadgrid Public API key preflight: " + JSON.stringify(summary));
    if (summary.keysRequiringRotation > 0) {
      throw new Error(
        summary.keysRequiringRotation +
          " active legacy Public API key(s) across " +
          summary.organizationsRequiringRotation +
          " organization(s) require deliberate rotation before migration 0526",
      );
    }
    console.log("Leadgrid Public API key migration preflight passed.");
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Leadgrid Public API key migration preflight failed: " +
        (error instanceof Error ? error.message : "unknown error"),
    );
    process.exitCode = 1;
  });
}
