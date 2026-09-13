import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { setupAdminNotificationsRoutes } from "./admin-notifications-routes.js";

describe("GET /api/notifications/inbox", () => {
  it("joins notification ids safely across uuid and varchar schema variants", async () => {
    let inboxSql = "";
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT n.*")) {
        inboxSql = sql;
        return {
          rows: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              title: "Produksjonsoppdatering",
              message: "Ny informasjon er tilgjengelig.",
              type: "info",
              priority: "medium",
              target_audience: "all",
              action_payload: {},
              created_at: new Date("2026-09-12T12:00:00Z"),
              updated_at: new Date("2026-09-12T12:00:00Z"),
            },
          ],
        };
      }
      return { rows: [] };
    });
    const app = express();
    setupAdminNotificationsRoutes({
      app,
      pool: { query },
      getPricingUserId: () => "user-1",
    });

    const response = await request(app).get("/api/notifications/inbox");

    expect(response.status).toBe(200);
    expect(response.body.notifications).toHaveLength(1);
    expect(inboxSql).toContain("a.notification_id::text = n.id::text");
  });
});
