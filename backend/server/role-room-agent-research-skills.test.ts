import { describe, expect, it, vi } from "vitest";
import {
  ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS,
  RoleRoomResearchSkillLedger,
  auditRoleRoomResearchDataflow,
  buildRoleRoomResearchSkillFingerprint,
  type RoleRoomResearchSkillRun,
} from "./role-room-agent-research-skills.js";

const upstreamRuns = (): RoleRoomResearchSkillRun[] =>
  ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS.filter(
    (definition) => definition.id !== "audit_research_dataflow",
  ).map((definition) => ({
    id: definition.id,
    version: definition.version,
    status: "ready",
    executionKey: `input:${definition.id}:${definition.version}`,
    startedAt: "2026-09-04T10:00:00.000Z",
    finishedAt: "2026-09-04T10:00:00.100Z",
    durationMs: 100,
    evidenceCount: 1,
    sourceKinds: ["test"],
    limitations: [],
  }));

const validPayload = () => ({
  brregCompany: {
    lookupStatus: "verified",
    organizationNumber: "936564046",
    name: "MEDINNOVA AS",
  },
  companyProfile: {
    companyName: "MedSide",
    websiteUrl: "https://medside.no",
    organizationNumber: "936564046",
    logoUrl: "https://medside.no/logo.svg",
    industry: "Programvare",
    subIndustry: "Klinisk programvare",
    businessModel: "B2B",
    contentCategory: "Produktkommunikasjon",
    productionApproach: "Tillitsdrevet demonstrasjon",
  },
  projectCreationDraft: {
    clientOrganizationNumber: "936 564 046",
  },
  competitorAnalysis: {
    competitors: [
      {
        name: "Talk!t",
        websiteUrl: "https://talkit.no",
        status: "verified",
        evidence: [{ type: "website_product_match" }],
      },
      {
        name: "Journalia",
        websiteUrl: "https://journalia.no",
        status: "likely",
        evidence: [{ type: "website_product_match" }],
      },
    ],
  },
  localPresencePlan: {
    nearbyOpportunities: [
      {
        name: "Oslo Science City",
        radiusKm: 3,
        evidence: [{ type: "same_area" }],
      },
    ],
  },
  planningDraft: {
    brandGuide: {
      colors: [{ hex: "#102A43" }, { hex: "#2CB67D" }],
    },
    contentLogic: {
      industry: "Programvare",
      subIndustry: "Klinisk programvare",
      businessModel: "B2B",
      contentCategory: "Produktkommunikasjon",
      productionApproach: "Tillitsdrevet demonstrasjon",
    },
  },
  storyLogicDraft: {
    contentStoryLogic: {
      industry: "Programvare",
      subIndustry: "Klinisk programvare",
      businessModel: "B2B",
      contentCategory: "Produktkommunikasjon",
      productionApproach: "Tillitsdrevet demonstrasjon",
    },
  },
  merchSuppliers: {
    suppliers: [
      {
        name: "Supplier One",
        organizationNumber: "111111111",
        status: "verified",
        evidence: [{ type: "brreg_nace_match" }],
        websiteConfirmedTechniques: ["screen_print"],
        websiteConfirmedProductCategories: ["apparel"],
      },
      {
        name: "Supplier Two",
        organizationNumber: "222222222",
        status: "likely",
        evidence: [{ type: "google_places_match" }],
        websiteConfirmedTechniques: ["embroidery"],
        websiteConfirmedProductCategories: ["apparel"],
      },
    ],
    recommendations: [
      {
        productId: "tshirt",
        productCategory: "apparel",
        recommendedTechnique: "screen_print",
        supplierMatch: { name: "Supplier One" },
      },
      {
        productId: "hoodie",
        productCategory: "apparel",
        recommendedTechnique: "embroidery",
        supplierMatch: { name: "Supplier Two" },
      },
    ],
  },
});

describe("Role Room research skills", () => {
  it("has six unique versioned skills with valid dependency references", () => {
    const ids = ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS.map(
      (definition) => definition.id,
    );
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    for (const definition of ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS) {
      expect(definition.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(definition.instruction.length).toBeGreaterThan(40);
      expect(definition.dependsOn.every((id) => ids.includes(id))).toBe(true);
    }
  });

  it("builds the same fingerprint for semantically identical key order", () => {
    const left = buildRoleRoomResearchSkillFingerprint({
      websiteUrl: "medside.no",
      nested: { b: 2, a: 1 },
    });
    const right = buildRoleRoomResearchSkillFingerprint({
      nested: { a: 1, b: 2 },
      websiteUrl: "medside.no",
    });
    expect(left).toBe(right);
    expect(
      buildRoleRoomResearchSkillFingerprint({ websiteUrl: "talkit.no" }),
    ).not.toBe(left);
  });

  it("executes each skill only once per ledger", async () => {
    const executor = vi.fn(async () => ({ count: 2 }));
    const ledger = new RoleRoomResearchSkillLedger("input-fingerprint");
    await expect(
      ledger.execute("resolve_company_identity", executor, (value) => ({
        status: "ready",
        evidenceCount: value.count,
        sourceKinds: ["website", "website"],
        limitations: [],
      })),
    ).resolves.toEqual({ count: 2 });
    await expect(
      ledger.execute("resolve_company_identity", executor, () => ({
        status: "ready",
        evidenceCount: 1,
        sourceKinds: [],
        limitations: [],
      })),
    ).rejects.toThrow("duplicate_role_room_research_skill");
    expect(executor).toHaveBeenCalledTimes(1);
    expect(ledger.completedRuns()).toHaveLength(1);
    expect(ledger.completedRuns()[0]?.sourceKinds).toEqual(["website"]);
  });

  it("passes a grounded, unique MedSide dataflow", () => {
    const audit = auditRoleRoomResearchDataflow(validPayload(), upstreamRuns());
    expect(audit.status).toBe("ready");
    expect(audit.checks).toHaveLength(12);
    expect(audit.checks.every((check) => check.passed)).toBe(true);
  });

  it("propagates an upstream skill failure to the final audit status", () => {
    const runs = upstreamRuns();
    runs[0] = { ...runs[0], status: "failed", limitations: ["identity_failed"] };
    const audit = auditRoleRoomResearchDataflow(validPayload(), runs);
    expect(audit.checks.every((check) => check.passed)).toBe(true);
    expect(audit.status).toBe("failed");
    expect(audit.limitations).toContain("identity_failed");
  });

  it("fails closed on self-competition, duplicates and identity drift", () => {
    const payload = validPayload();
    payload.projectCreationDraft.clientOrganizationNumber = "999999999";
    payload.competitorAnalysis.competitors.push({
      name: "MedSide",
      websiteUrl: "https://medside.no/about",
      status: "verified",
      evidence: [{ type: "website_product_match" }],
    });
    payload.planningDraft.brandGuide.colors.push({ hex: "#102A43" });
    payload.merchSuppliers.recommendations.push({
      productId: "tshirt",
      productCategory: "apparel",
      recommendedTechnique: "screen_print",
      supplierMatch: { name: "Supplier One" },
    });
    payload.storyLogicDraft.contentStoryLogic.industry = "";

    const audit = auditRoleRoomResearchDataflow(payload, upstreamRuns());
    expect(audit.status).toBe("failed");
    expect(
      audit.checks.filter((check) => !check.passed).map((check) => check.id),
    ).toEqual(
      expect.arrayContaining([
        "legal_identity_propagated",
        "customer_excluded_from_competitors",
        "brand_assets_consistent",
        "merch_and_suppliers_unique",
        "verified_profile_propagated",
      ]),
    );
  });
});
