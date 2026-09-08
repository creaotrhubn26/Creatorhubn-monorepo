import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { registerLeadgridDomainOnboardingRoutes } from "./leadgrid-domain-onboarding-routes.js";
import type { BrandProfile } from "./role-room-website-analyzer.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "user-a";

function dentumProfile(): BrandProfile {
  return {
    url: "https://dentum.no",
    fetchedAt: "2026-09-08T08:00:00.000Z",
    businessName: "Dentum",
    tagline: "Finn riktig tannlege",
    description: "Markedsplass for tannklinikker i Oslo",
    toneOfVoice: "professional",
    usps: ["Flere pasienthenvendelser"],
    primaryCTA: "Kom i gang",
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
    industry: "professional_services",
    targetAudience: "Tannklinikker",
  };
}

function harness(args: {
  pool: Pool;
  analyzer?: (url: string) => Promise<BrandProfile>;
  activeSessions?: Map<string, { userId: string; role?: string }>;
}) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    post(path: string, handler: RequestHandler) {
      routes.set(`POST ${path}`, handler);
    },
  } as unknown as Express;
  registerLeadgridDomainOnboardingRoutes({
    app,
    pool: args.pool,
    activeSessions: args.activeSessions ?? new Map([
      ["token-a", { userId, role: "super_admin" }],
    ]),
    analyzeWebsiteFn: args.analyzer ?? (async () => dentumProfile()),
  });
  return {
    async post(path: string, body: unknown, authenticated = true) {
      const handler = routes.get(`POST ${path}`);
      if (!handler) throw new Error(`Missing route POST ${path}`);
      const req = {
        body,
        headers: authenticated
          ? { authorization: "Bearer token-a" }
          : {},
        get(name: string) {
          return name.toLocaleLowerCase() === "authorization" && authenticated
            ? "Bearer token-a"
            : undefined;
        },
      } as unknown as Request;
      let status = 200;
      let payload: unknown;
      const headers = new Map<string, string>();
      const res = {
        status(value: number) {
          status = value;
          return this;
        },
        json(value: unknown) {
          payload = value;
          return this;
        },
        setHeader(name: string, value: string) {
          headers.set(name, value);
          return this;
        },
      } as unknown as Response;
      await handler(req, res, vi.fn());
      return { status, payload, headers };
    },
  };
}

function permissionPool(globalRole = "super_admin") {
  const query = vi.fn(async (sqlValue: string) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM organization_members")) {
      return { rows: [{ role: "admin" }] };
    }
    if (sql.includes("SELECT key FROM permissions")) {
      return {
        rows: [
          { key: "projects.create" },
          { key: "lead_research.run" },
        ],
      };
    }
    if (sql.includes("SELECT role FROM users")) {
      return { rows: [{ role: globalRole }] };
    }
    if (sql.includes("INSERT INTO leadgrid_project_onboarding_previews")) {
      return {
        rows: [{
          id: "22222222-2222-4222-8222-222222222222",
          organization_id: organizationId,
          created_by: userId,
          plan: {},
          expires_at: "2099-01-01T00:00:00.000Z",
        }],
      };
    }
    return { rows: [] };
  });
  return { query } as unknown as Pool;
}

describe("Leadgrid domain onboarding routes", () => {
  it("previews Dentum as Tannhelse without creating a project or lead", async () => {
    const pool = permissionPool();
    const analyzer = vi.fn(async () => dentumProfile());
    const response = await harness({ pool, analyzer }).post(
      "/api/leadgrid/project-onboarding/preview",
      { organization_id: organizationId, website_url: "dentum.no" },
    );

    expect(response.status).toBe(201);
    expect(response.payload).toMatchObject({
      preview: {
        website_domain: "dentum.no",
        project_name: "Dentum",
        category: "Tannhelse",
        can_manage_multiple_profiles: true,
        recommended_profiles: [{
          approval_mode: "manual",
          brief: { industry_queries: ["tannklinikk", "tannlege"] },
        }],
        skills: expect.arrayContaining([
          expect.objectContaining({ key: "leadgrid_data_quality" }),
          expect.objectContaining({ key: "leadgrid_sync_offline_actions" }),
        ]),
      },
    });
    expect(analyzer).toHaveBeenCalledWith("https://dentum.no");
    const statements = (pool.query as ReturnType<typeof vi.fn>).mock.calls
      .map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("INSERT INTO leadgrid_projects"))).toBe(false);
    expect(statements.some((sql) => sql.includes("INSERT INTO crm_customers"))).toBe(false);
  });

  it("fails closed before analysis when the user is not authenticated", async () => {
    const analyzer = vi.fn(async () => dentumProfile());
    const response = await harness({
      pool: permissionPool(),
      analyzer,
      activeSessions: new Map(),
    }).post(
      "/api/leadgrid/project-onboarding/preview",
      { organization_id: organizationId, website_url: "dentum.no" },
      false,
    );
    expect(response.status).toBe(401);
    expect(analyzer).not.toHaveBeenCalled();
  });

  it("only accepts profile overrides from platform Super Admin", async () => {
    const response = await harness({ pool: permissionPool("member") }).post(
      "/api/leadgrid/project-onboarding/commit",
      {
        organization_id: organizationId,
        preview_id: "22222222-2222-4222-8222-222222222222",
        profiles: [{
          name: "Oslo",
          is_default: true,
          status: "active",
          approval_mode: "manual",
          places_details_enabled: false,
          auto_discover_enabled: false,
          schedule_cron: "0 6 * * *",
          schedule_timezone: "Europe/Oslo",
          brief: {
            industry_queries: ["tannklinikk"],
            exclusion_terms: [],
            city: "Oslo",
            geo: null,
            municipality_numbers: [],
            municipality_names: [],
            target_count: 20,
            enrichment_count: 10,
            minimum_fit_score: 60,
            organization_forms: [],
            employee_count: null,
            organization_structure: "any",
            website_requirement: "any",
            website_quality: { minimum_score: null },
            commercial_signals: {
              registered_in_vat_register: null,
              registered_in_business_register: null,
            },
          },
        }],
      },
    );
    expect(response.status).toBe(403);
    expect(response.payload).toMatchObject({
      error: { code: "multiple_profiles_super_admin_only", field: "profiles" },
    });
  });
});
