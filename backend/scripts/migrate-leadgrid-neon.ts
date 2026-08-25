/**
 * Safely migrates the legacy Leadgrid business dataset between two Neon DBs.
 *
 * Safety properties:
 * - dry-run by default; --validate executes everything and rolls back
 * - --apply requires an explicit target-host confirmation
 * - target rows with an existing primary/unique key are preserved
 * - user/org identifiers are remapped by stable identity keys
 * - stale pending URL-research work is quarantined instead of replayed
 * - the complete operation is one target transaction guarded by an advisory lock
 *
 * Required environment:
 *   LEADGRID_SOURCE_DATABASE_URL
 *   LEADGRID_TARGET_DATABASE_URL
 *
 * Apply confirmation:
 *   LEADGRID_MIGRATION_CONFIRM_TARGET=<target hostname>
 */

import pg, { type Pool, type PoolClient } from "pg";

type DbRow = Record<string, unknown>;
type IdentityRow = {
  id: string;
  email: string | null;
  username: string | null;
};
type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  org_number: string | null;
};
type CopyStats = {
  source: number;
  inserted: number;
  preserved: number;
  quarantined?: number;
};

const { Pool: PgPool } = pg;
const argv = new Set(process.argv.slice(2));
const mode = argv.has("--apply")
  ? "apply"
  : argv.has("--validate")
    ? "validate"
    : "plan";

const sourceUrl = process.env.LEADGRID_SOURCE_DATABASE_URL?.trim();
const targetUrl = process.env.LEADGRID_TARGET_DATABASE_URL?.trim();
if (!sourceUrl || !targetUrl) {
  throw new Error(
    "LEADGRID_SOURCE_DATABASE_URL and LEADGRID_TARGET_DATABASE_URL are required",
  );
}

const sourceParsed = new URL(sourceUrl);
const targetParsed = new URL(targetUrl);
if (sourceParsed.href === targetParsed.href)
  throw new Error("Source and target must be different databases");
if (mode === "apply") {
  const confirmed = process.env.LEADGRID_MIGRATION_CONFIRM_TARGET?.trim();
  if (confirmed !== targetParsed.hostname) {
    throw new Error(
      `Apply blocked: LEADGRID_MIGRATION_CONFIRM_TARGET must equal ${targetParsed.hostname}`,
    );
  }
}

const source = new PgPool({ connectionString: sourceUrl, max: 2 });
const target = new PgPool({ connectionString: targetUrl, max: 2 });
const q = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
const norm = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const stats = new Map<string, CopyStats>();
const userIdMap = new Map<string, string>();
const orgIdMap = new Map<string, string>();
const targetUserIds = new Set<string>();
const targetOrgIds = new Set<string>();
const sourceProjectIds = new Set<string>();
const batchQuarantineCounts = new Map<string, number>();

const USER_ID_COLUMNS = new Set([
  "user_id",
  "owner_user_id",
  "assigned_user_id",
  "assigned_by_user_id",
  "assigned_team_leader_id",
  "last_action_by_user_id",
  "status_changed_by_user_id",
  "from_user_id",
  "to_user_id",
  "set_by_user_id",
  "workspace_owner_user_id",
  "added_by_user_id",
  "sent_by_user_id",
  "created_by",
  "updated_by",
  "detected_by",
  "triggered_by",
]);
const ORG_ID_COLUMNS = new Set(["organization_id", "target_org_id"]);

function mapUser(value: unknown): unknown {
  if (value == null || value === "") return value;
  const id = String(value);
  return userIdMap.get(id) ?? id;
}

function mapOrg(value: unknown): unknown {
  if (value == null || value === "") return value;
  const id = String(value);
  return orgIdMap.get(id) ?? id;
}

function transformIdentifiers(row: DbRow): DbRow {
  const transformed = { ...row };
  for (const [column, value] of Object.entries(transformed)) {
    if (USER_ID_COLUMNS.has(column)) transformed[column] = mapUser(value);
    if (ORG_ID_COLUMNS.has(column)) transformed[column] = mapOrg(value);
  }
  return transformed;
}

async function tableColumns(
  client: Pool | PoolClient,
  table: string,
): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
        AND is_generated = 'NEVER' AND is_identity = 'NO'
      ORDER BY ordinal_position`,
    [table],
  );
  return result.rows.map((row) => row.column_name);
}

async function jsonColumns(
  client: Pool | PoolClient,
  table: string,
): Promise<Set<string>> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
        AND data_type IN ('json', 'jsonb')`,
    [table],
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function conflictKey(
  client: PoolClient,
  table: string,
): Promise<string[]> {
  const result = await client.query<{ columns: string[] }>(
    `SELECT array_agg(a.attname::text ORDER BY u.ordinality) AS columns
       FROM pg_index i
       JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS u(attnum, ordinality) ON true
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = u.attnum
      WHERE i.indrelid = $1::regclass AND i.indisunique AND i.indpred IS NULL
      GROUP BY i.indexrelid, i.indisprimary
      ORDER BY i.indisprimary DESC, i.indexrelid
      LIMIT 1`,
    [`public.${table}`],
  );
  const columns = result.rows[0]?.columns ?? [];
  if (columns.length === 0)
    throw new Error(`No usable primary/unique key found for ${table}`);
  return columns;
}

function keyOf(row: DbRow, columns: string[]): string {
  return JSON.stringify(columns.map((column) => row[column] ?? null));
}

async function sourceRows(table: string, columns: string[]): Promise<DbRow[]> {
  const result = await source.query<DbRow>(
    `SELECT ${columns.map(q).join(", ")} FROM public.${q(table)}`,
  );
  return result.rows;
}

function sortIndustries(rows: DbRow[]): DbRow[] {
  const remaining = new Map(rows.map((row) => [String(row.id), row]));
  const emitted = new Set<string>();
  const sorted: DbRow[] = [];
  while (remaining.size > 0) {
    let progressed = false;
    for (const [id, row] of remaining) {
      const parent = row.parent_id == null ? null : String(row.parent_id);
      if (parent == null || emitted.has(parent) || !remaining.has(parent)) {
        sorted.push(row);
        emitted.add(id);
        remaining.delete(id);
        progressed = true;
      }
    }
    if (!progressed) throw new Error("Cycle detected in industries.parent_id");
  }
  return sorted;
}

async function insertRows(
  client: PoolClient,
  table: string,
  inputRows: DbRow[],
  transform: (row: DbRow) => DbRow = transformIdentifiers,
): Promise<CopyStats> {
  const targetColumns = await tableColumns(client, table);
  const inputColumns =
    inputRows.length > 0
      ? Object.keys(inputRows[0])
      : await tableColumns(source, table);
  const columns = targetColumns.filter((column) =>
    inputColumns.includes(column),
  );
  const targetJsonColumns = await jsonColumns(client, table);
  if (columns.length === 0) throw new Error(`No shared columns for ${table}`);
  const keyColumns = await conflictKey(client, table);
  const existingResult = await client.query<DbRow>(
    `SELECT ${keyColumns.map(q).join(", ")} FROM public.${q(table)}`,
  );
  const existing = new Set(
    existingResult.rows.map((row) => keyOf(row, keyColumns)),
  );
  let inserted = 0;
  let preserved = 0;

  for (const raw of inputRows) {
    const row = transform(raw);
    const key = keyOf(row, keyColumns);
    if (existing.has(key)) {
      preserved += 1;
      continue;
    }
    if (mode === "plan") {
      inserted += 1;
      existing.add(key);
      continue;
    }
    const values = columns.map((column) => {
      const value = row[column];
      return value == null || !targetJsonColumns.has(column)
        ? value
        : JSON.stringify(value);
    });
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    let result;
    try {
      result = await client.query(
        `INSERT INTO public.${q(table)} (${columns.map(q).join(", ")})
         VALUES (${placeholders.join(", ")})
         ON CONFLICT DO NOTHING
         RETURNING ${keyColumns.map(q).join(", ")}`,
        values,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${table} insert failed: ${message}`);
    }
    if (result.rowCount !== 1) {
      throw new Error(
        `Non-key conflict while inserting into ${table}; transaction aborted`,
      );
    }
    inserted += 1;
    existing.add(key);
  }
  const result = { source: inputRows.length, inserted, preserved };
  stats.set(table, result);
  return result;
}

async function copyTable(
  client: PoolClient,
  table: string,
  options: {
    filter?: (row: DbRow) => boolean;
    transform?: (row: DbRow) => DbRow;
    sort?: (rows: DbRow[]) => DbRow[];
  } = {},
): Promise<CopyStats> {
  const targetColumns = await tableColumns(client, table);
  const sourceColumns = await tableColumns(source, table);
  const columns = targetColumns.filter((column) =>
    sourceColumns.includes(column),
  );
  let rows = await sourceRows(table, columns);
  if (options.filter) rows = rows.filter(options.filter);
  if (options.sort) rows = options.sort(rows);
  return insertRows(client, table, rows, options.transform);
}

async function buildIdentityMaps(): Promise<void> {
  const sourceUsers = (
    await source.query<IdentityRow>(
      `SELECT id::text, email, username FROM users ORDER BY id::text`,
    )
  ).rows;
  const targetUsers = (
    await target.query<IdentityRow>(
      `SELECT id::text, email, username FROM users ORDER BY id::text`,
    )
  ).rows;
  const byEmail = new Map<string, string>();
  const byUsername = new Map<string, string>();
  for (const user of targetUsers) {
    targetUserIds.add(user.id);
    if (norm(user.email)) byEmail.set(norm(user.email), user.id);
    if (norm(user.username)) byUsername.set(norm(user.username), user.id);
  }
  for (const user of sourceUsers) {
    const targetId = targetUserIds.has(user.id)
      ? user.id
      : (byEmail.get(norm(user.email)) ?? byUsername.get(norm(user.username)));
    if (targetId) userIdMap.set(user.id, targetId);
  }

  const sourceOrgs = (
    await source.query<OrgRow>(
      `SELECT id::text, name, slug, org_number FROM organizations ORDER BY id::text`,
    )
  ).rows;
  const targetOrgs = (
    await target.query<OrgRow>(
      `SELECT id::text, name, slug, org_number FROM organizations ORDER BY id::text`,
    )
  ).rows;
  const bySlug = new Map<string, string>();
  const byOrgNumber = new Map<string, string>();
  for (const org of targetOrgs) {
    targetOrgIds.add(org.id);
    if (norm(org.slug)) bySlug.set(norm(org.slug), org.id);
    if (norm(org.org_number)) byOrgNumber.set(norm(org.org_number), org.id);
  }
  for (const org of sourceOrgs) {
    const targetId = targetOrgIds.has(org.id)
      ? org.id
      : (bySlug.get(norm(org.slug)) ?? byOrgNumber.get(norm(org.org_number)));
    if (targetId) orgIdMap.set(org.id, targetId);
  }
}

async function validateSourceOwnership(): Promise<void> {
  const result = await source.query<{
    owners: string[];
    orgs: string[];
    projects: string[];
  }>(
    `SELECT
       ARRAY(SELECT DISTINCT owner_user_id FROM crm_customers WHERE owner_user_id IS NOT NULL) AS owners,
       ARRAY(SELECT DISTINCT organization_id::text FROM crm_customers WHERE organization_id IS NOT NULL) AS orgs,
       ARRAY(SELECT DISTINCT project_id FROM crm_customers WHERE project_id IS NOT NULL) AS projects`,
  );
  const row = result.rows[0];
  const unmappedUsers = row.owners.filter(
    (id) => !userIdMap.has(id) && !targetUserIds.has(id),
  );
  const unmappedOrgs = row.orgs.filter(
    (id) => !orgIdMap.has(id) && !targetOrgIds.has(id),
  );
  if (unmappedUsers.length || unmappedOrgs.length) {
    throw new Error(
      `Unmapped CRM identities: users=${unmappedUsers.length}, organizations=${unmappedOrgs.length}`,
    );
  }
  for (const project of row.projects) sourceProjectIds.add(project);
}

async function migrateProjects(client: PoolClient): Promise<void> {
  const ids = [...sourceProjectIds].sort();
  const sourceColumns = await tableColumns(source, "casting_projects");
  const rows = (
    await source.query<DbRow>(
      `SELECT ${sourceColumns.map(q).join(", ")}
         FROM casting_projects
        WHERE id = ANY($1::text[])
        ORDER BY id`,
      [ids],
    )
  ).rows;
  const found = new Set(rows.map((row) => String(row.id)));
  for (const id of ids) {
    if (found.has(id)) continue;
    const context = (
      await source.query<{ organization_id: string; owner_user_id: string }>(
        `SELECT organization_id::text, owner_user_id::text
           FROM crm_customers
          WHERE project_id = $1
          ORDER BY created_at ASC
          LIMIT 1`,
        [id],
      )
    ).rows[0];
    if (!context) throw new Error(`Cannot reconstruct missing project ${id}`);
    rows.push({
      id,
      organization_id: mapOrg(context.organization_id),
      name: id === "leadgrid-salg-dogfood" ? "Leadgrid salg (dogfood)" : id,
      description:
        "Reconstructed from a legacy CRM project reference during Neon migration.",
      status: "active",
      project_type: "b2b_sales",
      settings: {},
      metadata: {
        migrated_from: "legacy_crm_project_reference",
        source_project_row_missing: true,
      },
      created_by: mapUser(context.owner_user_id),
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
  await insertRows(client, "leadgrid_projects", rows);
}

function quarantineItem(row: DbRow): DbRow {
  const transformed = transformIdentifiers(row);
  if (transformed.status !== "pending" && transformed.status !== "running")
    return transformed;
  const batchId = String(transformed.batch_id);
  batchQuarantineCounts.set(
    batchId,
    (batchQuarantineCounts.get(batchId) ?? 0) + 1,
  );
  transformed.status = "failed";
  transformed.error_message =
    transformed.error_message ??
    "[migration] legacy pending item quarantined to prevent duplicate processing";
  transformed.finished_at = transformed.finished_at ?? new Date();
  return transformed;
}

function quarantineBatch(row: DbRow): DbRow {
  const transformed = transformIdentifiers(row);
  const id = String(transformed.id);
  const quarantined = batchQuarantineCounts.get(id) ?? 0;
  if (quarantined === 0) return transformed;
  const completed = Number(transformed.completed_urls ?? 0);
  const failed = Number(transformed.failed_urls ?? 0) + quarantined;
  transformed.completed_urls = completed;
  transformed.failed_urls = failed;
  transformed.status = completed === 0 ? "failed" : "partial";
  transformed.finished_at = transformed.finished_at ?? new Date();
  transformed.metadata = {
    ...((transformed.metadata as Record<string, unknown> | null) ?? {}),
    migration: {
      source_status: row.status,
      quarantined_pending_items: quarantined,
      reason: "prevent_duplicate_processing",
    },
  };
  return transformed;
}

async function repairExistingCustomerLinks(client: PoolClient): Promise<void> {
  if (mode === "plan") return;
  for (const [oldId, newId] of userIdMap) {
    if (oldId === newId) continue;
    await client.query(
      `UPDATE crm_customers
          SET owner_user_id = CASE WHEN owner_user_id = $1 THEN $2 ELSE owner_user_id END,
              assigned_user_id = CASE WHEN assigned_user_id = $1 THEN $2 ELSE assigned_user_id END,
              assigned_by_user_id = CASE WHEN assigned_by_user_id = $1 THEN $2 ELSE assigned_by_user_id END,
              assigned_team_leader_id = CASE WHEN assigned_team_leader_id = $1 THEN $2 ELSE assigned_team_leader_id END,
              last_action_by_user_id = CASE WHEN last_action_by_user_id = $1 THEN $2 ELSE last_action_by_user_id END,
              status_changed_by_user_id = CASE WHEN status_changed_by_user_id = $1 THEN $2 ELSE status_changed_by_user_id END
        WHERE $1 = ANY(ARRAY[owner_user_id, assigned_user_id, assigned_by_user_id,
                              assigned_team_leader_id, last_action_by_user_id,
                              status_changed_by_user_id])`,
      [oldId, newId],
    );
  }
  for (const [oldId, newId] of orgIdMap) {
    if (oldId === newId) continue;
    await client.query(
      `UPDATE crm_customers SET organization_id = $2::uuid WHERE organization_id = $1::uuid`,
      [oldId, newId],
    );
  }
}

async function postChecks(client: PoolClient): Promise<DbRow> {
  const result = await client.query<DbRow>(
    `SELECT
       (SELECT count(*)::int FROM crm_customers) AS crm_customers,
       (SELECT count(*)::int FROM crm_customers c
          WHERE c.owner_user_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.owner_user_id)) AS orphan_owners,
       (SELECT count(*)::int FROM crm_customers c
          WHERE c.organization_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.organization_id)) AS orphan_orgs,
       (SELECT count(*)::int FROM crm_customers c
          WHERE c.project_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM leadgrid_projects p WHERE p.id = c.project_id)) AS orphan_projects,
       (SELECT count(*)::int FROM leadgrid_url_research_items WHERE status = 'pending') AS pending_url_items,
       (SELECT count(*)::int FROM leadgrid_workflow_resume_jobs WHERE status = 'pending') AS pending_resume_jobs`,
  );
  const checks = result.rows[0];
  if (
    Number(checks.orphan_owners) > 0 ||
    Number(checks.orphan_orgs) > 0 ||
    Number(checks.orphan_projects) > 0
  ) {
    throw new Error(`Post-check failed: ${JSON.stringify(checks)}`);
  }
  return checks;
}

async function run(): Promise<void> {
  const sourceInfo = await source.query<{ db: string }>(
    "SELECT current_database() AS db",
  );
  const targetInfo = await target.query<{ db: string }>(
    "SELECT current_database() AS db",
  );
  await buildIdentityMaps();
  await validateSourceOwnership();

  const client = await target.connect();
  try {
    if (mode !== "plan") {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '120s'");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('leadgrid-neon-migration-2026-08-25'))",
      );
    }

    await copyTable(client, "industries", { sort: sortIndustries });
    await migrateProjects(client);
    await copyTable(client, "brand_kits", {
      filter: (row) =>
        row.project_id != null && sourceProjectIds.has(String(row.project_id)),
    });
    await copyTable(client, "crm_customers");
    await repairExistingCustomerLinks(client);
    await copyTable(client, "crm_customer_needs");
    await copyTable(client, "crm_customer_signals");
    await copyTable(client, "crm_customer_scores");
    await copyTable(client, "crm_customer_scout_runs");
    await copyTable(client, "crm_lead_activities");
    await copyTable(client, "crm_deal_stage_history");
    await copyTable(client, "lead_scores_history");
    await copyTable(client, "lead_assignment_log");
    await copyTable(client, "leadgrid_project_discovery_config");
    await copyTable(client, "market_scans");
    await copyTable(client, "market_scan_competitors");

    // Build quarantine counts before transforming the parent batches.
    const itemTargetColumns = await tableColumns(
      client,
      "leadgrid_url_research_items",
    );
    const itemSourceColumns = await tableColumns(
      source,
      "leadgrid_url_research_items",
    );
    const itemColumns = itemTargetColumns.filter((column) =>
      itemSourceColumns.includes(column),
    );
    const rawItems = await sourceRows(
      "leadgrid_url_research_items",
      itemColumns,
    );
    const transformedItems = rawItems.map(quarantineItem);
    const batchTargetColumns = await tableColumns(
      client,
      "leadgrid_url_research_batches",
    );
    const batchSourceColumns = await tableColumns(
      source,
      "leadgrid_url_research_batches",
    );
    const batchColumns = batchTargetColumns.filter((column) =>
      batchSourceColumns.includes(column),
    );
    const rawBatches = await sourceRows(
      "leadgrid_url_research_batches",
      batchColumns,
    );
    await insertRows(
      client,
      "leadgrid_url_research_batches",
      rawBatches,
      quarantineBatch,
    );
    const itemStats = await insertRows(
      client,
      "leadgrid_url_research_items",
      transformedItems,
      (row) => row,
    );
    itemStats.quarantined = [...batchQuarantineCounts.values()].reduce(
      (sum, value) => sum + value,
      0,
    );

    await copyTable(client, "leadgrid_org_entitlements");
    await copyTable(client, "leadgrid_org_sales_goals");
    await copyTable(client, "leadgrid_outreach_templates");
    await copyTable(client, "leadgrid_workflows");
    await copyTable(client, "leadgrid_workflow_executions");
    await copyTable(client, "leadgrid_workflow_resume_jobs");
    await copyTable(client, "leadgrid_proposals");
    await copyTable(client, "leadgrid_proposal_views");
    await copyTable(client, "leadgrid_email_branding_config");
    await copyTable(client, "leadgrid_academy_courses");
    await copyTable(client, "leadgrid_academy_chapters");
    await copyTable(client, "leadgrid_academy_progress");
    await copyTable(client, "leadgrid_verification_templates");
    await copyTable(client, "leadgrid_momentum_snapshots");
    await copyTable(client, "organization_member_industries");
    await copyTable(client, "leadgrid_vehicles");

    const checks = mode === "plan" ? null : await postChecks(client);
    if (mode === "apply") await client.query("COMMIT");
    else if (mode === "validate") await client.query("ROLLBACK");

    console.log(
      JSON.stringify(
        {
          mode,
          sourceDatabase: sourceInfo.rows[0].db,
          targetDatabase: targetInfo.rows[0].db,
          userMappings: userIdMap.size,
          organizationMappings: orgIdMap.size,
          sourceProjects: sourceProjectIds.size,
          tables: Object.fromEntries(stats),
          checks,
          committed: mode === "apply",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (mode !== "plan") await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([source.end(), target.end()]);
  });
