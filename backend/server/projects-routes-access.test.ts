import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { setupProjectsRoutes } from "./projects-routes";

function buildApp() {
  const captured: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      captured.push({ sql, params });
      if (sql.includes("SELECT 1 WHERE EXISTS")) {
        const owner = params[1] === "owner-user";
        return { rows: owner ? [{ ok: 1 }] : [], rowCount: owner ? 1 : 0 };
      }
      if (sql.includes("SELECT role, permissions")) {
        const member = params[1] === "team-user";
        return {
          rows: member ? [{ role: "viewer", permissions: { canRead: true, canEdit: false } }] : [],
          rowCount: member ? 1 : 0,
        };
      }
      if (sql.includes("SELECT * FROM legacy.projects") && sql.includes("ORDER BY")) {
        return {
          rows: [
            { id: "owned", user_id: "list-user", title: "Eget prosjekt" },
            { id: "shared", user_id: "other-user", title: "Delt prosjekt" },
          ],
          rowCount: 2,
        };
      }
      if (sql.includes("FROM legacy.projects") && sql.includes("LIMIT 1")) {
        return { rows: [{ id: params[0], user_id: "owner-user", title: "Prosjekt", _project_source: "legacy" }], rowCount: 1 };
      }
      if (sql.includes("SELECT id FROM legacy.projects") && params[0] === "project-1") {
        return { rows: [{ id: "project-1" }], rowCount: 1 };
      }
      if (sql.includes("FROM projects p") && sql.includes("LIMIT 1") && params[0] === "public-project") {
        return {
          rows: [{ id: "public-project", user_id: "owner-user", title: "Nytt prosjekt", profession: "music_producer", category: "studio", _project_source: "public" }],
          rowCount: 1,
        };
      }
      if (sql.includes("SELECT workspace_category FROM profession_types")) {
        return { rows: [{ workspace_category: "music" }], rowCount: 1 };
      }
      if (sql.includes("FROM users WHERE id::text")) {
        return { rows: [{ user_id: "owner-user", email: "owner@example.test", first_name: "Ola", last_name: "Eier" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE projects SET")) {
        return { rows: [{ id: "public-project", user_id: "owner-user", title: "Oppdatert", project_type: "album", profession: "music_producer" }], rowCount: 1 };
      }
      if (sql.includes("DELETE FROM projects") && params[0] === "public-project") {
        return { rows: [{ id: "public-project" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  const app = express();
  app.use(express.json());
  const noop = async () => undefined;
  setupProjectsRoutes({
    app,
    pool,
    mapProjectRow: (row: any) => row,
    compatResolveUserId: (req: express.Request) => String(req.headers["x-test-user"] || ""),
    requireUserSession: (req: express.Request, res: express.Response) => {
      const userId = String(req.headers["x-test-user"] || "");
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return null;
      }
      return { userId, email: `${userId}@example.test`, name: userId, role: "user" };
    },
    compatStoreSet: noop,
    buildGalleryShareUrl: (token: string) => token,
    bootstrapCaptureSessionForProject: noop,
    createDriveUploadBatch: noop,
    fetchDriveUploadBatch: noop,
    dbCompatProjectStateKey: (id: string) => id,
    dispatchClientGalleryNotification: noop,
    ensureCompatProjectState: () => ({ collaborators: [], files: [], comments: [], integrations: {}, permissions: {}, compliance: {}, auditTrail: [] }),
    isLocalDevelopmentWorkspaceUserId: () => false,
    listProjectChangeLog: async () => [],
    loadCompatProjectState: async () => ({ collaborators: [], files: [], comments: [], integrations: {}, permissions: {}, compliance: {}, auditTrail: [] }),
    persistCompatProjectState: noop,
    compatProjectStateStore: new Map(),
    PROJECT_FILE_STORAGE_ROOT: "/tmp/creatorhub-project-test",
    PROJECT_FILE_DB_INLINE_MAX_BYTES: 1024,
    projectFileUpload: { single: () => (_req: any, _res: any, next: () => void) => next() },
    db: {},
    recordAnalyticsEvent: () => undefined,
    resolveMeetingNotesProjectContext: async () => null,
    upsertShotListForProject: noop,
  } as any);
  return { app, captured };
}

describe("generic project access routes", () => {
  it("lists both owned and active team projects without applying profession to shared projects", async () => {
    const { app, captured } = buildApp();
    const response = await request(app)
      .get("/api/projects?profession=photographer")
      .set("x-test-user", "list-user");

    expect(response.status).toBe(200);
    expect(response.body.map((p: any) => p.id)).toEqual(["owned", "shared"]);
    const listQuery = captured.find((call) => call.sql.includes("SELECT * FROM legacy.projects") && call.sql.includes("ORDER BY"));
    expect(listQuery?.sql).toContain("OR EXISTS");
    expect(listQuery?.sql).toContain("user_id =");
    expect(listQuery?.params).toEqual(expect.arrayContaining(["list-user", "photographer"]));
  });

  it("requires authentication and hides inaccessible project IDs", async () => {
    const { app, captured } = buildApp();
    expect((await request(app).get("/api/projects/project-1")).status).toBe(401);
    expect((await request(app).get("/api/projects/project-1").set("x-test-user", "intruder")).status).toBe(404);
    expect(captured.some((call) => call.sql.includes("SELECT * FROM legacy.projects") && call.params[0] === "project-1")).toBe(false);
  });

  it("allows an active read-only team member to open the project", async () => {
    const { app } = buildApp();
    const response = await request(app)
      .get("/api/projects/project-1")
      .set("x-test-user", "team-user");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ id: "project-1", title: "Prosjekt" }));
  });

  it("blocks a read-only member from the generic project update route", async () => {
    const { app, captured } = buildApp();
    const response = await request(app)
      .put("/api/projects/project-1")
      .set("x-test-user", "team-user")
      .send({ title: "Ikke tillatt" });
    expect(response.status).toBe(403);
    expect(captured.some((call) => call.sql.includes("UPDATE legacy.projects"))).toBe(false);
  });

  it("bootstraps a public-store project with project category and permissions", async () => {
    const { app } = buildApp();
    const response = await request(app)
      .get("/api/projects/public-project/workspace-bootstrap")
      .set("x-test-user", "owner-user");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      project: expect.objectContaining({ id: "public-project", title: "Nytt prosjekt" }),
      workspaceCategory: "music",
      access: { canRead: true, canEdit: true, isOwner: true },
      owner: expect.objectContaining({ userId: "owner-user", name: "Ola Eier" }),
    }));
  });

  it("updates and deletes public-store projects through the generic contract", async () => {
    const { app, captured } = buildApp();
    const update = await request(app)
      .put("/api/projects/public-project")
      .set("x-test-user", "owner-user")
      .send({ title: "Oppdatert", projectType: "album", eventDate: "2026-10-01" });
    const remove = await request(app)
      .delete("/api/projects/public-project")
      .set("x-test-user", "owner-user");
    expect(update.status).toBe(200);
    expect(remove.status).toBe(200);
    const updateQuery = captured.find((call) => call.sql.includes("UPDATE projects SET"));
    expect(updateQuery?.sql).toContain("project_type");
    expect(updateQuery?.sql).toContain("event_date");
    expect(captured.some((call) => call.sql.includes("DELETE FROM projects"))).toBe(true);
  });

  it("guards legacy compatibility routes with the same read/edit model", async () => {
    const { app } = buildApp();
    expect((await request(app)
      .get("/api/projects/project-1/comments")
      .set("x-test-user", "team-user")).status).toBe(200);
    expect((await request(app)
      .get("/api/projects/project-1/files")
      .set("x-test-user", "team-user")).status).toBe(200);
    expect((await request(app)
      .post("/api/projects/project-1/comments")
      .set("x-test-user", "team-user")
      .send({ content: "Skal ikke lagres" })).status).toBe(403);
    expect((await request(app)
      .get("/api/projects/project-1/comments")
      .set("x-test-user", "intruder")).status).toBe(404);
  });
});
