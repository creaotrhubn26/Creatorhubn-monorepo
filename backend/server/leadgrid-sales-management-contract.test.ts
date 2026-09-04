import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("Leadgrid sales-management data-flow contract", () => {
  it("keeps every production iPad endpoint aligned with its backend route", () => {
    const client = source("../../ipad/LeadMapApp/LeadMapApp/Core/APIClient+SalesManagement.swift");
    const routes = source("./leadgrid-sales-management-routes.ts");
    for (const path of [
      "/workspace",
      "/commission-config",
      "/prize-catalog",
      "/contests",
      "/approvals",
      "/coaching",
      "/mileage",
      "/awards",
    ]) {
      expect(client).toContain(`/api/leadgrid/sales-management${path}`);
      expect(routes).toContain(`/api/leadgrid/sales-management${path}`);
    }
    expect(client.match(/Idempotency-Key/g)?.length).toBeGreaterThanOrEqual(4);
    expect(routes.match(/Idempotency-Key/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("migrates replay protection, outbox delivery and every historic won index", () => {
    const migration = source("../migrations/0507_leadgrid_sales_management_hardening.sql");
    for (const fragment of [
      "sales_contests_org_idempotency_uq",
      "sales_prize_awards_contest_idempotency_uq",
      "leadgrid_approvals_org_idempotency_uq",
      "leadgrid_mileage_org_idempotency_uq",
      "leadgrid_coaching_org_idempotency_uq",
      "leadgrid_sales_management_outbox",
      "notification_events_source_event_uq",
      "crm_customers_org_assignee_won_idx",
      "crm_customers_org_assignee_status_won_idx",
      "crm_customers_org_assignee_lead_status_won_idx",
      "crm_customer_status_history",
      "won_amount_oere",
      "won_recurring_oere",
      "leadgrid_sales_management_outbox_recovery_idx",
    ]) expect(migration).toContain(fragment);
  });

  it("accepts native camelCase Dørsalg payloads and calculates mileage server-side", () => {
    const dorsalg = source("./leadgrid-dorsalg-routes.ts");
    const mileageClient = source("../../ipad/LeadMapApp/LeadMapApp/Core/APIClient+LeadgridMileage.swift");
    const routes = source("./leadgrid-sales-management-routes.ts");

    expect(dorsalg).toContain("key.replace(/_([a-z])/g");
    expect(dorsalg).toContain("req.body = normalize(req.body)");
    expect(mileageClient).toContain('headers: ["Idempotency-Key": idempotencyKey]');
    expect(routes).toContain("const TAX_FREE_MILEAGE_RATE_2026 = 3.50");
    expect(routes).toContain("const amount = Math.round(km * rate * 100) / 100");
    expect(routes).toContain("canManage,");
  });
});
