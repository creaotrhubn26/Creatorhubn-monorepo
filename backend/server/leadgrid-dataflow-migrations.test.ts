import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function migration(name: string): string {
  return readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
}

describe("Leadgrid data-flow migrations", () => {
  it("declares the core workspace, collaboration and replay contracts", () => {
    const sql = migration("0498_leadgrid_core_dataflow.sql");
    for (const fragment of [
      "leadgrid_lead_notes",
      "leadgrid_lead_favorites",
      "market_scan_competitors",
      "meeting_duration_minutes",
      "meeting_status",
      "crm_customers_meeting_status_check",
      "outcome_applied_at",
    ]) expect(sql).toContain(fragment);
  });

  it("declares durable, tenant-bound lead files", () => {
    const sql = migration("0499_leadgrid_lead_files.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS leadgrid_lead_files");
    expect(sql).toContain("organization_id UUID NOT NULL");
    expect(sql).toContain("lead_id UUID NOT NULL REFERENCES crm_customers(id)");
  });

  it("moves every active lazy Leadgrid table into an explicit migration", () => {
    const sql = migration("0500_leadgrid_runtime_schema_backfill.sql");
    for (const table of [
      "leadgrid_doffin_watches",
      "leadgrid_anbud_pipeline",
      "leadgrid_canvas_notater",
      "leadgrid_canvas_versjoner",
      "leadgrid_canvas_dokumenter",
      "leadgrid_canvas_bibliotek",
      "leadgrid_mote_logg",
      "leadgrid_oppgaver",
      "leadgrid_mote_maal",
      "leadgrid_oversikt_policy",
      "leadgrid_canvas_policy",
      "leadgrid_rute_planer",
    ]) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    for (const fragment of [
      "lead_id UUID REFERENCES crm_customers(id)",
      "meeting_at TIMESTAMPTZ",
      "uq_mote_logg_request",
    ]) expect(sql).toContain(fragment);
  });

  it("isolates Leadgrid permission overrides from the legacy feature table", () => {
    const sql = migration("0501_leadgrid_permission_overrides.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS leadgrid_user_permission_overrides");
    expect(sql).toContain("organization_id UUID NOT NULL");
    expect(sql).toContain("permission_key VARCHAR(80) NOT NULL");
    expect(sql).toContain("effect VARCHAR(10) NOT NULL");
    expect(sql).not.toContain("ALTER TABLE user_permission_overrides");
  });

  it("database-enforces project scope for notes and favorites", () => {
    const sql = migration("0545_leadgrid_collaboration_project_scope.sql");
    for (const fragment of [
      "leadgrid_lead_notes_project_required_check",
      "leadgrid_lead_notes_lead_scope_fkey",
      "leadgrid_lead_favorites_project_required_check",
      "leadgrid_lead_favorites_lead_scope_fkey",
      "FOREIGN KEY (organization_id, project_id, lead_id)",
      "REFERENCES crm_customers (organization_id, project_id, id)",
    ]) expect(sql).toContain(fragment);
  });

  it("owns the CPV column and pending-project index in a migration", () => {
    const sql = migration("0548_leadgrid_cpv_project_scope.sql");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS cpv_koder TEXT");
    expect(sql).toContain("idx_crm_customers_leadgrid_cpv_pending");
    expect(sql).toContain("project_id IS NOT NULL");
  });

  it("keeps meeting, Quality and Leadbook scope migrations rolling-deploy compatible", () => {
    const meeting = migration("0549_leadgrid_meeting_loop_project_scope.sql");
    const quality = migration("0550_leadgrid_quality_project_scope.sql");
    const leadbook = migration("0551_leadbook_content_project_scope.sql");

    const meetingBackfill = meeting.slice(
      0, meeting.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS uq_mote_logg_project_request"),
    );
    const qualityBackfill = quality.slice(
      0, quality.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_sverif_project_customer"),
    );
    const assertSafeSingletons = (sql: string, expectedCount: number) => {
      const matches = sql.match(
        /FROM leadgrid_projects\s+WHERE organization_id IS NOT NULL\s+GROUP BY organization_id\s+HAVING COUNT\(\*\) = 1\s+AND BOOL_AND\([\s\S]*?project_type IS NULL OR project_type NOT IN/g,
      ) ?? [];
      expect(matches).toHaveLength(expectedCount);
    };
    // Count every historical project so multi-project organizations remain
    // ambiguous, then emit the singleton only when that sole project is an
    // active Leadgrid customer project (never media/archived/deleted).
    assertSafeSingletons(meetingBackfill, 4);
    assertSafeSingletons(qualityBackfill, 2);
    assertSafeSingletons(leadbook, 3);

    expect(meeting).not.toContain("DROP INDEX IF EXISTS uq_mote_logg_request");
    expect(meeting).not.toContain("DROP CONSTRAINT IF EXISTS leadgrid_mote_maal_pkey");
    expect(meeting).not.toContain("leadgrid_mote_logg_project_required_check");
    expect(meeting).not.toContain("leadgrid_oppgaver_project_required_check");
    expect(meeting).not.toContain("leadgrid_mote_maal_project_required_check");
    expect(meeting).toContain("IF NEW.project_id IS NULL THEN");
    expect(meeting).toContain("RETURN NEW;");

    expect(quality).not.toContain("DROP INDEX IF EXISTS uq_lg_sverif_org_customer");
    expect(quality).not.toContain("DROP INDEX IF EXISTS uq_lb_examples_source_verif");
    expect(quality).not.toContain("leadgrid_verification_templates_project_required_check");
    expect(quality).not.toContain("leadgrid_sales_verifications_project_required_check");
    expect(quality).toContain("IF NEW.project_id IS NULL THEN");

    for (const legacyArbiter of [
      "uq_lb_examples_org_creation",
      "uq_lb_feedback_org_action",
      "uq_lb_reply_org_action",
      "uq_lb_examples_source_consent",
    ]) {
      expect(leadbook).not.toContain(`DROP INDEX IF EXISTS ${legacyArbiter}`);
    }
    expect(leadbook).not.toMatch(/ADD CONSTRAINT lb_\w+_project_required_check/);
    expect(leadbook).toContain("IF NEW.project_id IS NULL THEN");
    for (const feature of [
      "'structure'", "'strengthen'", "'objection'",
      "'mote_brief'", "'mote_etterarbeid'", "'canvas_analyse'",
    ]) expect(leadbook).toContain(feature);
    expect(leadbook).toContain("leadbook_scope_reconciliation_audit");

    const deletionIndex = leadbook.slice(
      leadbook.indexOf("CREATE INDEX IF NOT EXISTS idx_lb_examples_project_delete_requested"),
      leadbook.indexOf("CREATE INDEX IF NOT EXISTS idx_lb_feedback_project_example"),
    );
    expect(deletionIndex).toContain("delete_requested_at IS NOT NULL");
    expect(deletionIndex).not.toContain("anonymized_at IS NULL");
  });
});
