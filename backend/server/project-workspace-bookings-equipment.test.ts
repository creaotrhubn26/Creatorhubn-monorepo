import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupProjectWorkspaceRoutes } from "./project-workspace-routes.js";

function createWorkspaceDataflowApp(options: { conflict?: any } = {}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  let meeting: any = null;
  let meetingInsertCount = 0;
  let equipmentAssignment: any = null;

  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    if (sql.includes("SELECT 1 WHERE EXISTS")) {
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }
    if (sql.includes("SELECT user_id::text AS user_id FROM projects")) {
      return { rows: [{ user_id: "owner-user" }], rowCount: 1 };
    }
    if (sql.includes("FROM crm_customers WHERE project_id")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("SELECT COALESCE(title, name) AS title FROM projects")) {
      return { rows: [{ title: "Prosjekt 1" }], rowCount: 1 };
    }
    if (sql.includes("FROM crm_meetings") && sql.includes("WHERE project_id = $1")) {
      return { rows: meeting ? [meeting] : [], rowCount: meeting ? 1 : 0 };
    }
    if (sql.includes("FROM user_equipment AS equipment")) {
      return {
        rows: [{
          id: 7,
          user_id: "owner-user",
          user_type: "photographer",
          category: "Kamera",
          brand: "Canon",
          model: "R5",
          condition: "excellent",
          image_url: null,
          settings: { name: "Canon R5", specifications: { marketValueNok: 32000 } },
          inventory_quantity: 1,
          created_at: "2026-08-31T10:00:00.000Z",
          updated_at: "2026-08-31T10:00:00.000Z",
          assignment_id: equipmentAssignment?.id || null,
          assignment_quantity: equipmentAssignment?.quantity || null,
          assignment_type: equipmentAssignment?.assignment_type || null,
          responsible_member_id: null,
          assignment_notes: null,
          assignment_documents: [],
          assignment_created_at: equipmentAssignment?.created_at || null,
          assignment_updated_at: equipmentAssignment?.updated_at || null,
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("SELECT id, quantity") && sql.includes("FROM user_equipment")) {
      return { rows: [{ id: 7, quantity: 1 }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO project_equipment_assignments")) {
      equipmentAssignment = {
        id: equipmentAssignment?.id || "assignment-1",
        project_id: String(params[0]),
        project_owner_user_id: String(params[1]),
        equipment_id: Number(params[2]),
        quantity: Number(params[3]),
        responsible_member_id: params[4],
        assignment_type: String(params[5]),
        notes: params[6],
        documents: JSON.parse(String(params[7])),
        created_at: "2026-08-31T10:00:00.000Z",
        updated_at: "2026-08-31T10:00:00.000Z",
      };
      return { rows: [equipmentAssignment], rowCount: 1 };
    }
    if (sql.includes("DELETE FROM project_equipment_assignments")) {
      const removed = equipmentAssignment;
      equipmentAssignment = null;
      return { rows: removed ? [{ id: removed.id }] : [], rowCount: removed ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });

  const pool = {
    query,
    connect: vi.fn(async () => ({
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("pg_advisory_xact_lock")) {
          return { rows: [{ locked: true }], rowCount: 1 };
        }
        if (sql.includes("SELECT *") && sql.includes("FROM crm_meetings")) {
          return { rows: meeting ? [meeting] : [], rowCount: meeting ? 1 : 0 };
        }
        if (sql.includes("SELECT id, title, scheduled_at") && sql.includes("FROM crm_meetings")) {
          if (options.conflict) {
            return { rows: [options.conflict], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("INSERT INTO crm_meetings")) {
          meetingInsertCount += 1;
          meeting = {
            id: "meeting-1",
            customer_id: null,
            project_id: String(params[1]),
            title: String(params[2]),
            description: params[3],
            location: params[4],
            meet_link: params[5],
            web_view_url: null,
            scheduled_at: String(params[6]),
            duration_minutes: Number(params[7]),
            owner_user_id: String(params[8]),
            status: "confirmed",
            calendar_sync_status: String(params[9]),
            created_at: "2026-08-31T10:00:00.000Z",
          };
          return { rows: [meeting], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    })),
  };

  const app = express();
  app.use(express.json());
  setupProjectWorkspaceRoutes({
    app,
    pool: pool as any,
    requireUserSession: () => ({
      userId: "owner-user",
      email: "owner@example.test",
      name: "Owner",
      role: "user",
    }),
  });

  return {
    app,
    queries,
    getMeetingInsertCount: () => meetingInsertCount,
    getEquipmentAssignment: () => equipmentAssignment,
  };
}

describe("workspace booking dataflow", () => {
  it("persists project_id without a CRM customer and replays an identical retry", async () => {
    const state = createWorkspaceDataflowApp();
    const body = {
      title: "Konsultasjon",
      scheduledAt: "2026-09-02T10:00:00.000Z",
      durationMinutes: 60,
      location: "Studio",
    };

    const first = await request(state.app)
      .post("/api/projects/project-1/meetings")
      .send(body);
    const replay = await request(state.app)
      .post("/api/projects/project-1/meetings")
      .send(body);
    const list = await request(state.app)
      .get("/api/projects/project-1/avtaler");

    expect(first.status).toBe(201);
    expect(first.body).toEqual(expect.objectContaining({
      id: "meeting-1",
      replayed: false,
    }));
    expect(replay.status).toBe(200);
    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.body).toEqual(expect.objectContaining({
      id: "meeting-1",
      replayed: true,
    }));
    expect(state.getMeetingInsertCount()).toBe(1);
    expect(list.status).toBe(200);
    expect(list.body.meetings).toEqual([
      expect.objectContaining({ id: "meeting-1", status: "confirmed" }),
    ]);

    const insert = state.queries.find(({ sql }) => sql.includes("INSERT INTO crm_meetings"));
    expect(insert?.sql).toContain("project_id");
    expect(insert?.params[0]).toBeNull();
    expect(insert?.params[1]).toBe("project-1");
    const listQuery = state.queries.find(({ sql }) =>
      sql.includes("FROM crm_meetings")
      && sql.includes("project_id IS NULL AND customer_id = $2"));
    expect(listQuery?.params).toEqual(["project-1", null]);
  });

  it("rejects an overlapping owner booking before insert", async () => {
    const state = createWorkspaceDataflowApp({ conflict: {
      id: "meeting-existing",
      title: "Eksisterende møte",
      scheduled_at: "2026-09-02T09:45:00.000Z",
      duration_minutes: 60,
    } });

    const response = await request(state.app)
      .post("/api/projects/project-1/meetings")
      .send({
        title: "Ny booking",
        scheduledAt: "2026-09-02T10:00:00.000Z",
        durationMinutes: 60,
      });

    expect(response.status).toBe(409);
    expect(response.body.conflict).toEqual({
      id: "meeting-existing",
      title: "Eksisterende møte",
      scheduledAt: "2026-09-02T09:45:00.000Z",
      durationMinutes: 60,
    });
    expect(state.getMeetingInsertCount()).toBe(0);
  });

  it("rejects invalid duration and unsafe external links", async () => {
    const state = createWorkspaceDataflowApp();
    const zeroDuration = await request(state.app)
      .post("/api/projects/project-1/meetings")
      .send({ scheduledAt: "2026-09-02T10:00:00.000Z", durationMinutes: 0 });
    const unsafeLink = await request(state.app)
      .post("/api/projects/project-1/meetings")
      .send({
        scheduledAt: "2026-09-02T10:00:00.000Z",
        durationMinutes: 60,
        meetLink: "javascript:alert(1)",
      });

    expect(zeroDuration.status).toBe(400);
    expect(zeroDuration.body.error).toBe("invalid_duration_minutes");
    expect(unsafeLink.status).toBe(400);
    expect(unsafeLink.body.error).toBe("invalid_meet_link");
    expect(state.getMeetingInsertCount()).toBe(0);
  });
});

describe("workspace equipment dataflow", () => {
  it("upserts one project assignment and removes it without duplicating inventory", async () => {
    const state = createWorkspaceDataflowApp();

    const before = await request(state.app)
      .get("/api/projects/project-1/equipment");
    const first = await request(state.app)
      .post("/api/projects/project-1/equipment/assignments")
      .send({ equipmentId: 7, quantity: 1, assignmentType: "primary" });
    const retry = await request(state.app)
      .post("/api/projects/project-1/equipment/assignments")
      .send({ equipmentId: 7, quantity: 1, assignmentType: "primary" });
    const after = await request(state.app)
      .get("/api/projects/project-1/equipment");
    const removed = await request(state.app)
      .delete("/api/projects/project-1/equipment/assignments/7");

    expect(before.status).toBe(200);
    expect(before.body.items[0]).toEqual(expect.objectContaining({
      id: 7,
      assignedToProject: false,
    }));
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(first.body.assignment.id).toBe(retry.body.assignment.id);
    expect(after.body.items).toHaveLength(1);
    expect(after.body.items[0]).toEqual(expect.objectContaining({
      id: 7,
      assignedToProject: true,
    }));
    expect(removed.body).toEqual({ ok: true, removed: true });
    expect(state.getEquipmentAssignment()).toBeNull();

    const upserts = state.queries.filter(({ sql }) =>
      sql.includes("INSERT INTO project_equipment_assignments"));
    expect(upserts).toHaveLength(2);
    expect(upserts.every(({ sql }) =>
      sql.includes("ON CONFLICT (project_id, equipment_id)"))).toBe(true);
    expect(upserts[0].params.slice(0, 3)).toEqual(["project-1", "owner-user", 7]);
  });
});
