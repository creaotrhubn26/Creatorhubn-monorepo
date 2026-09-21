import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  email: vi.fn(),
  push: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock("./transactional-email-service", () => ({
  sendTransactionalEmail: serviceMocks.email,
}));
vi.mock("./capture-push", () => ({
  sendCapturePush: serviceMocks.push,
}));
vi.mock("./realtime-user-events.js", () => ({
  broadcastUserEvent: serviceMocks.broadcast,
}));

import { setupSubmissionsRoutes } from "./submissions-routes";

const session = {
  userId: "owner-1",
  email: "owner@example.test",
  name: "Creator",
  role: "user",
};

function inquiryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inquiry-1",
    name: "Kari Kunde",
    email: "kari@example.test",
    project_type: "wedding",
    description: "Vi ønsker bryllupsfoto.",
    owner_user_id: session.userId,
    vendor_email: session.email,
    status: "new",
    is_read: false,
    is_starred: false,
    submitted_at: "2026-09-21T08:00:00.000Z",
    created_at: "2026-09-21T08:00:00.000Z",
    ...overrides,
  };
}

function buildApp(query: ReturnType<typeof vi.fn>, authenticated = true) {
  const app = express();
  app.use(express.json());
  setupSubmissionsRoutes({
    app,
    pool: { query } as unknown as Pool,
    compatSubmissionsStore: new Map(),
    compatStoreSet: vi.fn(async () => undefined),
    dbCompatSubmissionKey: (id) => `submission:${id}`,
    recordAnalyticsEvent: vi.fn(),
    compatResolveUserId: vi.fn(() => session.userId),
    requireUserSession: (_req, res) => {
      if (authenticated) return session;
      res.status(401).json({ error: "unauthorized" });
      return null;
    },
    readString: (value) => typeof value === "string" ? value : null,
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.email.mockResolvedValue({
    sent: true,
    provider: "resend",
    messageId: "message-1",
    reason: null,
  });
  serviceMocks.push.mockResolvedValue({ sent: 1, total: 1 });
});

describe("canonical CreatorHub inquiries", () => {
  it("requires a session for the inbox", async () => {
    const query = vi.fn();
    const response = await request(buildApp(query, false)).get("/api/inquiries");

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("scopes list queries to the session and ignores spoofed vendor parameters", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [inquiryRow()], rowCount: 1 });
    const response = await request(buildApp(query))
      .get("/api/inquiries?status=open&vendorId=attacker&vendorEmail=attacker@example.test");

    expect(response.status).toBe(200);
    expect(response.body.items[0]).toMatchObject({
      id: "inquiry-1",
      clientName: "Kari Kunde",
      isRead: false,
    });
    expect(query.mock.calls[0][1]).toEqual([session.userId, session.email, 100]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("s.owner_user_id = $1");
    expect(sql).toContain("LOWER(s.vendor_email) = LOWER($2)");
    expect(sql).not.toContain("attacker");
  });

  it("owner-scopes mutations so a foreign inquiry is returned as not found", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const response = await request(buildApp(query))
      .patch("/api/inquiries/foreign-inquiry")
      .send({ isRead: true });

    expect(response.status).toBe(404);
    expect(query.mock.calls[0][1]).toEqual([session.userId, session.email, true, "foreign-inquiry"]);
    expect(String(query.mock.calls[0][0])).toContain("owner_user_id = $1");
  });

  it("does not link an owned inquiry to a project the session does not own", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const response = await request(buildApp(query))
      .post("/api/submissions/inquiry-1/mark-converted")
      .send({ projectId: "foreign-project" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("project_not_found");
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.every(([sql]) => !String(sql).startsWith("UPDATE client_submissions"))).toBe(true);
  });

  it("sends a real reply, records delivery, and updates the inquiry state", async () => {
    const query = vi.fn(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("SELECT s.* FROM client_submissions")) {
        return { rows: [inquiryRow()], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO client_submission_replies")) {
        return { rows: [{ id: "reply-1" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE client_submission_replies")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("UPDATE client_submissions s")) {
        return { rows: [inquiryRow({ status: "replied", is_read: true })], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const response = await request(buildApp(query))
      .post("/api/inquiries/inquiry-1/reply")
      .send({ subject: "Takk for forespørselen", body: "Vi er ledige denne dagen." });

    expect(response.status).toBe(200);
    expect(response.body.inquiry).toMatchObject({ status: "replied", isRead: true });
    expect(serviceMocks.email).toHaveBeenCalledWith(expect.objectContaining({
      to: "kari@example.test",
      replyTo: session.email,
      credentialScope: "creatorhub",
      kind: "inquiry_reply",
    }));
    const deliveryUpdate = query.mock.calls.find(([sql]) => String(sql).includes("UPDATE client_submission_replies"));
    expect(deliveryUpdate?.[1]).toEqual(["sent", "message-1", null, "reply-1", session.userId]);
  });

  it("records a failed reply when the mail provider throws", async () => {
    serviceMocks.email.mockRejectedValueOnce(new Error("provider offline"));
    const query = vi.fn(async (statement: unknown, params?: unknown[]) => {
      const sql = String(statement);
      if (sql.includes("SELECT s.* FROM client_submissions")) {
        return { rows: [inquiryRow()], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO client_submission_replies")) {
        return { rows: [{ id: "reply-1" }], rowCount: 1 };
      }
      if (sql.includes("delivery_status = 'failed'")) {
        expect(params).toEqual(["reply-1", session.userId]);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const response = await request(buildApp(query))
      .post("/api/inquiries/inquiry-1/reply")
      .send({ body: "Vi kommer tilbake til deg." });

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      error: "email_delivery_failed",
      reason: "provider_exception",
    });
  });

  it("never reports a public inquiry as accepted when durable storage fails", async () => {
    const query = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const response = await request(buildApp(query))
      .post("/api/submissions")
      .send({
        name: "Kari Kunde",
        email: "kari@example.test",
        description: "Bryllupsfoto",
        vendorEmail: session.email,
      });

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("submission_not_persisted");
    expect(serviceMocks.email).not.toHaveBeenCalled();
    expect(serviceMocks.push).not.toHaveBeenCalled();
  });

  it("routes inquiries to existing non-UUID CreatorHub user IDs", async () => {
    const providerUserId = "google-oauth2|creator-42";
    const query = vi.fn(async (statement: unknown, params: unknown[] = []) => {
      const sql = String(statement);
      if (sql.includes("FROM users")) {
        expect(params).toEqual([providerUserId, null]);
        return { rows: [{ id: providerUserId, email: session.email }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO client_submissions")) {
        return {
          rows: [inquiryRow({ owner_user_id: providerUserId, vendor_id: providerUserId })],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await request(buildApp(query))
      .post("/api/submissions")
      .send({
        name: "Kari Kunde",
        email: "kari@example.test",
        description: "Bryllupsfoto",
        vendorId: providerUserId,
      });

    expect(response.status).toBe(201);
    expect(response.body.submission.ownerUserId).toBe(providerUserId);
    expect(serviceMocks.broadcast).toHaveBeenCalledWith(
      providerUserId,
      expect.objectContaining({
        kind: "inquiry.updated",
        inquiryId: "inquiry-1",
        reason: "created",
      }),
    );
  });
});
