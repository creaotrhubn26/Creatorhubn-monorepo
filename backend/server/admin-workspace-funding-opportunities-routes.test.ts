import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { setupAdminWorkspaceFundingOpportunityRoutes } from "./admin-workspace-funding-opportunities-routes";

const USER_ID = "admin-user-a";
const OPPORTUNITY_ID = "11111111-1111-4111-8111-111111111111";

function createTestApp(query = vi.fn(), connect?: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  const logAdminActivity = vi.fn(async () => undefined);
  setupAdminWorkspaceFundingOpportunityRoutes({
    app,
    pool: { query, ...(connect ? { connect } : {}) } as unknown as Pool,
    getActiveSessionFromRequest: () => ({ userId: USER_ID, email: "admin@example.com" }),
    requireAdminRoomAccess: () => ({ userId: USER_ID, email: "admin@example.com" }),
    logAdminActivity,
  });
  return { app, query, logAdminActivity };
}

describe("admin workspace funding opportunity routes", () => {
  it("scoper radarlisten til bruker og produktkontekst", async () => {
    const { app, query } = createTestApp(vi.fn().mockResolvedValue({ rows: [] }));

    const response = await request(app)
      .get("/api/admin-room/workspace/funding-opportunities?product=leadgrid")
      .expect(200);

    expect(response.body).toEqual({ items: [] });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("user_id = $1");
    expect(query.mock.calls[0][0]).toContain("product_key IS NULL OR product_key = $2");
    expect(query.mock.calls[0][1]).toEqual([USER_ID, "leadgrid"]);
  });

  it("krever en offisiell http/https-kilde før opprettelse", async () => {
    const { app, query } = createTestApp();

    const response = await request(app)
      .post("/api/admin-room/workspace/funding-opportunities")
      .send({
        provider: "Innovasjon Norge",
        schemeName: "Testordning",
        sourceUrl: "javascript:alert(1)",
      })
      .expect(400);

    expect(response.body.error).toContain("http/https");
    expect(query).not.toHaveBeenCalled();
  });

  it("avviser ugyldig dato før databasen kalles", async () => {
    const { app, query } = createTestApp();

    await request(app)
      .post("/api/admin-room/workspace/funding-opportunities")
      .send({
        provider: "Innovasjon Norge",
        schemeName: "Testordning",
        sourceUrl: "https://www.innovasjonnorge.no/",
        deadline: "2026-02-31",
      })
      .expect(400);

    expect(query).not.toHaveBeenCalled();
  });

  it("avviser ugyldig produkt før et søknadsløp starter", async () => {
    const { app, query } = createTestApp();

    const response = await request(app)
      .post(`/api/admin-room/workspace/funding-opportunities/${OPPORTUNITY_ID}/start-plan`)
      .send({ productKey: "casting_project" })
      .expect(400);

    expect(response.body.error).toContain("productKey");
    expect(query).not.toHaveBeenCalled();
  });

  it("tenant-scoper oppstart av søknadsløp inne i transaksjonen", async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    const connect = vi.fn().mockResolvedValue({ query: clientQuery, release });
    const { app } = createTestApp(vi.fn(), connect);

    await request(app)
      .post(`/api/admin-room/workspace/funding-opportunities/${OPPORTUNITY_ID}/start-plan`)
      .send({ productKey: "leadgrid", targetDate: "2026-09-18" })
      .expect(404);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(clientQuery.mock.calls[0][0]).toBe("BEGIN");
    expect(clientQuery.mock.calls[1][0]).toContain("WHERE id = $1 AND user_id = $2");
    expect(clientQuery.mock.calls[1][1]).toEqual([OPPORTUNITY_ID, USER_ID]);
    expect(clientQuery.mock.calls[2][0]).toBe("ROLLBACK");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("returnerer 404 når en annen brukers oppføring forsøkes oppdatert", async () => {
    const { app, query } = createTestApp(vi.fn().mockResolvedValue({ rows: [] }));

    await request(app)
      .patch(`/api/admin-room/workspace/funding-opportunities/${OPPORTUNITY_ID}`)
      .send({ status: "planned" })
      .expect(404);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("id = $1 AND user_id = $2");
    expect(query.mock.calls[0][1]).toEqual([OPPORTUNITY_ID, USER_ID]);
  });

  it("legger inn den kuraterte katalogen idempotent per bruker", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const { app, logAdminActivity } = createTestApp(query);

    const response = await request(app)
      .post("/api/admin-room/workspace/funding-opportunities/seed")
      .send({})
      .expect(200);

    expect(response.body.seeded).toBe(4);
    expect(query).toHaveBeenCalledTimes(5);
    for (const call of query.mock.calls.slice(0, 4)) {
      expect(call[0]).toContain("ON CONFLICT (user_id, catalog_key)");
      expect(call[1][0]).toBe(USER_ID);
    }
    expect(logAdminActivity).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      action: "seeded",
    }));
  });
});
