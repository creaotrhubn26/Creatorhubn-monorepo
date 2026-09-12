import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../migrations/0557_leadgrid_workflow_scope_forward_repair.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("migration 0557 Leadgrid workflow scope forward repair", () => {
  it("uses the immutable 0541 boundary and keeps a runtime-isolated redacted audit", () => {
    expect(sql).toContain(
      "filename = '0541_leadgrid_workflow_project_scope.sql'",
    );
    expect(sql).toContain("leadgrid_scope_reconciliation_audit");
    expect(sql).toContain("snapshot JSONB NOT NULL");
    expect(sql).toContain("to_jsonb(execution)");
    expect(sql).toContain("to_jsonb(job)");
    expect(sql).toContain("to_jsonb(workflow)");
    expect(sql).toContain("to_jsonb(event)");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("SESSION_USER <> 'creatorhub_runtime_login'");
    expect(sql).toContain(
      "ARRAY['trigger_event', 'context', 'actions_executed', 'error_message']",
    );
    expect(sql).toContain("'metadata', 'ip_address', 'user_agent', 'link_url'");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
    expect(sql).toContain("applied_at AT TIME ZONE 'UTC'");
    expect(sql).not.toContain("current_setting('TIMEZONE')");
    expect(sql).toContain("IN SHARE ROW EXCLUSIVE MODE");
  });

  it("fails closed for ambiguous workflows and lead-bound work", () => {
    expect(sql).toContain("leadgrid_0557_ambiguous_workflows");
    expect(sql).toContain(
      "NULLIF(BTRIM(workflow.trigger_config ->> 'project_id'), '')",
    );
    expect(sql).toContain("SET project_id = NULL");
    expect(sql).toContain("THEN 'cancelled'");
    expect(sql).toContain("'lead_missing_or_cross_project'");
    expect(sql).toContain("'active_workflow_project_ineligible'");
  });

  it("keeps post-cutoff rows and distrusts ambiguous legacy metadata", () => {
    expect(sql).toContain("event.%I <= context.migration_cutoff");
    expect(
      sql.match(/project\.created_at <= context\.migration_cutoff/g),
    ).toHaveLength(3);
    expect(sql).not.toContain("event.metadata ->> 'project_id'");
    expect(sql).toContain("'legacy_multi_project_provenance_ambiguous'");
    for (const table of [
      "leadgrid_email_tracking_events",
      "leadgrid_proposal_views",
      "leadgrid_contract_events",
      "leadgrid_internal_notifications",
      "leadgrid_meetings",
      "leadgrid_phone_calls",
    ]) {
      expect(sql).toContain("('" + table + "'");
    }
  });

  it("enforces exact lead tuples for executions, artifacts and resume jobs", () => {
    expect(sql).toContain("enforce_leadgrid_scoped_artifact_lead()");
    expect(sql).toContain("to_jsonb(NEW) ->> TG_ARGV[0]");
    expect(sql).toContain("related_lead_id UUID");
    expect(sql).toContain("customer.id = related_lead_id");
    expect(sql).toContain(
      "BEFORE INSERT OR UPDATE OF organization_id, project_id, %I",
    );
    expect(sql).toContain("enforce_leadgrid_workflow_execution_lead_scope()");
    expect(sql).toContain(
      "BEFORE INSERT OR UPDATE OF workflow_id, organization_id, project_id, lead_id",
    );
    expect(sql).toContain(
      "new or re-scoped workflow executions require project scope",
    );
    expect(sql).toContain(
      "new or re-scoped workflow resume jobs require project scope",
    );
    expect(sql).toContain(
      "AFTER INSERT OR UPDATE OF workflow_id, organization_id, project_id, lead_id",
    );
    expect(sql).toContain(
      "workflow resume job lead must match organization/project",
    );
    expect(sql).not.toContain("ON UPDATE CASCADE ON DELETE SET NULL");
  });
});
