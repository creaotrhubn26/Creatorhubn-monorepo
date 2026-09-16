/**
 * Leadgrid-vertikalen i tråd-rutene: et Leadgrid-prosjekt slipper gjennom
 * POST /threads når casting-sjekken feiler men leadgrid-agent-access gir
 * prosjekt, og klientens `context` når handleAgentStream (tidligere kastet).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type Request } from "express";
import request from "supertest";
import type { Pool } from "pg";

const mocks = vi.hoisted(() => ({
  canAccessRoleRoomProject: vi.fn(),
  resolveLeadgridAgentProject: vi.fn(),
  handleAgentStream: vi.fn(),
}));

vi.mock("./role-room-projects-routes.js", () => ({
  canAccessRoleRoomProject: mocks.canAccessRoleRoomProject,
}));
vi.mock("./leadgrid-agent-access.js", () => ({
  resolveLeadgridAgentProject: mocks.resolveLeadgridAgentProject,
}));
vi.mock("./role-room-agent-stream.js", () => ({
  handleAgentStream: mocks.handleAgentStream,
}));

import { registerRoleRoomAgentThreadsRoutes } from "./role-room-agent-threads-routes";

function makeFakePool(): Pool {
  return {
    query: async (sql: string) => {
      const s = sql.toLowerCase();
      if (s.includes("insert into role_room_agent_threads")) {
        return {
          rows: [{
            id: "th-lg",
            project_id: "leadgrid-abc",
            user_id: "user-1",
            title: null,
            created_at: new Date(),
            last_active_at: new Date(),
            archived_at: null,
          }],
          rowCount: 1,
        };
      }
      if (s.includes("select project_id::text") && s.includes("role_room_agent_threads")) {
        return { rows: [{ project_id: "leadgrid-abc" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;
}

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  const sessions = new Map<string, { userId: string; role?: string }>([
    ["tok-1", { userId: "user-1", role: "user" }],
  ]);
  registerRoleRoomAgentThreadsRoutes({ app, pool: makeFakePool(), activeSessions: sessions });
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.canAccessRoleRoomProject.mockResolvedValue(false);
});

describe("POST /api/role-room/agent/threads (Leadgrid fallback)", () => {
  it("returns 403 when neither casting nor Leadgrid access resolves", async () => {
    mocks.resolveLeadgridAgentProject.mockResolvedValue(null);
    const res = await request(makeApp())
      .post("/api/role-room/agent/threads")
      .set("Authorization", "Bearer tok-1")
      .send({ project_id: "leadgrid-abc" });
    expect(res.status).toBe(403);
    expect(mocks.resolveLeadgridAgentProject).toHaveBeenCalledWith(expect.anything(), {
      projectId: "leadgrid-abc",
      userId: "user-1",
    });
  });

  it("creates the thread when the Leadgrid resolver grants access", async () => {
    mocks.resolveLeadgridAgentProject.mockResolvedValue({
      kind: "leadgrid_sales",
      projectKey: "leadgrid-abc",
      leadgridProjectId: "leadgrid-abc",
      organizationId: "org",
      projectName: "Feltsalg",
      role: "selger",
    });
    const res = await request(makeApp())
      .post("/api/role-room/agent/threads")
      .set("Authorization", "Bearer tok-1")
      .send({ project_id: "leadgrid-abc" });
    expect(res.status).toBe(201);
    expect(res.body.thread.project_id).toBe("leadgrid-abc");
  });

  it("does not consult the Leadgrid resolver when casting access already passes", async () => {
    mocks.canAccessRoleRoomProject.mockResolvedValue(true);
    const res = await request(makeApp())
      .post("/api/role-room/agent/threads")
      .set("Authorization", "Bearer tok-1")
      .send({ project_id: "casting-1" });
    expect(res.status).toBe(201);
    expect(mocks.resolveLeadgridAgentProject).not.toHaveBeenCalled();
  });
});

describe("POST /api/role-room/agent/threads/:id/messages", () => {
  it("passes the client context and surface through to handleAgentStream", async () => {
    let seenBody: Record<string, unknown> | null = null;
    let seenProjectId: string | null = null;
    mocks.handleAgentStream.mockImplementation(async (_pool: Pool, req: Request, res: express.Response) => {
      seenBody = req.body as Record<string, unknown>;
      seenProjectId = req.params.projectId;
      res.status(200).json({ ok: true });
    });
    const res = await request(makeApp())
      .post("/api/role-room/agent/threads/th-lg/messages")
      .set("Authorization", "Bearer tok-1")
      .send({
        content: "Hva haster i dag?",
        surface: "leadgrid_ipad",
        organizationId: "org",
        context: { leads: [{ id: "l1" }] },
      });
    expect(res.status).toBe(200);
    expect(seenProjectId).toBe("leadgrid-abc");
    expect(seenBody).toMatchObject({
      userMessage: "Hva haster i dag?",
      threadId: "th-lg",
      persistThread: true,
      requiredScope: "brief_only",
      surface: "leadgrid_ipad",
      context: { leads: [{ id: "l1" }] },
    });
    expect(seenBody).not.toHaveProperty("organizationId");
  });
});
