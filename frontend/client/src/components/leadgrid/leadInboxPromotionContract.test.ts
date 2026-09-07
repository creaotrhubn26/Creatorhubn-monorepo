import { describe, expect, it } from "vitest";
import {
  buildAgencyLeadPromotionBody,
  buildAssignableUsersPath,
  parseAgencyLeadPromotion,
} from "./leadInboxPromotionContract";

const agencyLeadId = "11111111-1111-4111-8111-111111111111";
const crmLeadId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const projectId = "dentum-oslo";

describe("agency inbox promotion contract", () => {
  it("sends only the explicit Leadgrid project in the promotion body", () => {
    expect(buildAgencyLeadPromotionBody(`  ${projectId}  `)).toEqual({ projectId });
    expect(() => buildAgencyLeadPromotionBody(" ")).toThrow(/Velg et gyldig/);
  });

  it("accepts a persisted CRM identity returned for the selected project", () => {
    expect(parseAgencyLeadPromotion({
      ok: true,
      promotion: {
        agencyLeadId,
        crmLeadId,
        organizationId,
        projectId,
        created: true,
      },
    }, { agencyLeadId, projectId })).toEqual({
      agencyLeadId,
      crmLeadId,
      organizationId,
      projectId,
      created: true,
    });
  });

  it("never falls back to the agency lead id for assignment", () => {
    expect(() => parseAgencyLeadPromotion({
      promotion: {
        agencyLeadId,
        crmLeadId: agencyLeadId,
        organizationId,
        projectId,
      },
    }, { agencyLeadId, projectId })).toThrow(/Tildeling er stoppet/);
  });

  it("fails closed when the server returns another project or incomplete scope", () => {
    expect(() => parseAgencyLeadPromotion({
      promotion: {
        agencyLeadId,
        crmLeadId,
        organizationId,
        projectId: "another-project",
      },
    }, { agencyLeadId, projectId })).toThrow(/Tildeling er stoppet/);

    expect(() => parseAgencyLeadPromotion({
      promotion: { agencyLeadId, crmLeadId, projectId },
    }, { agencyLeadId, projectId })).toThrow(/Tildeling er stoppet/);
  });

  it("builds assignable-users scope from CRM lead and project together", () => {
    const path = buildAssignableUsersPath({
      role: "team_leader",
      crmLeadId,
      projectId,
    });
    const url = new URL(path, "https://leadgrid.no");
    expect(url.pathname).toBe("/api/leadgrid/assignable-users");
    expect(url.searchParams.get("leadId")).toBe(crmLeadId);
    expect(url.searchParams.get("projectId")).toBe(projectId);
    expect(url.searchParams.get("leadId")).not.toBe(agencyLeadId);
  });
});
