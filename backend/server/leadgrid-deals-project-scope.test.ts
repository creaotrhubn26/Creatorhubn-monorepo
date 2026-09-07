import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  applyStageChange,
  fetchStageHistory,
  getDealForLead,
  updateDealFields,
} from "./leadgrid-deals-service.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-project";
const scope = { organizationId, projectId };
const row = {
  deal_probability: 50,
  deal_probability_overridden: false,
  expected_close_date: "2026-10-01",
  deal_amount: "10000",
  deal_currency: "NOK",
  pipeline_stage: "qualified",
  deal_stage_changed_at: null,
};

describe("Leadgrid deal SQL project scope", () => {
  it("binds deal reads to the authoritative tenant tuple", async () => {
    const query = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ({
      rows: [row],
      rowCount: 1,
    }));
    const pool = { query } as unknown as Pool;

    await getDealForLead(pool, leadId, scope);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("organization_id = $2::uuid");
    expect(sql).toContain("project_id = $3");
    expect(params).toEqual([leadId, organizationId, projectId]);
  });

  it("binds field updates, audit insertion and the final read", async () => {
    const query = vi.fn(async (sql: string, _params?: readonly unknown[]) => {
      if (sql.includes("UPDATE crm_customers")) {
        return { rows: [{ id: leadId }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO crm_deal_stage_history")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [row], rowCount: 1 };
    });
    const pool = { query } as unknown as Pool;

    await updateDealFields(
      pool,
      leadId,
      "seller-a",
      { dealAmount: 12000 },
      scope,
    );

    const updateCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE crm_customers"),
    );
    const auditCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO crm_deal_stage_history"),
    );
    expect(updateCall?.[0]).toContain("organization_id");
    expect(updateCall?.[0]).toContain("project_id");
    expect(updateCall?.[1]).toEqual([12000, leadId, organizationId, projectId]);
    expect(auditCall?.[0]).toContain("c.organization_id = $10::uuid");
    expect(auditCall?.[0]).toContain("c.project_id = $11");
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes("SELECT deal_probability"),
      ),
    ).toHaveLength(2);
  });

  it("binds stage mutation and its history row to the same tuple", async () => {
    const query = vi.fn(async (sql: string, _params?: readonly unknown[]) => {
      if (sql.includes("SELECT pipeline_stage")) {
        return { rows: [row], rowCount: 1 };
      }
      return { rows: [{ id: leadId }], rowCount: 1 };
    });
    const pool = { query } as unknown as Pool;

    await applyStageChange(pool, leadId, "seller-a", "proposal", { scope });

    const updateCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE crm_customers"),
    );
    const historyCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO crm_deal_stage_history"),
    );
    expect(updateCall?.[0]).toContain("organization_id = $5::uuid");
    expect(updateCall?.[0]).toContain("project_id = $6");
    expect(historyCall?.[0]).toContain("c.organization_id = $11::uuid");
    expect(historyCall?.[0]).toContain("c.project_id = $12");
  });

  it("joins stage history through the scoped lead", async () => {
    const query = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ({
      rows: [],
      rowCount: 0,
    }));
    const pool = { query } as unknown as Pool;

    await fetchStageHistory(pool, leadId, 25, scope);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("JOIN crm_customers c ON c.id = h.customer_id");
    expect(sql).toContain("c.organization_id = $3::uuid");
    expect(sql).toContain("c.project_id = $4");
    expect(params).toEqual([leadId, 25, organizationId, projectId]);
  });
});
