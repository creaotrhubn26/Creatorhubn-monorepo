import type express from "express";
import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authenticateLeadgridRealtimeUpgrade,
  LEADGRID_REALTIME_MAX_CHANNELS,
  LEADGRID_REALTIME_MAX_PENDING_MESSAGES,
  LEADGRID_REALTIME_MAX_PAYLOAD_BYTES,
  setupLeadgridRealtimeTicketRoute,
} from "./leadgrid-realtime.js";
import {
  consumeLeadgridRealtimeTicket,
  issueLeadgridRealtimeTicket,
  leadgridRealtimeTicketInternals,
} from "./leadgrid-realtime-ticket-store.js";

function ticketPool() {
  const rows = new Map<string, { userId: string; expiresAt: Date }>();
  const query = vi.fn(async (sqlValue: unknown, values: unknown[] = []) => {
    const sql = String(sqlValue);
    if (sql.includes("INSERT INTO leadgrid_realtime_tickets")) {
      rows.set(String(values[1]), {
        userId: String(values[0]),
        expiresAt: values[4] as Date,
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("DELETE FROM leadgrid_realtime_tickets")) {
      const hash = String(values[0]);
      const row = rows.get(hash);
      rows.delete(hash);
      const now = values[1] as Date;
      return {
        rows:
          row && row.expiresAt.getTime() > now.getTime()
            ? [{ user_id: row.userId }]
            : [],
        rowCount: row ? 1 : 0,
      };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
  return { pool: { query } as unknown as Pool, query };
}

function routeHarness() {
  let handler:
    | ((req: express.Request, res: express.Response) => Promise<void>)
    | null = null;
  const app = {
    post: vi.fn((_path: string, registered: typeof handler) => {
      handler = registered;
    }),
  } as unknown as express.Application;
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  } as unknown as express.Response & {
    statusCode: number;
    body: unknown;
  };
  return {
    app,
    response,
    headers,
    run: async () => {
      if (!handler) throw new Error("route not registered");
      await handler({} as express.Request, response);
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Leadgrid realtime handshake tickets", () => {
  it("bounds websocket frames and per-client subscriptions", () => {
    expect(LEADGRID_REALTIME_MAX_PAYLOAD_BYTES).toBe(16 * 1024);
    expect(LEADGRID_REALTIME_MAX_CHANNELS).toBe(32);
    expect(LEADGRID_REALTIME_MAX_PENDING_MESSAGES).toBe(16);
  });

  it("stores only a hash and consumes each ticket once, including expiry", async () => {
    const { pool, query } = ticketPool();
    const issued = await issueLeadgridRealtimeTicket(pool, "user-a", 1_000);
    const insertValues = query.mock.calls[0]?.[1] as unknown[];
    expect(insertValues[1]).toBe(
      leadgridRealtimeTicketInternals.hashTicket(issued.ticket),
    );
    expect(insertValues).not.toContain(issued.ticket);
    await expect(
      consumeLeadgridRealtimeTicket(pool, issued.ticket, 2_000),
    ).resolves.toEqual({ userId: "user-a" });
    await expect(
      consumeLeadgridRealtimeTicket(pool, issued.ticket, 2_001),
    ).resolves.toBeNull();

    const expired = await issueLeadgridRealtimeTicket(pool, "user-a", 3_000);
    await expect(
      consumeLeadgridRealtimeTicket(pool, expired.ticket, 33_001),
    ).resolves.toBeNull();
  });

  it("issues over authenticated HTTPS semantics and accepts only ticket upgrades", async () => {
    const { pool } = ticketPool();
    const harness = routeHarness();
    setupLeadgridRealtimeTicketRoute({
      app: harness.app,
      pool,
      requireUserSession: () => ({ userId: "user-a" }),
    });
    await harness.run();
    expect(harness.response.statusCode).toBe(201);
    expect(harness.headers.get("cache-control")).toContain("no-store");
    const body = harness.response.body as {
      ticket: string;
      websocketPath: string;
    };
    expect(body.websocketPath).toBe("/ws/leadgrid");

    await expect(
      authenticateLeadgridRealtimeUpgrade(
        pool,
        `/ws/leadgrid?ticket=${encodeURIComponent(body.ticket)}`,
      ),
    ).resolves.toEqual({ userId: "user-a" });
    await expect(
      authenticateLeadgridRealtimeUpgrade(
        pool,
        `/ws/leadgrid?ticket=${encodeURIComponent(body.ticket)}`,
      ),
    ).resolves.toBeNull();
    await expect(
      authenticateLeadgridRealtimeUpgrade(
        pool,
        "/ws/leadgrid?token=raw-bearer",
      ),
    ).resolves.toBeNull();
  });

  it("does not issue a ticket without an authenticated session", async () => {
    const { pool } = ticketPool();
    const harness = routeHarness();
    setupLeadgridRealtimeTicketRoute({
      app: harness.app,
      pool,
      requireUserSession: (_req, res) => {
        res.status(401).json({ error: "unauthorized" });
        return null;
      },
    });
    await harness.run();
    expect(harness.response.statusCode).toBe(401);
    expect(harness.response.body).toEqual({ error: "unauthorized" });
  });
});
