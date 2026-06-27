/**
 * Smoke-tester for HTTP-eksponeringen av agent threads.
 * Vi mocker `pg` Pool og verifiserer at routes:
 *   - mapper response til snake_case-shape iPad forventer
 *   - returnerer 401 uten Bearer-token
 *   - returnerer 400 uten project_id
 *
 * Fullstendig SSE-flyt er ikke testet her — den eier
 * role-room-agent-stream.ts og krever Anthropic-mock.
 */

import { describe, it, expect, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import type { Pool } from "pg";
import { registerRoleRoomAgentThreadsRoutes } from "./role-room-agent-threads-routes";

// Lett mock av pg Pool — registry over hva siste query var.
function makeFakePool(opts: {
  threadsList?: any[];
  threadRow?: any | null;
  messagesList?: any[];
  createdThread?: any | null;
  threadOwnerProjectId?: string | null;
}): Pool {
  let queryCount = 0;
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      queryCount++;
      const s = sql.toLowerCase();
      if (s.includes("insert into role_room_agent_threads")) {
        return { rows: opts.createdThread ? [opts.createdThread] : [], rowCount: 1 };
      }
      if (s.includes("select project_id::text") && s.includes("role_room_agent_threads")) {
        return {
          rows: opts.threadOwnerProjectId
            ? [{ project_id: opts.threadOwnerProjectId }]
            : [],
          rowCount: opts.threadOwnerProjectId ? 1 : 0,
        };
      }
      if (s.includes("from role_room_agent_threads") && s.includes("where") && s.includes("limit 1")) {
        return { rows: opts.threadRow ? [opts.threadRow] : [], rowCount: opts.threadRow ? 1 : 0 };
      }
      if (s.includes("from role_room_agent_threads")) {
        return { rows: opts.threadsList ?? [], rowCount: (opts.threadsList ?? []).length };
      }
      if (s.includes("from role_room_agent_messages")) {
        return { rows: opts.messagesList ?? [], rowCount: (opts.messagesList ?? []).length };
      }
      if (s.includes("update role_room_agent_threads")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;
  (pool as any).queryCount = () => queryCount;
  return pool;
}

function makeApp(pool: Pool, sessions: Map<string, any>): Express {
  const app = express();
  app.use(express.json());
  registerRoleRoomAgentThreadsRoutes({ app, pool, activeSessions: sessions });
  return app;
}

describe("GET /api/role-room/agent/threads", () => {
  let sessions: Map<string, { userId: string; role?: string }>;

  beforeEach(() => {
    sessions = new Map();
    sessions.set("tok-1", { userId: "user-1", role: "user" });
  });

  it("returnerer 401 uten Bearer-token", async () => {
    const app = makeApp(makeFakePool({}), sessions);
    const res = await request(app).get("/api/role-room/agent/threads?project_id=p1");
    expect(res.status).toBe(401);
  });

  it("returnerer 400 uten project_id", async () => {
    const app = makeApp(makeFakePool({}), sessions);
    const res = await request(app)
      .get("/api/role-room/agent/threads")
      .set("Authorization", "Bearer tok-1");
    expect(res.status).toBe(400);
  });

  it("returnerer threads i snake_case shape", async () => {
    const app = makeApp(makeFakePool({
      threadsList: [{
        id: "th-1",
        project_id: "p1",
        user_id: "user-1",
        title: "Test",
        created_at: new Date("2026-06-27T10:00:00Z"),
        last_active_at: new Date("2026-06-27T10:05:00Z"),
        archived_at: null,
      }],
    }), sessions);
    const res = await request(app)
      .get("/api/role-room/agent/threads?project_id=p1")
      .set("Authorization", "Bearer tok-1");
    expect(res.status).toBe(200);
    expect(res.body.threads).toHaveLength(1);
    const t = res.body.threads[0];
    expect(t.id).toBe("th-1");
    expect(t.project_id).toBe("p1");
    expect(t.user_id).toBe("user-1");
    expect(t.title).toBe("Test");
    // iPad parser dette via ISO8601 — verifiser at det er ISO-string.
    expect(typeof t.created_at).toBe("string");
  });
});

describe("POST /api/role-room/agent/threads", () => {
  let sessions: Map<string, { userId: string; role?: string }>;

  beforeEach(() => {
    sessions = new Map();
    sessions.set("tok-1", { userId: "user-1" });
  });

  it("returnerer 400 uten project_id", async () => {
    const app = makeApp(makeFakePool({}), sessions);
    const res = await request(app)
      .post("/api/role-room/agent/threads")
      .set("Authorization", "Bearer tok-1")
      .send({ title: "Test" });
    expect(res.status).toBe(400);
  });

  it("oppretter thread og returnerer 201 + snake_case payload", async () => {
    const app = makeApp(makeFakePool({
      createdThread: {
        id: "th-new",
        project_id: "p1",
        user_id: "user-1",
        title: "Min samtale",
        created_at: new Date("2026-06-27T10:00:00Z"),
        last_active_at: new Date("2026-06-27T10:00:00Z"),
        archived_at: null,
      },
    }), sessions);
    const res = await request(app)
      .post("/api/role-room/agent/threads")
      .set("Authorization", "Bearer tok-1")
      .send({ project_id: "p1", title: "Min samtale" });
    expect(res.status).toBe(201);
    expect(res.body.thread.id).toBe("th-new");
    expect(res.body.thread.project_id).toBe("p1");
    expect(res.body.thread.title).toBe("Min samtale");
  });
});

describe("GET /api/role-room/agent/threads/:id", () => {
  let sessions: Map<string, { userId: string; role?: string }>;

  beforeEach(() => {
    sessions = new Map();
    sessions.set("tok-1", { userId: "user-1" });
  });

  it("returnerer 404 når thread mangler", async () => {
    const app = makeApp(makeFakePool({ threadRow: null }), sessions);
    const res = await request(app)
      .get("/api/role-room/agent/threads/th-x")
      .set("Authorization", "Bearer tok-1");
    expect(res.status).toBe(404);
  });

  it("returnerer thread + messages i snake_case", async () => {
    const app = makeApp(makeFakePool({
      threadRow: {
        id: "th-1",
        project_id: "p1",
        user_id: "user-1",
        title: "Test",
        created_at: new Date("2026-06-27T10:00:00Z"),
        last_active_at: new Date("2026-06-27T10:05:00Z"),
        archived_at: null,
      },
      messagesList: [
        {
          id: "m1",
          thread_id: "th-1",
          role: "user",
          text: "Hallo",
          response: null,
          created_at: new Date("2026-06-27T10:01:00Z"),
        },
        {
          id: "m2",
          thread_id: "th-1",
          role: "assistant",
          text: "Hei!",
          response: { model: "claude" },
          created_at: new Date("2026-06-27T10:02:00Z"),
        },
      ],
    }), sessions);
    const res = await request(app)
      .get("/api/role-room/agent/threads/th-1")
      .set("Authorization", "Bearer tok-1");
    expect(res.status).toBe(200);
    expect(res.body.thread.id).toBe("th-1");
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0].role).toBe("user");
    expect(res.body.messages[1].role).toBe("assistant");
    expect(res.body.messages[0].thread_id).toBe("th-1");
  });
});

describe("DELETE /api/role-room/agent/threads/:id", () => {
  it("returnerer 401 uten Bearer", async () => {
    const sessions = new Map();
    const app = makeApp(makeFakePool({}), sessions);
    const res = await request(app)
      .delete("/api/role-room/agent/threads/th-x");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/role-room/agent/threads/:id/messages", () => {
  let sessions: Map<string, { userId: string; role?: string }>;

  beforeEach(() => {
    sessions = new Map();
    sessions.set("tok-1", { userId: "user-1" });
  });

  it("returnerer 400 uten content", async () => {
    const app = makeApp(makeFakePool({
      threadOwnerProjectId: "p1",
    }), sessions);
    const res = await request(app)
      .post("/api/role-room/agent/threads/th-1/messages")
      .set("Authorization", "Bearer tok-1")
      .send({});
    expect(res.status).toBe(400);
  });

  it("returnerer 404 når thread ikke eies av bruker", async () => {
    const app = makeApp(makeFakePool({
      threadOwnerProjectId: null,
    }), sessions);
    const res = await request(app)
      .post("/api/role-room/agent/threads/th-x/messages")
      .set("Authorization", "Bearer tok-1")
      .send({ content: "Hei" });
    expect(res.status).toBe(404);
  });
});
