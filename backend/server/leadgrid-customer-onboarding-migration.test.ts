import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../migrations/0543_leadgrid_customer_onboarding_delivery_scope.sql",
    import.meta.url,
  ),
  "utf8",
);
const autoOnboardRoute = readFileSync(
  new URL("./customer-auto-onboard-project-routes.ts", import.meta.url),
  "utf8",
);
const deliveryRoute = readFileSync(
  new URL("./delivery-playbook-project-routes.ts", import.meta.url),
  "utf8",
);
const ipadClient = readFileSync(
  new URL(
    "../../ipad/LeadMapApp/LeadMapApp/Core/APIClient.swift",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid onboarding and delivery persistence contract", () => {
  it("owns project-scoped replay, token and delivery constraints in 0543", () => {
    for (const fragment of [
      "ADD COLUMN IF NOT EXISTS idempotency_key UUID",
      "ADD COLUMN IF NOT EXISTS request_hash CHAR(64)",
      "uq_customer_auto_onboards_project_retry",
      "uq_client_portal_tokens_auto_onboard",
      "uq_project_deliverables_focus_request",
      "uq_client_focus_requests_scope_need",
      "customer_auto_onboards_project_scope_fkey",
      "client_portal_tokens_project_scope_fkey",
      "client_focus_requests_project_scope_fkey",
      "project_deliverables_project_scope_fkey",
      "enforce_leadgrid_customer_artifact_scope",
      "'withdrawn'",
    ]) {
      expect(migration).toContain(fragment);
    }
  });

  it("creates new customers canonically and never creates a casting project", () => {
    expect(autoOnboardRoute).toContain("createLeadFromPin");
    expect(autoOnboardRoute).toContain("loadAccessibleLeadgridProject");
    expect(autoOnboardRoute).toContain("organizationId: audit.organization_id");
    expect(autoOnboardRoute).toContain("projectId: audit.project_id");
    expect(autoOnboardRoute).not.toContain("INSERT INTO casting_projects");
    expect(autoOnboardRoute).not.toContain("INSERT INTO crm_customers");
  });

  it("keeps every delivery mutation inside organization and project scope", () => {
    expect(deliveryRoute).toContain("loadAccessibleLeadgridProject");
    expect(deliveryRoute).toContain("organization_id = $2::uuid");
    expect(deliveryRoute).toContain("project_id = $3");
    expect(deliveryRoute).toContain("pg_advisory_xact_lock");
    expect(deliveryRoute).toContain("delivery.focus_request_id = $3::uuid");
  });

  it("requires project context and a stable retry key from the iPad client", () => {
    const start = ipadClient.indexOf("func autoOnboardCustomer(");
    const end = ipadClient.indexOf("func fetchAutoOnboardStatus(", start);
    const autoOnboardClient = ipadClient.slice(start, end);
    expect(autoOnboardClient).toContain('"project_id": projectId');
    expect(autoOnboardClient).toContain(
      'headers: ["Idempotency-Key": idempotencyKey]',
    );
    expect(ipadClient).toContain("?project_id=\\(encodedProjectId)");
    expect(autoOnboardClient).not.toContain('"organization_id"');
  });
});
