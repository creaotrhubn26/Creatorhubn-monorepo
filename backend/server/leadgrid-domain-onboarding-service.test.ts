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
const customerOrganizationId = "44444444-4444-4444-8444-444444444444";

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
        industry_queries: ["tannlege"],
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

  it("derives a complete editable profile for creatorhubn.com", () => {
    const plan = buildProjectOnboardingPlan(
      "https://creatorhubn.com",
      "creatorhubn.com",
      profile({
        businessName: "CreatorHub Norge",
        tagline: "Plattform for skapere, team og Academy",
      }),
    );
    expect(plan.category).toBe("Kreative tjenester");
    expect(plan.recommended_profiles[0].brief.industry_queries).toEqual([
      "fotograf",
      "videoproduksjon",
      "produksjonsselskap",
    ]);
    expect(plan.recommended_profiles[0].brief.ideal_customer).toBeTruthy();
    expect(plan.recommended_profiles[0].brief.goal).toBeTruthy();
    expect(plan.recommended_profiles[0].brief.city).toBeTruthy();
    expect(plan.recommended_profiles[0].approval_mode).toBe("manual");
  });

  it("repairs misleading static metadata and creates six precise national profiles for The Role Room", () => {
    const plan = buildProjectOnboardingPlan(
      "https://theroleroom.com",
      "theroleroom.com",
      profile({
        url: "https://theroleroom.com",
        businessName: "CreatorHub Norge",
        tagline: "Plattform for skapere, team og Academy",
        description: "CreatorHub samler prosjektstyring og community.",
        logoUrl: "https://creatorhubn.com/creatorhub-wordmark-light.png",
      }),
    );

    expect(plan).toMatchObject({
      project_name: "The Role Room",
      category: "Film, TV, casting og talent",
      category_confidence: "high",
      brand_profile: {
        businessName: "The Role Room",
        logoUrl: "https://theroleroom.com/TheRoleRoom_App_Logo.png",
        industry: "film_tv_and_content_production",
      },
    });
    expect(plan.project_description).toContain("film, TV og innholdsproduksjon");
    expect(plan.recommended_profiles).toHaveLength(6);
    expect(plan.recommended_profiles.map((item) => item.template_key)).toEqual([
      "role_room.production",
      "role_room.agencies",
      "role_room.casting",
      "role_room.education",
      "role_room.dance",
      "role_room.talents",
    ]);
    expect(
      plan.recommended_profiles.every((item) => item.template_version === 1),
    ).toBe(true);
    expect(plan.recommended_profiles.map((item) => item.name)).toEqual([
      "Film- og TV-produksjon – Norge",
      "Reklame- og innholdsbyråer – Norge",
      "Casting- og talentmiljøer – Norge",
      "Film- og medieutdanning – Norge",
      "Dansestudioer og danseskoler – Norge",
      "Skuespillere og talenter – Norge",
    ]);
    expect(plan.recommended_profiles.filter((item) => item.is_default)).toHaveLength(1);
    expect(
      plan.recommended_profiles.every(
        (item) =>
          item.brief.country_code === "NO" &&
          item.brief.city == null &&
          item.approval_mode === "manual" &&
          item.auto_discover_enabled === false,
      ),
    ).toBe(true);
    expect(plan.recommended_profiles[0].brief.industry_queries).toEqual([
      "59.110",
      "59.120",
      "60.200",
    ]);
    expect(plan.recommended_profiles[2].brief).toMatchObject({
      industry_queries: [],
      organization_name_queries: ["casting"],
      qualification_requirement: "required",
      minimum_fit_score: 70,
    });
    expect(plan.recommended_profiles[2].brief.industry_queries).not.toContain(
      "78.100",
    );
    expect(plan.recommended_profiles[2].brief.exclusion_terms).toContain("støping");
    expect(plan.recommended_profiles[3].brief).toMatchObject({
      industry_queries: [],
      organization_name_queries: [
        "filmskule",
        "universitet",
        "høgskole",
        "høyskole",
        "fagskole",
      ],
      target_count: 50,
      minimum_fit_score: 70,
      qualification_requirement: "required",
      qualification_terms: expect.arrayContaining([
        "film",
        "medieproduksjon",
        "scenekunst",
      ]),
      commercial_signals: {
        registered_in_business_register: null,
      },
    });
    expect(plan.recommended_profiles[4].brief).toMatchObject({
      industry_queries: [],
      organization_name_queries: [
        "dansestudio",
        "danseskole",
        "ballettskole",
        "dance studio",
      ],
      commercial_signals: {
        registered_in_business_register: null,
      },
    });
    expect(plan.recommended_profiles[5].brief).toMatchObject({
      industry_queries: [],
      organization_name_queries: ["skuespiller", "actor"],
      subject_kind: "person",
      qualification_requirement: "required",
      commercial_signals: {
        registered_in_business_register: null,
      },
    });
  });
});

describe("Leadgrid domain onboarding transaction", () => {
  it("creates an isolated company, customer admin, project team and persisted invitation access", async () => {
    const plan = buildProjectOnboardingPlan(
      "https://dentum.no",
      "dentum.no",
      profile({ businessName: "Dentum", description: "tannklinikk Oslo" }),
    );
    let generatedProjectId = "";
    let insertedProfile = false;
    const query = vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return { rows: [{
          id: previewId,
          plan,
          expires_at: "2099-01-01T00:00:00.000Z",
          committed_at: null,
          committed_organization_id: null,
          committed_project_id: null,
        }] };
      }
      if (sql.includes("FROM organizations") && sql.includes("customer_domain")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO organizations")) {
        return { rows: [{ id: customerOrganizationId, name: "Dentum" }], rowCount: 1 };
      }
      if (sql.includes("LEFT JOIN brand_kits bk")) return { rows: [] };
      if (sql.includes("INSERT INTO leadgrid_projects")) {
        generatedProjectId = String(params[0]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SELECT overrides FROM brand_kits")) return { rows: [] };
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return insertedProfile ? { rows: [{
          id: "33333333-3333-4333-8333-333333333333",
          name: "Tannhelse – Oslo",
          is_default: true,
          version: 1,
          brief: plan.recommended_profiles[0].brief,
          status: "active",
          source_config: { google_places: { enabled: false } },
        }] } : { rows: [] };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
        insertedProfile = true;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM leadgrid_sales_teams") && sql.includes("LOWER(name)")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO leadgrid_sales_teams")) {
        return { rows: [{ id: "dentum-team", name: "Dentum salg" }], rowCount: 1 };
      }
      if (sql.includes("SELECT id FROM users")) {
        return String(params[0]) === "daniel@creatorhubn.com"
          ? { rows: [{ id: "daniel-user" }] }
          : { rows: [] };
      }
      if (sql.includes("FROM leadgrid_project_invitations") && sql.includes("LOWER(email)")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO leadgrid_project_invitations")) {
        return { rows: [{ id: "55555555-5555-4555-8555-555555555555" }], rowCount: 1 };
      }
      if (sql.includes("SELECT EXISTS") && sql.includes("leadgrid_project_members")) {
        return { rows: [{ allowed: true }] };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return { rows: [{
          id: generatedProjectId,
          organization_id: customerOrganizationId,
          name: "Dentum",
          description: plan.project_description,
          status: "active",
          lead_count: 0,
          competitor_count: 0,
        }] };
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
      accessSetup: {
        organization: { mode: "create", name: "Dentum" },
        administrator_email: "daniel@creatorhubn.com",
        team: { mode: "create", name: "Dentum salg", color_hex: "#A852FC" },
        invitations: [{
          email: "selger@dentum.no",
          project_role: "member",
          team_role: "member",
        }],
      },
    });

    expect(result.project.organizationId).toBe(customerOrganizationId);
    expect(result.access).toMatchObject({
      organization: { id: customerOrganizationId, name: "Dentum", reused: false },
      team: { id: "dentum-team", name: "Dentum salg", reused: false },
      administrator: {
        email: "daniel@creatorhubn.com",
        status: "active",
        organization_role: "admin",
        project_role: "owner",
      },
      invitations: [{
        email: "selger@dentum.no",
        status: "invited",
        project_role: "member",
        team_role: "member",
        email_status: "pending",
      }],
      discovery_access_verified: true,
    });
    expect(result.invitation_dispatches).toHaveLength(1);
    expect(result.invitation_dispatches[0]).toMatchObject({
      email: "selger@dentum.no",
      organizationId: customerOrganizationId,
      projectId: generatedProjectId,
    });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("INSERT INTO leadgrid_project_sales_teams"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO organization_members"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO leadgrid_project_members"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO crm_customers"))).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

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
      if (sql.includes("FROM organizations WHERE id")) {
        return { rows: [{ id: organizationId, name: "Creatorhub AS" }] };
      }
      if (sql.includes("INSERT INTO leadgrid_projects")) {
        generatedProjectId = String(params[0]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SELECT overrides FROM brand_kits")) return { rows: [] };
      if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
        insertedProfile = true;
        insertedSourceConfig = JSON.parse(String(params[16]));
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
    expect(result.profiles[0].brief.industry_queries).toEqual(["tannlege"]);
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

  it("reconciles missing Role Room templates without replacing an edited legacy brief", async () => {
    const plan = buildProjectOnboardingPlan(
      "https://theroleroom.com",
      "theroleroom.com",
      profile({ businessName: "The Role Room" }),
    );
    const projectId = "role-room-project";
    const editedLegacyBrief = {
      ...plan.recommended_profiles[0].brief,
      target_count: 17,
      enrichment_count: 17,
      ideal_customer: "Brukerens egen avgrensning skal bestå.",
    };
    const profiles: Array<Record<string, unknown>> = [{
      id: "33333333-3333-4333-8333-333333333333",
      name: plan.recommended_profiles[0].name,
      is_default: true,
      version: 7,
      brief: editedLegacyBrief,
      status: "active",
      source_config: { google_places: { enabled: false } },
      template_key: null,
      template_version: null,
    }];
    const query = vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return { rows: [{
          id: previewId,
          plan,
          expires_at: "2099-01-01T00:00:00.000Z",
          committed_at: null,
          committed_organization_id: null,
          committed_project_id: null,
        }] };
      }
      if (sql.includes("FROM organizations WHERE id")) {
        return { rows: [{ id: organizationId, name: "Creatorhub AS" }] };
      }
      if (sql.includes("LEFT JOIN brand_kits bk")) {
        return { rows: [{ id: projectId }] };
      }
      if (sql.includes("SELECT overrides FROM brand_kits")) return { rows: [] };
      if (
        sql.includes("UPDATE leadgrid_discovery_profiles") &&
        sql.includes("template_key = COALESCE")
      ) {
        profiles[0].template_key = params[3];
        profiles[0].template_version = params[4];
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
        profiles.push({
          id: `profile-${profiles.length + 1}`,
          name: params[4],
          is_default: params[5],
          version: 1,
          brief: JSON.parse(String(params[13])),
          status: "active",
          source_config: JSON.parse(String(params[16])),
          template_key: params[2],
          template_version: params[3],
        });
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return { rows: profiles };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return { rows: [{
          id: projectId,
          organization_id: organizationId,
          name: "The Role Room",
          description: plan.project_description,
          status: "active",
          lead_count: 0,
          competitor_count: 0,
        }] };
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

    expect(result.reused_project).toBe(true);
    expect(result.profiles).toHaveLength(6);
    expect(result.profiles.map((item) => item.template_key)).toEqual(
      expect.arrayContaining(plan.recommended_profiles.map((item) => item.template_key)),
    );
    expect(result.profiles[0].brief).toMatchObject({
      target_count: 17,
      enrichment_count: 17,
      ideal_customer: "Brukerens egen avgrensning skal bestå.",
    });
    const templateAdoption = query.mock.calls.find(([sql]) =>
      String(sql).includes("template_key = COALESCE"),
    );
    expect(String(templateAdoption?.[0])).not.toContain("brief =");
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO leadgrid_discovery_profiles"),
      ),
    ).toHaveLength(5);
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

  it("reconstructs verified access on replay after a lost commit response", async () => {
    const plan = buildProjectOnboardingPlan(
      "https://dentum.no",
      "dentum.no",
      profile({ businessName: "Dentum", description: "tannklinikk Oslo" }),
    );
    const query = vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return { rows: [{
          id: previewId,
          plan,
          expires_at: "2026-01-01T00:00:00.000Z",
          committed_at: "2026-09-08T10:00:00.000Z",
          committed_organization_id: customerOrganizationId,
          committed_project_id: "dentum-existing",
        }] };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return { rows: [{
          id: "dentum-existing",
          organization_id: customerOrganizationId,
          name: "Dentum",
          description: plan.project_description,
          status: "active",
          lead_count: 0,
          competitor_count: 0,
        }] };
      }
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return { rows: [{
          id: "33333333-3333-4333-8333-333333333333",
          name: "Tannhelse – Oslo",
          is_default: true,
          version: 1,
          brief: plan.recommended_profiles[0].brief,
          status: "active",
          source_config: { google_places: { enabled: false } },
        }] };
      }
      if (sql.includes("AS organization_name")) {
        return { rows: [{
          organization_name: "Dentum",
          metadata: {
            customer_admin_email: "daniel@creatorhubn.com",
            sales_team_id: "dentum-salg",
            onboarding_access_entries: [{
              email: "selger@dentum.no",
              project_role: "member",
              team_role: "member",
            }],
          },
        }] };
      }
      if (sql.includes("FROM leadgrid_project_sales_teams project_team")) {
        return { rows: [{ id: "dentum-salg", name: "Dentum salg" }] };
      }
      if (sql.includes("FROM (SELECT $3::text AS email)")) {
        return params[2] === "daniel@creatorhubn.com"
          ? { rows: [{
              invitation_id: null,
              email_status: null,
              accepted_at: null,
              member_user_id: "daniel-user",
            }] }
          : { rows: [{
              invitation_id: "55555555-5555-4555-8555-555555555555",
              email_status: "sent",
              accepted_at: null,
              member_user_id: null,
            }] };
      }
      if (sql.includes("SELECT EXISTS") && sql.includes("leadgrid_project_members")) {
        return { rows: [{ allowed: true }] };
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

    expect(result.replayed).toBe(true);
    expect(result.invitation_dispatches).toEqual([]);
    expect(result.access).toMatchObject({
      organization: { id: customerOrganizationId, name: "Dentum" },
      team: { id: "dentum-salg", name: "Dentum salg" },
      administrator: { email: "daniel@creatorhubn.com", status: "active" },
      invitations: [{ email: "selger@dentum.no", status: "invited", email_status: "sent" }],
      discovery_access_verified: true,
    });
    expect(query.mock.calls.map(([sql]) => String(sql)).some((sql) =>
      /^\s*(INSERT|UPDATE)\b/.test(sql),
    )).toBe(false);
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
      if (sql.includes("FROM organizations WHERE id")) {
        return { rows: [{ id: organizationId, name: "Creatorhub AS" }] };
      }
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
