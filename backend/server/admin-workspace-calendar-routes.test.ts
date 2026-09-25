import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { setupAdminWorkspaceCalendarRoutes } from "./admin-workspace-calendar-routes";

const USER_ID = "admin-user-a";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

function createTestApp(query = vi.fn()) {
  const app = express();
  app.use(express.json());
  const logAdminActivity = vi.fn(async () => undefined);
  setupAdminWorkspaceCalendarRoutes({
    app,
    pool: { query } as unknown as Pool,
    getActiveSessionFromRequest: () => ({ userId: USER_ID, email: "admin@example.com" }),
    requireAdminRoomAccess: () => ({ userId: USER_ID, email: "admin@example.com" }),
    logAdminActivity,
  });
  return { app, query, logAdminActivity };
}

describe("admin workspace calendar routes", () => {
  it("scoper egne kalenderhendelser til bruker, dato og produkt", async () => {
    const { app, query } = createTestApp(
      vi.fn().mockResolvedValue({ rows: [] }),
    );

    const response = await request(app)
      .get("/api/admin-room/workspace/calendar?from=2026-08-01&to=2026-08-31&product=leadgrid&sources=calendar_event")
      .expect(200);

    expect(response.body).toEqual({
      items: [],
      range: { from: "2026-08-01", to: "2026-08-31" },
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("e.user_id = $1");
    expect(query.mock.calls[0][0]).toContain("e.ends_at > $2::date");
    expect(query.mock.calls[0][1]).toEqual([USER_ID, "2026-08-01", "2026-08-31", "leadgrid"]);
  });

  it("avviser kalenderintervall over 370 dager før databasen kalles", async () => {
    const { app, query } = createTestApp();

    const response = await request(app)
      .get("/api/admin-room/workspace/calendar?from=2025-01-01&to=2026-08-31")
      .expect(400);

    expect(response.body.error).toContain("370");
    expect(query).not.toHaveBeenCalled();
  });

  it("avviser ugyldig møte-URL før innsetting", async () => {
    const { app, query } = createTestApp();

    const response = await request(app)
      .post("/api/admin-room/workspace/calendar/events")
      .send({
        title: "Møte",
        startsAt: "2026-08-28T08:00:00.000Z",
        endsAt: "2026-08-28T09:00:00.000Z",
        meetingUrl: "javascript:alert(1)",
      })
      .expect(400);

    expect(response.body.error).toContain("http/https");
    expect(query).not.toHaveBeenCalled();
  });

  it("avviser sluttid som ikke er etter starttid", async () => {
    const { app, query } = createTestApp();

    const response = await request(app)
      .post("/api/admin-room/workspace/calendar/events")
      .send({
        title: "Ugyldig møte",
        startsAt: "2026-08-28T09:00:00.000Z",
        endsAt: "2026-08-28T09:00:00.000Z",
      })
      .expect(400);

    expect(response.body.error).toContain("etter startsAt");
    expect(query).not.toHaveBeenCalled();
  });

  it("avviser prosjekt fra et annet produkt", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ id: PROJECT_ID, title: "Role Room-prosjekt", product_key: "role_room" }],
    });
    const { app } = createTestApp(query);

    const response = await request(app)
      .post("/api/admin-room/workspace/calendar/events")
      .send({
        title: "Leadgrid-møte",
        productKey: "leadgrid",
        projectId: PROJECT_ID,
        startsAt: "2026-08-28T08:00:00.000Z",
        endsAt: "2026-08-28T09:00:00.000Z",
      })
      .expect(400);

    expect(response.body.error).toContain("samme produkt");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([PROJECT_ID, USER_ID]);
  });

  it("returnerer 404 for en annen brukers hendelse ved lesing", async () => {
    const { app, query } = createTestApp(
      vi.fn().mockResolvedValue({ rows: [] }),
    );

    await request(app)
      .get(`/api/admin-room/workspace/calendar/events/${EVENT_ID}`)
      .expect(404);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("e.id = $1 AND e.user_id = $2");
    expect(query.mock.calls[0][1]).toEqual([EVENT_ID, USER_ID]);
  });

  it("returnerer 404 for en annen brukers hendelse ved oppdatering", async () => {
    const { app, query } = createTestApp(
      vi.fn().mockResolvedValue({ rows: [] }),
    );

    await request(app)
      .patch(`/api/admin-room/workspace/calendar/events/${EVENT_ID}`)
      .send({ title: "Forsøk" })
      .expect(404);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("WHERE id = $1 AND user_id = $2");
    expect(query.mock.calls[0][1]).toEqual([EVENT_ID, USER_ID]);
  });
});
