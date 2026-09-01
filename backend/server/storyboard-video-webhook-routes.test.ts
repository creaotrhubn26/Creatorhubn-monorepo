import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createStoryboardVideoWebhookRouter } from "./storyboard-video-webhook-routes.js";

const REQUEST_ID = "018f47a2-8b32-7d19-a271-4f6319d03c2a";
const TOKEN = "c".repeat(64);

function webhookPool() {
  const sql: string[] = [];
  const client = {
    query: vi.fn(async (query: string) => {
      sql.push(query);
      if (query.includes("SELECT id,provider_request_id")) {
        return {
          rows: [{
            id: "job-webhook",
            provider_request_id: REQUEST_ID,
            provider_status_url:
              `https://api.higgsfield.ai/requests/${REQUEST_ID}/status`,
            provider_status: "queued",
            status: "queued",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  return {
    sql,
    pool: { connect: vi.fn(async () => client) } as any,
  };
}

function webhookApp(pool: any, options: Record<string, unknown> = {}) {
  const app = express();
  app.use(
    "/api/role-room/storyboard-video-webhooks",
    createStoryboardVideoWebhookRouter(pool, options),
  );
  // Mirrors production ordering: this larger parser must never see a request
  // consumed by the dedicated webhook router above.
  app.use(express.json({ limit: "50mb" }));
  return app;
}

describe("Storyboard video Higgsfield webhook ingress", () => {
  it("persists before 202 and only schedules authenticated reconciliation", async () => {
    const { pool, sql } = webhookPool();
    const response = await request(webhookApp(pool))
      .post(`/api/role-room/storyboard-video-webhooks/higgsfield/${TOKEN}`)
      .send({
        request_id: REQUEST_ID,
        status: "completed",
        error: null,
        payload: { video: { url: "https://cdn.example.com/video.mp4" } },
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      success: true,
      data: { accepted: true, wakeScheduled: true },
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(sql.findIndex((query) =>
      query.includes("INSERT INTO storyboard_ai_video_provider_events")))
      .toBeLessThan(sql.findIndex((query) =>
        query.includes("SET next_poll_at=NOW()")));
    expect(sql.at(-1)).toBe("COMMIT");
  });

  it("rejects an oversized callback before the later 50 MB parser", async () => {
    const { pool } = webhookPool();
    const response = await request(webhookApp(pool))
      .post(`/api/role-room/storyboard-video-webhooks/higgsfield/${TOKEN}`)
      .send({ padding: "x".repeat(300 * 1024) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "webhook_payload_too_large" });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("rate-limits by direct peer before token validation and body parsing", async () => {
    const { pool } = webhookPool();
    const app = webhookApp(pool, { rateMaxRequests: 1 });

    await request(app)
      .post("/api/role-room/storyboard-video-webhooks/higgsfield/not-a-token")
      .send({})
      .expect(404);
    const limited = await request(app)
      .post(`/api/role-room/storyboard-video-webhooks/higgsfield/${TOKEN}`)
      .send({ padding: "x".repeat(300 * 1024) });

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: "rate_limited" });
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it.each([
    { method: "put", suffix: `/higgsfield/${TOKEN}` },
    { method: "post", suffix: `/higgsfield/${TOKEN}/unexpected` },
  ])("consumes unknown prefix route before the global parser: $method $suffix", async ({
    method,
    suffix,
  }) => {
    const { pool } = webhookPool();
    const response = await (request(webhookApp(pool)) as any)[method](
      `/api/role-room/storyboard-video-webhooks${suffix}`,
    ).set("content-type", "application/json")
      .send(JSON.stringify({ padding: "x".repeat(300 * 1024) }));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "webhook_not_found" });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
