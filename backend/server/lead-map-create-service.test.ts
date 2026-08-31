import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { parseLeadCreationBody } from "./lead-map-create-contract.js";
import { createLeadFromPin } from "./lead-map-service.js";

describe("createLeadFromPin", () => {
  it("persisterer hele kontrakten og tenant-scope med parameterisert SQL", async () => {
    const query = vi.fn(async () => ({ rows: [{ id: "lead-1" }], rowCount: 1 }));
    const pool = { query } as unknown as Pool;
    const body = parseLeadCreationBody({
      name: "Nordic Elektro AS",
      company: "Nordic Elektro AS",
      contact_name: "Anders Johansen",
      contact_role: "Daglig leder",
      organization_number: "912345678",
      website_url: "https://nordic.example",
      phone: "+4799999999",
      email: "post@nordic.example",
      industry_label: "Elektro",
      employee_count_estimate: 25,
      annual_revenue_nok_estimate: 10_000_000,
      notes: "Notat",
      lead_temperature: "ready",
      lead_status: "proposal_sent",
      next_follow_up_at: "2026-09-03T10:00:00Z",
      next_action: "Følg opp tilbud",
      latitude: 59.91,
      longitude: 10.75,
      address: "Storgata 12, 0184 Oslo",
      postal_code: "0184",
      city: "Oslo",
      location_confidence: "exact",
      lead_source: "manual_form",
    });

    await expect(createLeadFromPin(pool, {
      ...body,
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      organizationId: "22222222-2222-4222-8222-222222222222",
    })).resolves.toBe("lead-1");

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    for (const column of [
      "contact_name", "contact_role", "website_url", "enrichment_org_nr",
      "lead_category", "employee_count_estimate", "annual_revenue_nok_estimate",
      "notes", "lead_temperature", "lead_status", "pipeline_stage",
      "next_follow_up_at", "next_action", "organization_id",
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).not.toContain("Nordic Elektro AS");
    expect(params).toEqual([
      "Nordic Elektro AS", "Nordic Elektro AS", "Anders Johansen", "Daglig leder",
      "+4799999999", "post@nordic.example", 59.91, 10.75,
      "Storgata 12, 0184 Oslo", "0184", "Oslo", "https://nordic.example",
      "912345678", "Elektro", null, 25, 10_000_000, "Notat", "ready",
      "proposal_sent", "proposal", "2026-09-03T10:00:00.000Z", "Følg opp tilbud",
      "exact", "manual_form", "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222", null,
    ]);
  });
});
