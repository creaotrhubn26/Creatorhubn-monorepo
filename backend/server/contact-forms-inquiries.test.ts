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

import { setupContactFormsRoutes } from "./contact-forms-routes";

const form = {
  id: "11111111-1111-4111-8111-111111111111",
  token: "cf_public",
  title: "Kontakt fotografen",
  owner_user_id: "owner-1",
  vendor_email: "owner@example.test",
  branding: {},
  fields: [
    { id: "name", type: "text", label: "Navn", required: true, mapTo: "name" },
    { id: "email", type: "email", label: "E-post", required: true, mapTo: "email" },
  ],
};

function buildApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  setupContactFormsRoutes({
    app,
    pool: { query } as unknown as Pool,
    requireUserSession: (_req, res) => {
      res.status(401).json({ error: "unauthorized" });
      return null;
    },
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.email.mockResolvedValue({ sent: true, provider: "resend", messageId: "message-1" });
  serviceMocks.push.mockResolvedValue({ sent: 1, total: 1 });
});

describe("public contact form to canonical inquiry", () => {
  it("supplies durable defaults required by client_submissions", async () => {
    let insertParams: unknown[] = [];
    const query = vi.fn(async (statement: unknown, params: unknown[] = []) => {
      const sql = String(statement);
      if (sql.includes("CREATE TABLE IF NOT EXISTS contact_forms") || sql.includes("CREATE INDEX IF NOT EXISTS")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT * FROM contact_forms WHERE token")) return { rows: [form], rowCount: 1 };
      if (sql.includes("INSERT INTO client_submissions")) {
        insertParams = params;
        return { rows: [{ id: "inquiry-1" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE contact_forms SET submission_count")) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    });

    const response = await request(buildApp(query))
      .post("/api/public/contact-form/cf_public")
      .send({ answers: { name: " Kari ", email: "KARI@EXAMPLE.TEST" } });

    expect(response.status).toBe(201);
    expect(insertParams).toEqual([
      "Kari",
      "kari@example.test",
      null,
      "annet",
      null,
      null,
      null,
      "Forespørsel via kontaktskjema",
      "{}",
      "owner-1",
      "owner@example.test",
    ]);
    expect(serviceMocks.push).toHaveBeenCalledWith(
      expect.anything(),
      "owner-1",
      "Ny forespørsel",
      "Kari · annet",
      { type: "inquiry", inquiryId: "inquiry-1" },
    );
    expect(serviceMocks.broadcast).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        kind: "inquiry.updated",
        inquiryId: "inquiry-1",
        reason: "created",
      }),
    );
  });

  it("rejects an invalid e-mail before inserting an inquiry", async () => {
    const query = vi.fn(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes("CREATE TABLE IF NOT EXISTS contact_forms") || sql.includes("CREATE INDEX IF NOT EXISTS")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT * FROM contact_forms WHERE token")) return { rows: [form], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    });

    const response = await request(buildApp(query))
      .post("/api/public/contact-form/cf_public")
      .send({ answers: { name: "Kari", email: "ikke-en-epost" } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("valid_email_required");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO client_submissions"))).toBe(false);
  });
});
