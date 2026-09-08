import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  LEADGRID_ONBOARDING_SKILLS,
  buildProjectOnboardingPlan,
  commitProjectOnboarding,
  normalizeProjectOnboardingWebsite,
} from "./leadgrid-domain-onboarding-service.js";
import type { BrandProfile } from "./role-room-website-analyzer.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "user-a";
const previewId = "22222222-2222-4222-8222-222222222222";

function profile(overrides: Partial<BrandProfile>): BrandProfile {
  return {
    url: "https://example.no",
    fetchedAt: "2026-09-08T08:00:00.000Z",
    businessName: "Eksempel",
    tagline: "",
    description: "",
    toneOfVoice: "professional",
    usps: [],
    primaryCTA: "",
    colors: {
      primary: "#111111",
      secondary: "#222222",
      accent: "#333333",
      background: "#ffffff",
      text: "#000000",
    },
    fonts: { heading: "Inter", body: "Inter" },
    logoUrl: null,
    faviconUrl: null,
    productCategories: [],
    hasShop: false,
    hasBlog: false,
    socialLinks: [],
    industry: "other",
    targetAudience: "",
    ...overrides,
  };
}

describe("Leadgrid domain onboarding classification", () => {
  it("normalizes a bare public domain and rejects local/internal targets", () => {
    expect(normalizeProjectOnboardingWebsite("  WWW.Dentum.no/ ")).toEqual({
      websiteUrl: "https://www.dentum.no",
      websiteDomain: "dentum.no",
    });
    expect(() => normalizeProjectOnboardingWebsite("http://localhost:3000"))
      .toThrow();
    expect(() => normalizeProjectOnboardingWebsite("http://127.0.0.1"))
      .toThrow();
    expect(() => normalizeProjectOnboardingWebsite("file:///etc/passwd"))
      .toThrow();
  });

  it("turns Dentum into a complete manual Tannhelse Discovery profile", () => {
    const plan = buildProjectOnboardingPlan(
      "https://dentum.no",
      "dentum.no",
      profile({
        url: "https://dentum.no",
        businessName: "Dentum",
        description: "Sammenlign tannleger og finn en tannklinikk i Oslo.",
        targetAudience: "Tannklinikker som vil ha flere pasienter",
      }),
    );

    expect(plan.project_name).toBe("Dentum");
    expect(plan.category).toBe("Tannhelse");
    expect(plan.category_confidence).toBe("high");
    expect(plan.recommended_profiles).toHaveLength(1);
    expect(plan.recommended_profiles[0]).toMatchObject({
      is_default: true,
      approval_mode: "manual",
      auto_discover_enabled: false,
      brief: {
        industry_queries: ["tannklinikk", "tannlege"],
        city: "Oslo",
        target_count: 30,
        minimum_fit_score: 65,
      },
    });
    expect(plan.skills).toHaveLength(6);
    expect(plan.skills.map((skill) => skill.key)).toEqual(
      LEADGRID_ONBOARDING_SKILLS.map((skill) => skill.key),
    );
  });

  it.each([
    {
      domain: "creatorhubn.com",
      brand: profile({
        businessName: "CreatorHub Norge",
        tagline: "Plattform for skapere, team og Academy",
      }),
      category: "Kreative tjenester",
      queries: ["fotograf", "videoproduksjon", "produksjonsselskap"],
    },
    {
      domain: "theroleroom.com",
      brand: profile({
        businessName: "The Role Room",
        description: "Castingflyt for produsenter og casting directors.",
      }),
      category: "Film, TV og casting",
      queries: ["produksjonsselskap", "castingbyrå", "reklamebyrå"],
    },
  ])("derives a complete editable profile for $domain", ({ domain, brand, category, queries }) => {
    const plan = buildProjectOnboardingPlan(`https://${domain}`, domain, brand);
    expect(plan.category).toBe(category);
    expect(plan.recommended_profiles[0].brief.industry_queries).toEqual(queries);
    expect(plan.recommended_profiles[0].brief.ideal_customer).toBeTruthy();
    expect(plan.recommended_profiles[0].brief.goal).toBeTruthy();
    expect(plan.recommended_profiles[0].brief.city).toBeTruthy();
    expect(plan.recommended_profiles[0].approval_mode).toBe("manual");
  });
});

describe("Leadgrid domain onboarding transaction", () => {
  it("creates project, brand kit and Discovery profile atomically without leads", async () => {
    const plan = buildProjectOnboardingPlan(
      "https://dentum.no",
      "dentum.no",
      profile({
        url: "https://dentum.no",
        businessName: "Dentum",
        description: "Tannhelse og tannklinikker i Oslo",
      }),
    );
    plan.recommended_profiles[0].places_details_enabled = true;
    let insertedProfile = false;
    let generatedProjectId = "";
    let insertedSourceConfig: Record<string, unknown> | undefined;
    const query = vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return {
          rows: [{
            id: previewId,
            plan,
            expires_at: "2099-01-01T00:00:00.000Z",
            committed_at: null,
            committed_project_id: null,
          }],
        };
      }
      if (sql.includes("LEFT JOIN brand_kits bk")) return { rows: [] };
      if (sql.includes("INSERT INTO leadgrid_projects")) {
        generatedProjectId = String(params[0]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SELECT overrides FROM brand_kits")) return { rows: [] };
      if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
        insertedProfile = true;
        insertedSourceConfig = JSON.parse(String(params[14]));
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return insertedProfile
          ? {
              rows: [{
                id: "33333333-3333-4333-8333-333333333333",
                name: "Tannhelse – Oslo",
                is_default: true,
                version: 1,
                brief: plan.recommended_profiles[0].brief,
                status: "active",
                source_config: {
                  google_places: {
                    enabled: true,
                    mode: "transient_details_only",
                  },
                },
              }],
            }
          : { rows: [] };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return {
          rows: [{
            id: generatedProjectId,
            organization_id: organizationId,
            name: "Dentum",
            description: plan.project_description,
            status: "active",
            lead_count: 0,
            competitor_count: 0,
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as Pool;

    const result = await commitProjectOnboarding(pool, {
      previewId,
      organizationId,
      userId,
    });

    expect(result.project.name).toBe("Dentum");
    expect(result.project.leadCount).toBe(0);
    expect(result.profiles[0].brief.industry_queries).toEqual([
      "tannklinikk",
      "tannlege",
    ]);
    expect(result.reused_project).toBe(false);
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements).toEqual(expect.arrayContaining(["BEGIN", "COMMIT"]));
    expect(statements.some((sql) => sql.includes("INSERT INTO leadgrid_projects"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO brand_kits"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO leadgrid_discovery_profiles"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO crm_customers"))).toBe(false);
    expect(statements.some((sql) => sql.includes("approval_mode"))).toBe(true);
    expect(insertedSourceConfig).toMatchObject({
      brreg_open_data: { enabled: true },
      google_places: { enabled: true, mode: "transient_details_only" },
    });
    expect(result.profiles[0].places_details_enabled).toBe(true);
    expect(release).toHaveBeenCalledOnce();
  });

  it("replays a committed preview without performing another write", async () => {
    const plan = buildProjectOnboardingPlan(
      "https://dentum.no",
      "dentum.no",
      profile({ businessName: "Dentum", description: "tannklinikk Oslo" }),
    );
    const query = vi.fn(async (sqlValue: string) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return {
          rows: [{
            id: previewId,
            plan,
            expires_at: "2026-01-01T00:00:00.000Z",
            committed_at: "2026-09-08T10:00:00.000Z",
            committed_project_id: "dentum-existing",
          }],
        };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return {
          rows: [{
            id: "dentum-existing",
            organization_id: organizationId,
            name: "Dentum",
            description: plan.project_description,
            status: "active",
            lead_count: 0,
            competitor_count: 0,
          }],
        };
      }
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return {
          rows: [{
            id: "33333333-3333-4333-8333-333333333333",
            name: "Tannhelse – Oslo",
            is_default: true,
            version: 1,
            brief: plan.recommended_profiles[0].brief,
            status: "active",
            source_config: {
              google_places: { enabled: false },
            },
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as Pool;

    const result = await commitProjectOnboarding(pool, {
      previewId,
      organizationId,
      userId,
      editedProfiles: plan.recommended_profiles,
    });

    expect(result.replayed).toBe(true);
    expect(result.reused_project).toBe(true);
    expect(result.project.id).toBe("dentum-existing");
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements).toContain("COMMIT");
    expect(
      statements.some((sql) =>
        /^\s*(INSERT|UPDATE)\b/.test(sql) || sql.includes("pg_advisory"),
      ),
    ).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back every write when Discovery profile persistence fails", async () => {
    const plan = buildProjectOnboardingPlan(
      "https://dentum.no",
      "dentum.no",
      profile({ businessName: "Dentum", description: "tannklinikk Oslo" }),
    );
    const query = vi.fn(async (sqlValue: string) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return {
          rows: [{
            id: previewId,
            plan,
            expires_at: "2099-01-01T00:00:00.000Z",
            committed_at: null,
            committed_project_id: null,
          }],
        };
      }
      if (sql.includes("LEFT JOIN brand_kits bk")) return { rows: [] };
      if (sql.includes("SELECT overrides FROM brand_kits")) return { rows: [] };
      if (sql.includes("FROM leadgrid_discovery_profiles")) return { rows: [] };
      if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
        throw new Error("profile insert failed");
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as Pool;

    await expect(commitProjectOnboarding(pool, {
      previewId,
      organizationId,
      userId,
    })).rejects.toThrow("profile insert failed");
    expect(query.mock.calls.map(([sql]) => String(sql))).toContain("ROLLBACK");
    expect(query.mock.calls.map(([sql]) => String(sql))).not.toContain("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
});
