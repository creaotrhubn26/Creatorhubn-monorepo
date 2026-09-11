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
    mocks.entitled.mockResolvedValue(true);
    mocks.loadProject.mockResolvedValue({
      id: projectId,
      organizationId,
      name: "Dentum",
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
});
