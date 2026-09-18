import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

const E2E_DATABASE_NAME = "creatorhub_admin_workspace_e2e";
const E2E_SERVER_ADDRESSES = new Set(["127.0.0.1", "::1"]);

// The production CRM table predates these workspace migrations. The isolated
// harness needs only the columns read by Admin Workspace link/calendar feeds;
// it never seeds or exposes the wider CRM model.
const CREATE_E2E_CRM_SUPPORT_SQL = `
  CREATE TABLE IF NOT EXISTS crm_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id VARCHAR NOT NULL,
    company TEXT,
    name TEXT,
    city TEXT,
    lead_category TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'lead',
    lead_status TEXT,
    next_follow_up_at TIMESTAMPTZ,
    agent_config_id UUID,
    archived_at TIMESTAMPTZ,
    draft_status VARCHAR(20),
    last_visit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE crm_customers
    ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR,
    ADD COLUMN IF NOT EXISTS company TEXT,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS lead_category TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'lead',
    ADD COLUMN IF NOT EXISTS lead_status TEXT,
    ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS agent_config_id UUID,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS draft_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
`;

// Only top-level mutable tables are listed here. Their tenant-owned child
// rows are removed by CASCADE. Reference templates intentionally survive.
const RESET_E2E_DATA_SQL = `
  TRUNCATE TABLE
    admin_documents,
    admin_workspace_projects,
    admin_workspace_cases,
    admin_workspace_funding_opportunities,
    admin_funding_apps,
    admin_investor_contacts,
    admin_partner_contacts,
    admin_business_plan,
    admin_activity_log,
    role_room_industry_targets,
    crm_customers
  RESTART IDENTITY CASCADE
`;

// This is deliberately not the full production migration tree. The harness
// owns only Admin Workspace and its immediate Admin Room base tables.
export const ADMIN_WORKSPACE_E2E_MIGRATIONS = [
  "136_admin_room.sql",
  "137_admin_room_v2.sql",
  "138_admin_activity_log.sql",
  "163_role_room_industry_targets.sql",
  "0341_admin_workspace_cases.sql",
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
] as const;

export async function ensureAdminWorkspaceE2eSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const identity = await client.query<{
      database_name: string;
      server_address: string | null;
      server_port: number | null;
    }>(
      `SELECT current_database() AS database_name,
              host(inet_server_addr()) AS server_address,
              inet_server_port() AS server_port`,
    );
    const database = identity.rows[0];
    if (
      database?.database_name !== E2E_DATABASE_NAME ||
      !database.server_address ||
      !E2E_SERVER_ADDRESSES.has(database.server_address) ||
      database.server_port !== 5432
    ) {
      throw new Error(
        "Admin Workspace E2E-skjema kan bare klargjores i den dedikerte lokale databasen",
      );
    }
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    for (const migration of ADMIN_WORKSPACE_E2E_MIGRATIONS) {
      const sql = await readFile(path.join(migrationsDir, migration), "utf8");
      await client.query(sql);
    }
    await client.query(CREATE_E2E_CRM_SUPPORT_SQL);
    await client.query(RESET_E2E_DATA_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
