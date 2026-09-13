import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadProject: vi.fn(),
  entitled: vi.fn(),
}));

vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadProject,
}));
vi.mock("./leadgrid-entitlement-guard.js", () => ({
  assertAnyEntitled: mocks.entitled,
  LEADGRID_ANBUD_FEATURE_KEYS: ["leadgridAnbud"],
}));

import { registerLeadgridDoffinRoutes } from "./leadgrid-doffin-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";

function appWith(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  registerLeadgridDoffinRoutes({
    app,
    pool: { query } as never,
    requireUserSession: () => ({ userId: "daniel" }),
  });
  return app;
}

function isSchemaSql(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  return normalized.startsWith("CREATE TABLE") ||
    normalized.startsWith("CREATE INDEX") ||
    normalized.startsWith("CREATE UNIQUE INDEX") ||
    normalized.startsWith("ALTER TABLE");
}

describe("Leadgrid Anbud project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.entitled.mockResolvedValue(true);
    mocks.loadProject.mockResolvedValue({
      id: projectId,
      organizationId,
      name: "Dentum",
      memberRole: "owner",
    });
  });

  it("rejects missing and inaccessible project context before querying data", async () => {
    const query = vi.fn();
    const missing = await request(appWith(query)).get("/api/leadgrid/doffin/watches");

    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe("project_id_required");
    expect(mocks.loadProject).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();

    mocks.loadProject.mockResolvedValueOnce(null);
    const inaccessible = await request(appWith(query))
      .get("/api/leadgrid/doffin/watches")
      .query({ projectId: "creatorhub" });

    expect(inaccessible.status).toBe(404);
    expect(inaccessible.body.error).toBe("project_not_found");
    expect(query).not.toHaveBeenCalled();
  });

  it("reads watches only from the authoritative Dentum project", async () => {
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      if (isSchemaSql(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM leadgrid_doffin_watches")) {
        expect(sql).toContain("organization_id = $1 AND project_id = $2");
        expect(values).toEqual([organizationId, projectId]);
        return {
          rows: [{ id: "watch-1", name: "Tannhelse Oslo", query: {} }],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const response = await request(appWith(query))
      .get("/api/leadgrid/doffin/watches")
      .query({ projectId });

    expect(response.status).toBe(200);
    expect(response.body.watches).toHaveLength(1);
    expect(mocks.loadProject).toHaveBeenCalledWith(
      expect.anything(), projectId, "daniel",
    );
  });

  it("provisions and confirms Tidum's managed watches without duplicates", async () => {
    mocks.loadProject.mockResolvedValue({
      id: "tidum-project",
      organizationId,
      name: "Tidum",
      memberRole: "owner",
    });
    let profileStatus = "draft";
    const profileRow = () => ({
      id: "22222222-2222-4222-8222-222222222222",
      template_key: "tidum.procurement",
      template_version: 1,
      name: "Tidum – arbeidstid, turnus og dokumentasjon",
      description: "Produktprofil",
      status: profileStatus,
      cpv_codes: ["48450000", "72212450", "48332000", "48311000", "48311100"],
      keywords: ["arbeidstid", "turnus"],
      exclusion_terms: ["kjøp av omsorgsplasser"],
      suggested_watches: [
        {
          key: "tidum.time_hr_software",
          name: "Tidum · Arbeidstid og HR-programvare",
          query: { q: null, location: null, cpv: "48450000,72212450" },
        },
      ],
      selected_watch_keys: profileStatus === "active" ? ["tidum.time_hr_software"] : [],
      requires_admin_confirmation: true,
      confirmed_at: profileStatus === "active" ? "2026-09-13T10:00:00.000Z" : null,
    });
    let profileReads = 0;
    const query = vi.fn(async (sqlValue: string, values?: unknown[]) => {
      const sql = String(sqlValue);
      if (isSchemaSql(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM leadgrid_anbud_project_profiles")) {
        profileReads++;
        if (profileReads === 1) return { rows: [], rowCount: 0 };
        return { rows: [profileRow()], rowCount: 1 };
      }
      if (sql.includes("metadata->>'website_domain'")) {
        expect(values).toEqual([organizationId, "tidum-project"]);
        return { rows: [{ website_domain: "tidum.no" }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO leadgrid_anbud_project_profiles")) {
        expect(sql).toContain("'draft'");
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("COUNT(*)::int AS n")) {
        return { rows: [{ n: 0 }], rowCount: 1 };
      }
      if (sql.includes("WITH selected AS")) {
        expect(sql).toContain("ON CONFLICT (organization_id, project_id, template_key)");
        expect(sql).toContain("DELETE FROM leadgrid_doffin_watches");
        expect(sql).toContain("template_key = ANY($6::text[])");
        expect(sql).toContain("selected_watch_keys = $8::jsonb");
        expect(values?.[5]).toEqual(["tidum.time_hr_software"]);
        expect(values?.[6]).toEqual(["tidum.time_hr_software"]);
        expect(values?.[7]).toBe('["tidum.time_hr_software"]');
        profileStatus = "active";
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("template_key = ANY")) {
        return {
          rows: [{
            id: "watch-1",
            name: "Tidum · Arbeidstid og HR-programvare",
            query: { q: null, cpv: "48450000,72212450" },
            template_key: "tidum.time_hr_software",
            template_version: 1,
          }],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const app = appWith(query);

    const draft = await request(app)
      .get("/api/leadgrid/doffin/project-profile")
      .query({ projectId: "tidum-project" });
    expect(draft.status).toBe(200);
    expect(draft.body.profile).toMatchObject({
      template_key: "tidum.procurement",
      status: "draft",
      can_manage: true,
      requires_admin_confirmation: true,
    });

    const confirmed = await request(app)
      .post("/api/leadgrid/doffin/project-profile/confirm")
      .query({ projectId: "tidum-project" })
      .send({ watch_keys: ["tidum.time_hr_software"] });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.profile).toMatchObject({
      status: "active",
      selected_watch_keys: ["tidum.time_hr_software"],
    });
    expect(confirmed.body.watches).toHaveLength(1);
  });

  it("does not let an ordinary project member activate an anbud profile", async () => {
    mocks.loadProject.mockResolvedValue({
      id: "tidum-project",
      organizationId,
      name: "Tidum",
      memberRole: "member",
    });
    const query = vi.fn(async (sqlValue: string) => {
      expect(String(sqlValue)).toContain("AS can_manage");
      return { rows: [{ can_manage: false }], rowCount: 1 };
    });
    const response = await request(appWith(query))
      .post("/api/leadgrid/doffin/project-profile/confirm")
      .query({ projectId: "tidum-project" })
      .send({ watch_keys: ["tidum.time_hr_software"] });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("anbud_profile_admin_required");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("lets an organization admin manage the profile even with a member project role", async () => {
    mocks.loadProject.mockResolvedValue({
      id: "tidum-project",
      organizationId,
      name: "Tidum",
      memberRole: "member",
    });
    const query = vi.fn(async (sqlValue: string) => {
      const sql = String(sqlValue);
      if (isSchemaSql(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM leadgrid_anbud_project_profiles")) {
        return {
          rows: [{
            id: "22222222-2222-4222-8222-222222222222",
            template_key: "tidum.procurement",
            template_version: 1,
            name: "Tidum",
            description: "Produktprofil",
            status: "draft",
            cpv_codes: ["48450000"],
            keywords: [],
            exclusion_terms: [],
            suggested_watches: [],
            selected_watch_keys: [],
            requires_admin_confirmation: true,
            confirmed_at: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("AS can_manage")) {
        return { rows: [{ can_manage: true }], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const response = await request(appWith(query))
      .get("/api/leadgrid/doffin/project-profile")
      .query({ projectId: "tidum-project" });

    expect(response.status).toBe(200);
    expect(response.body.profile.can_manage).toBe(true);
  });

  it("applies Tidum's product CPV and exclusions in the authoritative search", async () => {
    process.env.DOFFIN_API_KEY = "test-doffin-key";
    mocks.loadProject.mockResolvedValue({
      id: "tidum-project",
      organizationId,
      name: "Tidum",
      memberRole: "owner",
    });
    const storedProfile = {
      id: "22222222-2222-4222-8222-222222222222",
      template_key: "tidum.procurement",
      template_version: 1,
      name: "Tidum – arbeidstid, turnus og dokumentasjon",
      description: "Produktprofil",
      status: "active",
      cpv_codes: ["48450000", "72212450", "48332000", "48311000", "48311100"],
      keywords: ["arbeidstid", "turnus"],
      exclusion_terms: ["kjøp av omsorgsplasser"],
      suggested_watches: [],
      selected_watch_keys: [],
      requires_admin_confirmation: true,
      confirmed_at: "2026-09-13T10:00:00.000Z",
    };
    const query = vi.fn(async (sqlValue: string) => {
      const sql = String(sqlValue);
      if (isSchemaSql(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM leadgrid_anbud_project_profiles")) {
        return { rows: [storedProfile], rowCount: 1 };
      }
      if (sql.includes("FROM crm_customers")) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const fetchMock = vi.fn(async (urlValue: string | URL) => {
      const url = new URL(String(urlValue));
      expect(url.searchParams.getAll("cpvCode")).toEqual(storedProfile.cpv_codes);
      expect(url.searchParams.getAll("cpvCode")).not.toContain("85000000");
      return new Response(JSON.stringify({
        numHitsTotal: 2,
        hits: [
          {
            id: "relevant",
            heading: "Nytt arbeidstids- og turnussystem",
            description: "Programvare for planlegging og dokumentasjon.",
            buyer: [{ name: "Oslo kommune", organizationId: "958 935 420" }],
            cpvCodes: ["48450000"],
            status: "ACTIVE",
          },
          {
            id: "excluded",
            heading: "Kjøp av omsorgsplasser",
            description: "Tjenesteleveranse.",
            buyer: [],
            cpvCodes: ["48450000"],
            status: "ACTIVE",
          },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(appWith(query))
      .get("/api/leadgrid/doffin/search")
      .query({ projectId: "tidum-project", projectProfile: "true", status: "ALL" });

    expect(response.status).toBe(200);
    expect(response.body.kunngjoringer).toHaveLength(1);
    expect(response.body.kunngjoringer[0].id).toBe("relevant");
    expect(response.body.total).toBe(1);
    expect(response.body.project_profile).toEqual({
      template_key: "tidum.procurement",
      template_version: 1,
      applied: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
