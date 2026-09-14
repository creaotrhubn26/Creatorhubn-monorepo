import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  LEADGRID_ONBOARDING_SKILLS,
  buildProjectOnboardingPlan,
  commitProjectOnboarding,
  isUpgradeableCreatorHubGenericProfileV1,
  isUpgradeableTidumMunicipalServicesV1,
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
    expect(() =>
      normalizeProjectOnboardingWebsite("http://localhost:3000"),
    ).toThrow();
    expect(() =>
      normalizeProjectOnboardingWebsite("http://127.0.0.1"),
    ).toThrow();
    expect(() =>
      normalizeProjectOnboardingWebsite("file:///etc/passwd"),
    ).toThrow();
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

  it("repairs Creatorhub metadata and creates four precise national profiles", () => {
    const plan = buildProjectOnboardingPlan(
      "https://creatorhubn.com",
      "creatorhubn.com",
      profile({
        businessName: "CreatorHub Norge",
        tagline: "Plattform for skapere, team og Academy",
      }),
    );
    expect(plan).toMatchObject({
      project_name: "Creatorhub",
      category: "Plattform for kreativt arbeid",
      category_confidence: "high",
      brand_profile: {
        businessName: "Creatorhub",
        tagline: "Plattformen for kreativt arbeid",
        primaryCTA: "Se planer og priser",
        industry: "creative_work_management_platform",
        logoUrl: "https://creatorhubn.com/creatorhub-wordmark-light.png",
        faviconUrl: "https://creatorhubn.com/creatorhub-icon.png",
        hasShop: false,
      },
    });
    expect(plan.recommended_profiles).toHaveLength(4);
    expect(plan.recommended_profiles.map((item) => item.template_key)).toEqual([
      "creatorhub.photographers",
      "creatorhub.video_content",
      "creatorhub.music_audio",
      "creatorhub.creative_agencies",
    ]);
    expect(plan.recommended_profiles.map((item) => item.name)).toEqual([
      "Profesjonelle fotografer – Norge",
      "Video- og innholdsprodusenter – Norge",
      "Musikk- og lydprodusenter – Norge",
      "Kreative byråer og designstudioer – Norge",
    ]);
    expect(
      plan.recommended_profiles.filter((item) => item.is_default),
    ).toHaveLength(1);
    expect(
      plan.recommended_profiles.every(
        (item) =>
          item.template_version === 1 &&
          item.brief.country_code === "NO" &&
          item.brief.city == null &&
          item.brief.subject_kind === "organization" &&
          item.approval_mode === "manual" &&
          item.auto_discover_enabled === false,
      ),
    ).toBe(true);
    expect(plan.recommended_profiles[0].brief).toMatchObject({
      industry_queries: ["74.200"],
      organization_forms: ["ANS", "AS", "DA", "ENK"],
      target_count: 60,
      minimum_fit_score: 70,
      qualification_requirement: "preferred",
    });
    expect(plan.recommended_profiles[1].brief.industry_queries).toEqual([
      "59.110",
      "59.120",
    ]);
    expect(plan.recommended_profiles[2].brief.industry_queries).toEqual([
      "59.200",
    ]);
    expect(plan.recommended_profiles[3].brief).toMatchObject({
      industry_queries: ["73.110", "73.120", "74.120"],
      target_count: 50,
      qualification_requirement: "required",
      website_requirement: "present",
      website_quality: { minimum_score: 40 },
    });
    expect(plan.skills.map((skill) => skill.key)).toEqual(
      LEADGRID_ONBOARDING_SKILLS.map((skill) => skill.key),
    );
  });

  it("only upgrades the untouched generated Creatorhub profile", () => {
    const untouchedBrief = {
      industry_queries: ["fotograf", "videoproduksjon", "produksjonsselskap"],
      organization_name_queries: [],
      exclusion_terms: ["hobbyklubb", "fotobutikk"],
      country_code: null,
      city: "Oslo",
      geo: null,
      territory_code: null,
      municipality_numbers: [],
      municipality_names: [],
      target_count: 30,
      enrichment_count: 15,
      minimum_fit_score: 60,
      ideal_customer:
        "Profesjonell fotograf, videoprodusent eller kreativt produksjonsteam som leverer kundeprosjekter og trenger en samlet arbeidsflyt for salg, produksjon og levering.",
      goal: "Finne kreative virksomheter som kan samle kunde-, prosjekt- og leveranseflyten i én plattform.",
      organization_forms: [],
      employee_count: null,
      organization_structure: "any",
      website_requirement: "any",
      website_quality: { minimum_score: null },
      commercial_signals: {
        registered_in_vat_register: null,
        registered_in_business_register: true,
      },
    };
    expect(
      isUpgradeableCreatorHubGenericProfileV1({
        name: "Kreative tjenester – Oslo",
        template_key: null,
        template_version: null,
        brief: untouchedBrief,
      }),
    ).toBe(true);
    expect(
      isUpgradeableCreatorHubGenericProfileV1({
        name: "Kreative tjenester – Oslo",
        template_key: null,
        template_version: null,
        brief: { ...untouchedBrief, target_count: 17 },
      }),
    ).toBe(false);
    expect(
      isUpgradeableCreatorHubGenericProfileV1({
        name: "Min egen Creatorhub-profil",
        template_key: null,
        template_version: null,
        brief: untouchedBrief,
      }),
    ).toBe(false);
  });

  it("repairs analyzer fallback data and creates four precise national profiles for Tidum", () => {
    const plan = buildProjectOnboardingPlan(
      "https://tidum.no",
      "tidum.no",
      profile({
        url: "https://tidum.no",
        businessName:
          "Tidum – arbeidstidssystem for barn, omsorg og miljøarbeid",
        description:
          "Tidum er et arbeidstidssystem for virksomheter innen barn, omsorg og miljøarbeid.",
        industry: "other",
        targetAudience: "",
        usps: [],
      }),
    );

    expect(plan).toMatchObject({
      project_name: "Tidum",
      category: "Arbeidstid, omsorg og miljøarbeid",
      category_confidence: "high",
      brand_profile: {
        businessName: "Tidum",
        primaryCTA: "Be om tilgang",
        industry: "workforce_management_for_care",
        logoUrl: "https://tidum.no/apple-touch-icon.png",
        faviconUrl: "https://tidum.no/favicon.ico",
      },
    });
    expect(plan.brand_profile.targetAudience).toContain("kommunale tjenester");
    expect(plan.recommended_anbud_profile).toMatchObject({
      template_key: "tidum.procurement",
      template_version: 1,
      cpv_codes: ["48450000", "72212450", "48332000", "48311000", "48311100"],
      requires_admin_confirmation: true,
    });
    expect(plan.recommended_anbud_profile?.cpv_codes).not.toContain("85000000");
    expect(plan.recommended_profiles).toHaveLength(4);
    expect(plan.recommended_profiles.map((item) => item.template_key)).toEqual([
      "tidum.child_welfare",
      "tidum.residential_care",
      "tidum.bpa_field_services",
      "tidum.municipal_services",
    ]);
    expect(plan.recommended_profiles.map((item) => item.name)).toEqual([
      "Barnevern og avlastning – Norge",
      "Bofellesskap og miljøarbeid – Norge",
      "BPA og feltbasert omsorg – Norge",
      "Kommunale tjenestesteder – Norge",
    ]);
    expect(
      plan.recommended_profiles.map((item) => item.template_version),
    ).toEqual([1, 1, 1, 2]);
    expect(
      plan.recommended_profiles.filter((item) => item.is_default),
    ).toHaveLength(1);
    expect(
      plan.recommended_profiles.every(
        (item) =>
          item.brief.country_code === "NO" &&
          item.brief.city == null &&
          item.approval_mode === "manual" &&
          item.auto_discover_enabled === false,
      ),
    ).toBe(true);
    expect(plan.recommended_profiles[0].brief).toMatchObject({
      industry_queries: ["87.104", "87.105", "87.991", "88.991"],
      organization_forms: ["AS", "IKS", "STI"],
      employee_count: { minimum: 5, maximum: null },
      target_count: 60,
      minimum_fit_score: 70,
      qualification_requirement: "preferred",
      commercial_signals: {
        registered_in_business_register: true,
      },
    });
    expect(plan.recommended_profiles[1].brief.industry_queries).toEqual([
      "87.106",
      "87.201",
      "87.202",
      "87.999",
    ]);
    expect(plan.recommended_profiles[2].brief).toMatchObject({
      industry_queries: ["88.104", "88.105", "88.106"],
      target_count: 40,
      organization_forms: ["AS", "IKS", "STI"],
      employee_count: { minimum: 5, maximum: null },
    });
    expect(plan.recommended_profiles[3].brief).toMatchObject({
      industry_queries: [],
      organization_name_queries: [
        "barneverntjeneste",
        "avlastning",
        "bofellesskap",
        "BPA",
        "miljøarbeidertjeneste",
      ],
      exclusion_terms: [
        "barnehage",
        "skole",
        "sykehjem",
        "natur",
        "eiendom",
        "husholdning",
        "administrasjon",
      ],
      organization_forms: ["BEDR"],
      employee_count: null,
      minimum_fit_score: 70,
      commercial_signals: {
        registered_in_business_register: null,
      },
    });
    expect(plan.skills.map((skill) => skill.key)).toEqual(
      LEADGRID_ONBOARDING_SKILLS.map((skill) => skill.key),
    );
  });

  it("repairs MedSide metadata and creates five medical Discovery profiles", () => {
    const plan = buildProjectOnboardingPlan(
      "https://medside.no",
      "medside.no",
      profile({
        url: "https://medside.no",
        businessName: "Ukjent helseprodukt",
        description: "Generisk helse og klinikk",
        industry: "other",
        targetAudience: "",
        logoUrl: "https://storage.googleapis.com/wrong-logo.png",
        hasShop: true,
      }),
    );

    expect(plan).toMatchObject({
      project_name: "MedSide",
      category: "KI-basert klinisk dokumentasjon",
      category_confidence: "high",
      brand_profile: {
        businessName: "MedSide",
        primaryCTA: "Start gratis prøveperiode",
        industry: "ai_clinical_documentation",
        logoUrl: "https://medside.no/medside-logo.svg",
        hasShop: false,
      },
    });
    expect(plan.recommended_profiles.map((item) => item.template_key)).toEqual([
      "medside.gp_offices",
      "medside.medical_specialists",
      "medside.physiotherapy",
      "medside.chiropractic",
      "medside.psychology",
    ]);
    expect(plan.recommended_profiles.map((item) => item.name)).toEqual([
      "Fastlegekontor – Norge",
      "Private spesialistklinikker – Norge",
      "Fysioterapi og ergoterapi – Norge",
      "Kiropraktorer – Norge",
      "Psykolog- og psykoterapitjenester – Norge",
    ]);
    expect(plan.recommended_profiles).toHaveLength(5);
    expect(
      plan.recommended_profiles.filter((item) => item.is_default),
    ).toHaveLength(1);
    expect(
      plan.recommended_profiles.every(
        (item) =>
          item.brief.country_code === "NO" &&
          item.brief.city == null &&
          item.brief.subject_kind === "organization" &&
          item.approval_mode === "manual" &&
          item.auto_discover_enabled === false,
      ),
    ).toBe(true);
    expect(plan.recommended_profiles[0].brief).toMatchObject({
      registry_source: "nhn_flr_public",
      industry_queries: ["86.210"],
      commercial_signals: { registered_in_business_register: null },
      target_count: 60,
      minimum_fit_score: 70,
    });
    expect(plan.recommended_profiles[1].brief.industry_queries).toEqual([
      "86.221",
      "86.222",
    ]);
    expect(plan.recommended_profiles[2].brief.industry_queries).toEqual([
      "86.950",
    ]);
    expect(plan.recommended_profiles[3].brief).toMatchObject({
      organization_name_queries: [
        "kiropraktor",
        "kiropraktikk",
        "kiropraktorklinikk",
      ],
      qualification_requirement: "required",
    });
    expect(plan.recommended_profiles[4].brief.industry_queries).toEqual([
      "86.930",
    ]);
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
    expect(plan.project_description).toContain(
      "film, TV og innholdsproduksjon",
    );
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
    expect(
      plan.recommended_profiles.filter((item) => item.is_default),
    ).toHaveLength(1);
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
    expect(plan.recommended_profiles[2].brief.exclusion_terms).toContain(
      "støping",
    );
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
        return {
          rows: [
            {
              id: previewId,
              plan,
              expires_at: "2099-01-01T00:00:00.000Z",
              committed_at: null,
              committed_organization_id: null,
              committed_project_id: null,
            },
          ],
        };
      }
      if (
        sql.includes("FROM organizations") &&
        sql.includes("customer_domain")
      ) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO organizations")) {
        return {
          rows: [{ id: customerOrganizationId, name: "Dentum" }],
          rowCount: 1,
        };
      }
      if (sql.includes("LEFT JOIN brand_kits bk")) return { rows: [] };
      if (sql.includes("INSERT INTO leadgrid_projects")) {
        generatedProjectId = String(params[0]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SELECT overrides FROM brand_kits")) return { rows: [] };
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return insertedProfile
          ? {
              rows: [
                {
                  id: "33333333-3333-4333-8333-333333333333",
                  name: "Tannhelse – Oslo",
                  is_default: true,
                  version: 1,
                  brief: plan.recommended_profiles[0].brief,
                  status: "active",
                  source_config: { google_places: { enabled: false } },
                },
              ],
            }
          : { rows: [] };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
        insertedProfile = true;
        return { rows: [], rowCount: 1 };
      }
      if (
        sql.includes("FROM leadgrid_sales_teams") &&
        sql.includes("LOWER(name)")
      ) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO leadgrid_sales_teams")) {
        return {
          rows: [{ id: "dentum-team", name: "Dentum salg" }],
          rowCount: 1,
        };
      }
      if (sql.includes("SELECT id FROM users")) {
        return String(params[0]) === "daniel@creatorhubn.com"
          ? { rows: [{ id: "daniel-user" }] }
          : { rows: [] };
      }
      if (
        sql.includes("FROM leadgrid_project_invitations") &&
        sql.includes("LOWER(email)")
      ) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO leadgrid_project_invitations")) {
        return {
          rows: [{ id: "55555555-5555-4555-8555-555555555555" }],
          rowCount: 1,
        };
      }
      if (
        sql.includes("SELECT EXISTS") &&
        sql.includes("leadgrid_project_members")
      ) {
        return { rows: [{ allowed: true }] };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return {
          rows: [
            {
              id: generatedProjectId,
              organization_id: customerOrganizationId,
              name: "Dentum",
              description: plan.project_description,
              status: "active",
              lead_count: 0,
              competitor_count: 0,
            },
          ],
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
      accessSetup: {
        organization: { mode: "create", name: "Dentum" },
        administrator_email: "daniel@creatorhubn.com",
        team: { mode: "create", name: "Dentum salg", color_hex: "#A852FC" },
        invitations: [
          {
            email: "selger@dentum.no",
            project_role: "member",
            team_role: "member",
          },
        ],
      },
    });

    expect(result.project.organizationId).toBe(customerOrganizationId);
    expect(result.access).toMatchObject({
      organization: {
        id: customerOrganizationId,
        name: "Dentum",
        reused: false,
      },
      team: { id: "dentum-team", name: "Dentum salg", reused: false },
      administrator: {
        email: "daniel@creatorhubn.com",
        status: "active",
        organization_role: "admin",
        project_role: "owner",
      },
      invitations: [
        {
          email: "selger@dentum.no",
          status: "invited",
          project_role: "member",
          team_role: "member",
          email_status: "pending",
        },
      ],
      discovery_access_verified: true,
    });
    expect(result.invitation_dispatches).toHaveLength(1);
    expect(result.invitation_dispatches[0]).toMatchObject({
      email: "selger@dentum.no",
      organizationId: customerOrganizationId,
      projectId: generatedProjectId,
    });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(
      statements.some((sql) =>
        sql.includes("INSERT INTO leadgrid_project_sales_teams"),
      ),
    ).toBe(true);
    expect(
      statements.some((sql) =>
        sql.includes("INSERT INTO organization_members"),
      ),
    ).toBe(true);
    expect(
      statements.some((sql) =>
        sql.includes("INSERT INTO leadgrid_project_members"),
      ),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("INSERT INTO crm_customers")),
    ).toBe(false);
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
          rows: [
            {
              id: previewId,
              plan,
              expires_at: "2099-01-01T00:00:00.000Z",
              committed_at: null,
              committed_project_id: null,
            },
          ],
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
              rows: [
                {
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
                },
              ],
            }
          : { rows: [] };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return {
          rows: [
            {
              id: generatedProjectId,
              organization_id: organizationId,
              name: "Dentum",
              description: plan.project_description,
              status: "active",
              lead_count: 0,
              competitor_count: 0,
            },
          ],
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
    expect(
      statements.some((sql) => sql.includes("INSERT INTO leadgrid_projects")),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("INSERT INTO brand_kits")),
    ).toBe(true);
    expect(
      statements.some((sql) =>
        sql.includes("INSERT INTO leadgrid_discovery_profiles"),
      ),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("INSERT INTO crm_customers")),
    ).toBe(false);
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
    const profiles: Array<Record<string, unknown>> = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: plan.recommended_profiles[0].name,
        is_default: true,
        version: 7,
        brief: editedLegacyBrief,
        status: "active",
        source_config: { google_places: { enabled: false } },
        template_key: null,
        template_version: null,
      },
    ];
    const query = vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return {
          rows: [
            {
              id: previewId,
              plan,
              expires_at: "2099-01-01T00:00:00.000Z",
              committed_at: null,
              committed_organization_id: null,
              committed_project_id: null,
            },
          ],
        };
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
        return {
          rows: [
            {
              id: projectId,
              organization_id: organizationId,
              name: "The Role Room",
              description: plan.project_description,
              status: "active",
              lead_count: 0,
              competitor_count: 0,
            },
          ],
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

    expect(result.reused_project).toBe(true);
    expect(result.profiles).toHaveLength(6);
    expect(result.profiles.map((item) => item.template_key)).toEqual(
      expect.arrayContaining(
        plan.recommended_profiles.map((item) => item.template_key),
      ),
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

  it("upgrades an untouched broad Creatorhub profile and adds the remaining templates", async () => {
    const plan = buildProjectOnboardingPlan(
      "https://creatorhubn.com",
      "creatorhubn.com",
      profile({ businessName: "CreatorHub Norge" }),
    );
    const projectId = "creatorhub-existing";
    const legacyBrief = {
      industry_queries: ["fotograf", "videoproduksjon", "produksjonsselskap"],
      organization_name_queries: [],
      exclusion_terms: ["hobbyklubb", "fotobutikk"],
      country_code: null,
      city: "Oslo",
      geo: null,
      territory_code: null,
      municipality_numbers: [],
      municipality_names: [],
      target_count: 30,
      enrichment_count: 15,
      minimum_fit_score: 60,
      ideal_customer:
        "Profesjonell fotograf, videoprodusent eller kreativt produksjonsteam som leverer kundeprosjekter og trenger en samlet arbeidsflyt for salg, produksjon og levering.",
      goal: "Finne kreative virksomheter som kan samle kunde-, prosjekt- og leveranseflyten i én plattform.",
      organization_forms: [],
      employee_count: null,
      organization_structure: "any",
      website_requirement: "any",
      website_quality: { minimum_score: null },
      commercial_signals: {
        registered_in_vat_register: null,
        registered_in_business_register: true,
      },
    };
    const profiles: Array<Record<string, unknown>> = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Kreative tjenester – Oslo",
        is_default: true,
        version: 1,
        brief: legacyBrief,
        status: "active",
        source_config: { google_places: { enabled: false } },
        template_key: null,
        template_version: null,
      },
    ];
    const query = vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return {
          rows: [
            {
              id: previewId,
              plan,
              expires_at: "2099-01-01T00:00:00.000Z",
              committed_at: null,
              committed_organization_id: null,
              committed_project_id: null,
            },
          ],
        };
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
        sql.includes("SET template_key = $4,")
      ) {
        profiles[0] = {
          ...profiles[0],
          name: params[5],
          version: 2,
          brief: JSON.parse(String(params[18])),
          source_config: JSON.parse(String(params[21])),
          template_key: params[3],
          template_version: params[4],
        };
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
        profiles.push({
          id: `creatorhub-profile-${profiles.length + 1}`,
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
        return {
          rows: [
            {
              id: projectId,
              organization_id: organizationId,
              name: "Creatorhub",
              description: plan.project_description,
              status: "active",
              lead_count: 0,
              competitor_count: 0,
            },
          ],
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

    expect(result.reused_project).toBe(true);
    expect(result.profiles).toHaveLength(4);
    expect(result.profiles.map((item) => item.template_key)).toEqual(
      plan.recommended_profiles.map((item) => item.template_key),
    );
    expect(result.profiles[0]).toMatchObject({
      name: "Profesjonelle fotografer – Norge",
      is_default: true,
      template_key: "creatorhub.photographers",
      template_version: 1,
      brief: {
        industry_queries: ["74.200"],
        country_code: "NO",
        city: null,
      },
    });
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO leadgrid_discovery_profiles"),
      ),
    ).toHaveLength(3);
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes("SET template_key = $4,"),
      ),
    ).toHaveLength(1);
  });

  it("upgrades the untouched Tidum municipal template without replacing user-managed profile settings", async () => {
    const plan = buildProjectOnboardingPlan(
      "https://tidum.no",
      "tidum.no",
      profile({ businessName: "Tidum" }),
    );
    const projectId = "tidum-existing";
    const legacyMunicipalBrief = {
      ...plan.recommended_profiles[3].brief,
      organization_name_queries: ["kommune"],
      exclusion_terms: [],
      minimum_fit_score: 65,
      ideal_customer:
        "Norsk kommune med tjenester innen barnevern, avlastning, bofellesskap, BPA eller miljøarbeid og behov for trygg arbeidstidsdokumentasjon.",
      goal: "Finne kommuner der relevante omsorgs- og miljøtjenester kan kvalifiseres videre før kontakt.",
      organization_forms: ["KOMM"],
    };
    const profiles: Array<Record<string, unknown>> =
      plan.recommended_profiles.map((item, index) => ({
        id: `33333333-3333-4333-8333-33333333333${index}`,
        name: item.name,
        is_default: item.is_default,
        version: 1,
        brief: item.brief,
        status: "active",
        source_config: {
          google_places: {
            enabled: index === 3,
            mode: "transient_details_only",
          },
        },
        template_key: item.template_key,
        template_version: item.template_version,
      }));
    profiles[3].name = "Kommunale omsorgstjenester – Norge";
    profiles[3].brief = legacyMunicipalBrief;
    profiles[3].template_version = 1;
    expect(
      isUpgradeableTidumMunicipalServicesV1(
        profiles[3] as {
          name: string;
          template_key: string;
          template_version: number;
          brief: unknown;
        },
      ),
    ).toBe(true);
    expect(
      isUpgradeableTidumMunicipalServicesV1({
        ...(profiles[3] as {
          name: string;
          template_key: string;
          template_version: number;
          brief: Record<string, unknown>;
        }),
        brief: { ...legacyMunicipalBrief, target_count: 17 },
      }),
    ).toBe(false);
    expect(
      isUpgradeableTidumMunicipalServicesV1({
        name: "Kommunale tjenestesteder – Norge",
        template_key: "tidum.municipal_services",
        template_version: 1,
        brief: plan.recommended_profiles[3].brief,
      }),
    ).toBe(true);
    const legacyBriefWithoutNullableFields = { ...legacyMunicipalBrief };
    delete legacyBriefWithoutNullableFields.city;
    delete legacyBriefWithoutNullableFields.geo;
    delete legacyBriefWithoutNullableFields.territory_code;
    expect(
      isUpgradeableTidumMunicipalServicesV1({
        name: "Kommunale omsorgstjenester – Norge",
        template_key: "tidum.municipal_services",
        template_version: 1,
        brief: legacyBriefWithoutNullableFields,
      }),
    ).toBe(true);

    const query = vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return {
          rows: [
            {
              id: previewId,
              plan,
              expires_at: "2099-01-01T00:00:00.000Z",
              committed_at: null,
              committed_organization_id: null,
              committed_project_id: null,
            },
          ],
        };
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
        sql.includes("template_version = $4") &&
        sql.includes("brief = $18::jsonb")
      ) {
        const upgraded = profiles.find((item) => item.id === params[2]);
        if (!upgraded) throw new Error("missing_test_profile");
        upgraded.template_version = params[3];
        upgraded.name = params[4];
        upgraded.version = Number(upgraded.version) + 1;
        upgraded.brief = JSON.parse(String(params[17]));
        return { rows: [], rowCount: 1 };
      }
      if (
        sql.includes("UPDATE leadgrid_discovery_profiles") &&
        sql.includes("template_key = COALESCE")
      ) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return { rows: profiles };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return {
          rows: [
            {
              id: projectId,
              organization_id: organizationId,
              name: "Tidum",
              description: plan.project_description,
              status: "active",
              lead_count: 0,
              competitor_count: 0,
            },
          ],
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

    const municipal = result.profiles.find(
      (item) => item.template_key === "tidum.municipal_services",
    );
    expect(municipal).toMatchObject({
      name: "Kommunale tjenestesteder – Norge",
      template_version: 2,
      version: 2,
      places_details_enabled: true,
      brief: {
        organization_forms: ["BEDR"],
        minimum_fit_score: 70,
      },
    });
    expect(municipal?.brief.organization_name_queries).toEqual([
      "barneverntjeneste",
      "avlastning",
      "bofellesskap",
      "BPA",
      "miljøarbeidertjeneste",
    ]);
    const upgrade = query.mock.calls.find(
      ([sql]) =>
        String(sql).includes("template_version = $4") &&
        String(sql).includes("brief = $18::jsonb"),
    );
    expect(upgrade?.[1]?.[3]).toBe(2);
    expect(String(upgrade?.[0])).toContain("AND version = $25");
    expect(upgrade?.[1]?.[24]).toBe(1);
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
          rows: [
            {
              id: previewId,
              plan,
              expires_at: "2026-01-01T00:00:00.000Z",
              committed_at: "2026-09-08T10:00:00.000Z",
              committed_project_id: "dentum-existing",
            },
          ],
        };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return {
          rows: [
            {
              id: "dentum-existing",
              organization_id: organizationId,
              name: "Dentum",
              description: plan.project_description,
              status: "active",
              lead_count: 0,
              competitor_count: 0,
            },
          ],
        };
      }
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return {
          rows: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: "Tannhelse – Oslo",
              is_default: true,
              version: 1,
              brief: plan.recommended_profiles[0].brief,
              status: "active",
              source_config: {
                google_places: { enabled: false },
              },
            },
          ],
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
      statements.some(
        (sql) =>
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
        return {
          rows: [
            {
              id: previewId,
              plan,
              expires_at: "2026-01-01T00:00:00.000Z",
              committed_at: "2026-09-08T10:00:00.000Z",
              committed_organization_id: customerOrganizationId,
              committed_project_id: "dentum-existing",
            },
          ],
        };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return {
          rows: [
            {
              id: "dentum-existing",
              organization_id: customerOrganizationId,
              name: "Dentum",
              description: plan.project_description,
              status: "active",
              lead_count: 0,
              competitor_count: 0,
            },
          ],
        };
      }
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return {
          rows: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: "Tannhelse – Oslo",
              is_default: true,
              version: 1,
              brief: plan.recommended_profiles[0].brief,
              status: "active",
              source_config: { google_places: { enabled: false } },
            },
          ],
        };
      }
      if (sql.includes("AS organization_name")) {
        return {
          rows: [
            {
              organization_name: "Dentum",
              metadata: {
                customer_admin_email: "daniel@creatorhubn.com",
                sales_team_id: "dentum-salg",
                onboarding_access_entries: [
                  {
                    email: "selger@dentum.no",
                    project_role: "member",
                    team_role: "member",
                  },
                ],
              },
            },
          ],
        };
      }
      if (sql.includes("FROM leadgrid_project_sales_teams project_team")) {
        return { rows: [{ id: "dentum-salg", name: "Dentum salg" }] };
      }
      if (sql.includes("FROM (SELECT $3::text AS email)")) {
        return params[2] === "daniel@creatorhubn.com"
          ? {
              rows: [
                {
                  invitation_id: null,
                  email_status: null,
                  accepted_at: null,
                  member_user_id: "daniel-user",
                },
              ],
            }
          : {
              rows: [
                {
                  invitation_id: "55555555-5555-4555-8555-555555555555",
                  email_status: "sent",
                  accepted_at: null,
                  member_user_id: null,
                },
              ],
            };
      }
      if (
        sql.includes("SELECT EXISTS") &&
        sql.includes("leadgrid_project_members")
      ) {
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
      invitations: [
        { email: "selger@dentum.no", status: "invited", email_status: "sent" },
      ],
      discovery_access_verified: true,
    });
    expect(
      query.mock.calls
        .map(([sql]) => String(sql))
        .some((sql) => /^\s*(INSERT|UPDATE)\b/.test(sql)),
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
          rows: [
            {
              id: previewId,
              plan,
              expires_at: "2099-01-01T00:00:00.000Z",
              committed_at: null,
              committed_project_id: null,
            },
          ],
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

    await expect(
      commitProjectOnboarding(pool, {
        previewId,
        organizationId,
        userId,
      }),
    ).rejects.toThrow("profile insert failed");
    expect(query.mock.calls.map(([sql]) => String(sql))).toContain("ROLLBACK");
    expect(query.mock.calls.map(([sql]) => String(sql))).not.toContain(
      "COMMIT",
    );
    expect(release).toHaveBeenCalledOnce();
  });
});

describe("Leadgrid MedSide legacy Discovery migration", () => {
  const medSideOrganizationId = "d06f6c27-2704-4180-8735-be3696f4f130";
  const medSideProjectId = "medside-9873ba5b2f66";
  const legacyProfileId = "ae0b518b-da58-4fc3-ac23-9c1b610d9a82";

  // Verified read-only in production on 14 September 2026: one machine
  // migrated profile whose brief carries legacy markers the strict wire
  // contract does not define.
  function productionLegacyProfile(): Record<string, unknown> {
    return {
      id: legacyProfileId,
      name: "Standard",
      is_default: true,
      version: 1,
      status: "active",
      source_config: {},
      template_key: null,
      template_version: null,
      brief: {
        geo: null,
        city: "Oslo",
        goal: null,
        target_count: 10,
        migrated_from: "leadgrid_project_discovery_config",
        ideal_customer: null,
        exclusion_terms: [],
        migration_audit: {
          legacy_next_run_at: "2026-09-01T14:30:09.917405+00:00",
          legacy_auto_discover_enabled: true,
        },
        enrichment_count: 10,
        industry_queries: ["legekontor"],
        minimum_fit_score: 50,
      },
    };
  }

  function medSideHarness(profiles: Array<Record<string, unknown>>) {
    const plan = buildProjectOnboardingPlan(
      "https://medside.no",
      "medside.no",
      profile({ url: "https://medside.no", businessName: "MedSide" }),
    );
    let createdProjects = 0;
    const query = vi.fn(async (sqlValue: string, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_project_onboarding_previews")) {
        return {
          rows: [
            {
              id: previewId,
              plan,
              expires_at: "2099-01-01T00:00:00.000Z",
              committed_at: null,
              committed_organization_id: null,
              committed_project_id: null,
            },
          ],
        };
      }
      if (sql.includes("FROM organizations WHERE id")) {
        return { rows: [{ id: medSideOrganizationId, name: "Creatorhub AS" }] };
      }
      // Reuse is resolved through the brand kit source_url, because the
      // production project metadata is empty.
      if (sql.includes("LEFT JOIN brand_kits bk")) {
        return { rows: [{ id: medSideProjectId }] };
      }
      if (sql.includes("INSERT INTO leadgrid_projects")) {
        createdProjects += 1;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SELECT overrides FROM brand_kits")) return { rows: [] };
      if (
        sql.includes("UPDATE leadgrid_discovery_profiles") &&
        sql.includes("SET status = 'archived'")
      ) {
        let archived = 0;
        for (const row of profiles) {
          const brief = row.brief as Record<string, unknown>;
          const industryQueries = Array.isArray(brief.industry_queries)
            ? (brief.industry_queries as string[])
            : [];
          const nameQueries = Array.isArray(brief.organization_name_queries)
            ? (brief.organization_name_queries as string[])
            : [];
          if (
            row.status !== "archived" &&
            row.template_key === null &&
            row.template_version === null &&
            brief.migrated_from === "leadgrid_project_discovery_config" &&
            nameQueries.length === 0 &&
            industryQueries.length === 1 &&
            industryQueries[0]?.trim().toLowerCase() === String(params[3])
          ) {
            row.status = "archived";
            row.is_default = false;
            archived += 1;
          }
        }
        return { rows: [], rowCount: archived };
      }
      if (
        sql.includes("UPDATE leadgrid_discovery_profiles") &&
        sql.includes("SET is_default = TRUE")
      ) {
        const active = profiles.filter((row) => row.status !== "archived");
        if (active.some((row) => row.is_default))
          return { rows: [], rowCount: 0 };
        const preferred =
          active.find(
            (row) => params[2] !== null && row.template_key === params[2],
          ) ?? active[0];
        if (!preferred) return { rows: [], rowCount: 0 };
        preferred.is_default = true;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
        profiles.push({
          id: `medside-profile-${profiles.length + 1}`,
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
        return { rows: profiles.filter((row) => row.status !== "archived") };
      }
      if (sql.includes("SELECT p.id::text") && sql.includes("crm_customers")) {
        return {
          rows: [
            {
              id: medSideProjectId,
              organization_id: medSideOrganizationId,
              name: "MedSide",
              description: plan.project_description,
              status: "active",
              lead_count: 0,
              competitor_count: 0,
            },
          ],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const pool = {
      connect: vi.fn(async () => ({ query, release: vi.fn() })),
    } as unknown as Pool;
    return {
      plan,
      pool,
      query,
      profiles,
      createdProjects: () => createdProjects,
    };
  }

  it("builds five project-scoped MedSide profiles with unique template keys", () => {
    const plan = buildProjectOnboardingPlan(
      "https://medside.no",
      "medside.no",
      profile({ url: "https://medside.no", businessName: "MedSide" }),
    );
    expect(plan.website_domain).toBe("medside.no");
    expect(plan.recommended_profiles.map((item) => item.template_key)).toEqual([
      "medside.gp_offices",
      "medside.medical_specialists",
      "medside.physiotherapy",
      "medside.chiropractic",
      "medside.psychology",
    ]);
    expect(
      new Set(plan.recommended_profiles.map((item) => item.template_key)).size,
    ).toBe(5);
    expect(plan.recommended_profiles[0].brief.registry_source).toBe(
      "nhn_flr_public",
    );
  });

  it("retires the migrated legekontor profile and hands the default to a runnable BRREG profile", async () => {
    const harness = medSideHarness([productionLegacyProfile()]);

    const result = await commitProjectOnboarding(harness.pool, {
      previewId,
      organizationId: medSideOrganizationId,
      userId,
    });

    expect(result.reused_project).toBe(true);
    expect(result.project.id).toBe(medSideProjectId);
    expect(harness.createdProjects()).toBe(0);

    const active = harness.profiles.filter((row) => row.status !== "archived");
    expect(active).toHaveLength(5);
    expect(active.map((row) => row.template_key)).toEqual([
      "medside.gp_offices",
      "medside.medical_specialists",
      "medside.physiotherapy",
      "medside.chiropractic",
      "medside.psychology",
    ]);

    const legacy = harness.profiles.find((row) => row.id === legacyProfileId);
    expect(legacy).toMatchObject({ status: "archived", is_default: false });

    const defaults = active.filter((row) => row.is_default);
    expect(defaults).toHaveLength(1);
    // The Fastlegeregister profile cannot run without Maskinporten, so it must
    // not be the entry point the project opens on.
    expect(defaults[0].template_key).toBe("medside.medical_specialists");
  });

  it("creates nothing new when the same commit is replayed", async () => {
    const harness = medSideHarness([productionLegacyProfile()]);
    await commitProjectOnboarding(harness.pool, {
      previewId,
      organizationId: medSideOrganizationId,
      userId,
    });
    const afterFirst = harness.profiles.map((row) => ({ ...row }));

    const replay = medSideHarness(harness.profiles);
    await commitProjectOnboarding(replay.pool, {
      previewId,
      organizationId: medSideOrganizationId,
      userId,
    });

    expect(
      replay.query.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO leadgrid_discovery_profiles"),
      ),
    ).toHaveLength(0);
    expect(harness.profiles).toHaveLength(afterFirst.length);
    const active = harness.profiles.filter((row) => row.status !== "archived");
    expect(active).toHaveLength(5);
    expect(active.filter((row) => row.is_default)).toHaveLength(1);
    expect(
      harness.profiles.find((row) => row.id === legacyProfileId),
    ).toMatchObject({ status: "archived" });
  });

  it("never archives a user-authored profile that only looks similar", async () => {
    const userAuthored = productionLegacyProfile();
    userAuthored.id = "user-authored-profile";
    userAuthored.name = "Standard";
    (userAuthored.brief as Record<string, unknown>).migrated_from = undefined;
    delete (userAuthored.brief as Record<string, unknown>).migrated_from;
    const harness = medSideHarness([userAuthored]);

    await commitProjectOnboarding(harness.pool, {
      previewId,
      organizationId: medSideOrganizationId,
      userId,
    });

    const kept = harness.profiles.find(
      (row) => row.id === "user-authored-profile",
    );
    expect(kept).toMatchObject({ status: "active" });
    // The user already owns the default; onboarding must not move it.
    expect(kept).toMatchObject({ is_default: true });
    expect(
      harness.profiles.filter(
        (row) => row.status !== "archived" && row.is_default,
      ),
    ).toHaveLength(1);
  });
});
