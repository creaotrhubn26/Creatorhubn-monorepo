import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { enrichLeadWithBrreg, getStoredEnrichment } from "./lead-brreg-service.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

describe("Lead BRREG persisted project scope", () => {
  it("binds cached enrichment reads to organization/project/lead", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    await getStoredEnrichment({ query } as unknown as Pool, {
      leadId,
      workspaceOwnerUserId: "legacy-owner",
      organizationId,
      projectId,
    });
    expect(String(query.mock.calls[0]?.[0])).toContain("organization_id = $2::uuid AND project_id = $3");
    expect(query.mock.calls[0]?.[1]).toEqual([leadId, organizationId, projectId]);
  });

  it("fails before enrichment when the persisted tuple does not resolve", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    await expect(enrichLeadWithBrreg({ query } as unknown as Pool, {
      leadId,
      workspaceOwnerUserId: "legacy-owner",
      organizationId,
      projectId,
    })).rejects.toThrow("lead_not_found");
    expect(String(query.mock.calls[0]?.[0])).toContain("organization_id = $2::uuid AND project_id = $3");
    expect(query.mock.calls[0]?.[1]).toEqual([leadId, organizationId, projectId]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
