import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import type { Pool } from "pg";
import {
  attachUserEventsWebSocket,
  broadcastUserEvent,
  consumeUserEventsTicket,
  connectedUserClientCount,
  issueUserEventsTicket,
  isLegacyUserEventsTokenAllowed,
  registerUserClientForTests,
  resetUserClientsForTests,
  setupUserEventsTicketRoute,
  USER_EVENTS_TICKET_TTL_MS,
  USER_EVENTS_WS_PATH,
} from "./realtime-user-events";

class MemoryTicketDatabase {
  private readonly tickets = new Map<string, {
    userId: string;
    issuedAt: number;
    expiresAt: number;
  }>();

  async query<T = unknown>(sql: string, parameters: unknown[] = []): Promise<{ rows: T[] }> {
    if (sql.includes("INSERT INTO realtime_user_event_tickets")) {
      const [userId, ticketHash, issuedAt, keepExisting, expiresAt] = parameters as [
        string, string, Date, number, Date,
      ];
      for (const [hash, record] of this.tickets) {
        if (record.expiresAt <= issuedAt.getTime()) this.tickets.delete(hash);
      }
      const existing = [...this.tickets.entries()]
        .filter(([, record]) => record.userId === userId)
        .sort((a, b) => b[1].issuedAt - a[1].issuedAt || b[0].localeCompare(a[0]));
      for (const [hash] of existing.slice(keepExisting)) this.tickets.delete(hash);
      this.tickets.set(ticketHash, {
        userId,
        issuedAt: issuedAt.getTime(),
        expiresAt: expiresAt.getTime(),
      });
      return { rows: [] };
    }
    if (sql.includes("DELETE FROM realtime_user_event_tickets")) {
      const [ticketHash, now] = parameters as [string, Date];
      const record = this.tickets.get(ticketHash);
      this.tickets.delete(ticketHash);
      return {
        rows: record && record.expiresAt > now.getTime()
          ? [{ user_id: record.userId } as T]
          : [],
      };
    }
    throw new Error(`Unexpected SQL in MemoryTicketDatabase: ${sql}`);
  }
}

/**
 * Unit-tests the broadcast routing layer without standing up a real
 * HTTP upgrade handshake. We drive the module's ``registerClient``
 * via the test-only hook and simulate the ``WebSocket`` surface with
 * a fake that records every ``send``.
 *
 * Coverage:
 *   - Broadcasts fan out only to sockets owned by the target user.
 *   - Multiple sockets on the same user all receive the same frame
 *     (photographer has iPad + a desktop tab open at once).
 *   - Closed sockets (readyState != OPEN) are skipped — no crashes
 *     from trying to ``send`` into a disposed connection.
 *   - Send-throws are swallowed (production: socket's own close
 *     handler cleans up, we shouldn't crash the HTTP request that
 *     triggered the broadcast).
 *   - Cleanup on ``close`` removes the socket from the registry so
 *     a future broadcast doesn't fan out to a zombie.
 *   - Frame shape carries protocol v1 + ``type: user_event`` + the
 *     serialized event so browser and iPad reject incompatible versions.
 */
describe("realtime-user-events broadcast routing", () => {
  // Mirror of ws.WebSocket.OPEN (1). We don't import the real ws
  // module here because we only need the constant.
  const OPEN = 1;
  const CLOSED = 3;

  class FakeSocket {
    readyState = OPEN;
    sent: string[] = [];
    private handlers = new Map<string, (() => void)[]>();
    send(data: string): void {
      if (this.readyState !== OPEN) throw new Error("socket closed");
      this.sent.push(data);
    }
    close(): void {
      this.readyState = CLOSED;
      const handlers = this.handlers.get("close") ?? [];
      for (const h of handlers) h();
    }
    terminate(): void {
      this.readyState = CLOSED;
    }
    on(event: string, handler: () => void): this {
      const list = this.handlers.get(event) ?? [];
      list.push(handler);
      this.handlers.set(event, list);
      return this;
    }
  }

  afterEach(() => {
    resetUserClientsForTests();
  });

  function register(userId: string): FakeSocket {
    const ws = new FakeSocket();
    registerUserClientForTests(userId, ws as unknown as WebSocket);
    return ws;
  }

  it("routes broadcasts only to sockets owned by the target user", () => {
    const a = register("user-a");
    const b = register("user-b");
    broadcastUserEvent("user-a", {
      kind: "asset.hearted",
      assetId: "img-1",
      sessionId: "sess-1",
      clientName: "Olav",
      hearted: true,
      timestamp: "2026-04-19T10:00:00Z",
    });
    // a.sent[0] is the connection_established frame written at register.
    // The broadcast should append a second frame.
    expect(a.sent.length).toBe(2);
    expect(b.sent.length).toBe(1);
    const payload = JSON.parse(a.sent[1]);
    expect(payload.version).toBe(1);
    expect(payload.type).toBe("user_event");
    expect(payload.event.kind).toBe("asset.hearted");
    expect(payload.event.assetId).toBe("img-1");
    expect(typeof payload.serverTime).toBe("string");
  });

  it("fans out to multiple sockets for the same user", () => {
    const ipad = register("user-a");
    const web = register("user-a");
    broadcastUserEvent("user-a", {
      kind: "quote.signed",
      quoteId: "q-1",
      clientName: null,
      signerKind: "client",
      timestamp: "2026-04-19T10:00:00Z",
    });
    expect(ipad.sent.length).toBe(2);
    expect(web.sent.length).toBe(2);
  });

  it("no-ops when nobody is connected", () => {
    // Just verifies this doesn't throw — the registry is empty.
    expect(() =>
      broadcastUserEvent("nobody", {
        kind: "contract.signed",
        contractId: "c-1",
        clientName: null,
        signerKind: "client",
        timestamp: "2026-04-19T10:00:00Z",
      }),
    ).not.toThrow();
  });

  it("skips closed sockets (readyState != OPEN)", () => {
    const ws = register("user-a");
    ws.readyState = CLOSED;
    const initialSent = ws.sent.length;
    broadcastUserEvent("user-a", {
      kind: "asset.hearted",
      assetId: "img-1",
      sessionId: "sess-1",
      clientName: null,
      hearted: true,
      timestamp: "2026-04-19T10:00:00Z",
    });
    // No new frame should have been pushed because readyState flipped.
    expect(ws.sent.length).toBe(initialSent);
  });

  it("swallows send-throws so a single bad socket can't break broadcast", () => {
    const good = register("user-a");
    const bad = register("user-a");
    // Replace good.send to throw on the next call.
    bad.send = () => {
      throw new Error("broken pipe");
    };
    expect(() =>
      broadcastUserEvent("user-a", {
        kind: "asset.commented",
        assetId: "img-1",
        sessionId: "sess-1",
        clientName: null,
        preview: "Elsker denne!",
        timestamp: "2026-04-19T10:00:00Z",
      }),
    ).not.toThrow();
    // good must still have received the frame.
    expect(good.sent.length).toBeGreaterThanOrEqual(2);
  });

  it("removes the socket from the registry on close", () => {
    const ws = register("user-a");
    expect(connectedUserClientCount("user-a")).toBe(1);
    ws.close();
    expect(connectedUserClientCount("user-a")).toBe(0);
  });

  it("drops the user entry entirely once their last socket closes", () => {
    const a = register("user-a");
    const b = register("user-a");
    expect(connectedUserClientCount("user-a")).toBe(2);
    a.close();
    expect(connectedUserClientCount("user-a")).toBe(1);
    b.close();
    expect(connectedUserClientCount("user-a")).toBe(0);
  });

  it("registers initial connection_established frame on attach", () => {
    const ws = register("user-a");
    expect(ws.sent.length).toBe(1);
    const frame = JSON.parse(ws.sent[0]);
    expect(frame.version).toBe(1);
    expect(frame.type).toBe("connection_established");
    expect(typeof frame.serverTime).toBe("string");
  });
});

describe("realtime user-event handshake tickets", () => {
  it("binds a ticket to the authenticated user and permits exactly one atomic consume", async () => {
    const database = new MemoryTicketDatabase();
    const { ticket } = await issueUserEventsTicket(database as unknown as Pool, "user-a", 1_000);
    expect(ticket).not.toContain("user-a");
    const [first, replay] = await Promise.all([
      consumeUserEventsTicket(database as unknown as Pool, ticket, 1_001),
      consumeUserEventsTicket(database as unknown as Pool, ticket, 1_002),
    ]);
    expect([first, replay].filter(Boolean)).toEqual([{ userId: "user-a" }]);
  });

  it("rejects and consumes expired tickets", async () => {
    const database = new MemoryTicketDatabase();
    const { ticket } = await issueUserEventsTicket(database as unknown as Pool, "user-a", 5_000);
    expect(
      await consumeUserEventsTicket(
        database as unknown as Pool,
        ticket,
        5_000 + USER_EVENTS_TICKET_TTL_MS,
      ),
    ).toBeNull();
    expect(await consumeUserEventsTicket(database as unknown as Pool, ticket, 5_001)).toBeNull();
  });

  it("bounds outstanding tickets per user and revokes the oldest", async () => {
    const database = new MemoryTicketDatabase();
    const tickets: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      tickets.push((await issueUserEventsTicket(
        database as unknown as Pool,
        "user-a",
        10_000 + index,
      )).ticket);
    }
    expect(await consumeUserEventsTicket(database as unknown as Pool, tickets[0], 10_010)).toBeNull();
    expect(await consumeUserEventsTicket(database as unknown as Pool, tickets[4], 10_010)).toEqual({ userId: "user-a" });
  });

  it("issues tickets only through an authenticated, non-cacheable POST", async () => {
    const app = express();
    const database = new MemoryTicketDatabase();
    app.use(express.json());
    setupUserEventsTicketRoute({
      app,
      pool: database as unknown as Pool,
      requireUserSession: (req, res) => {
        const userId = req.header("x-test-user");
        if (userId) return { userId };
        res.status(401).json({ error: "auth_required" });
        return null;
      },
    });

    await request(app)
      .post("/api/realtime/user-events-ticket")
      .expect(401);

    const response = await request(app)
      .post("/api/realtime/user-events-ticket")
      .set("x-test-user", "user-route")
      .expect(201);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body.websocketPath).toBe("/api/ipad/ws/events");
    expect(response.body.protocolVersion).toBe(1);
    expect(await consumeUserEventsTicket(database as unknown as Pool, response.body.ticket))
      .toEqual({ userId: "user-route" });
  });

  it("accepts a valid ticket through the real WebSocket upgrade path", async () => {
    const server = createServer(express());
    const database = new MemoryTicketDatabase();
    attachUserEventsWebSocket(server, database as unknown as Pool);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    let socket: WebSocket | null = null;
    try {
      const { port } = server.address() as AddressInfo;
      const { ticket } = await issueUserEventsTicket(
        database as unknown as Pool, "user-upgrade",
      );
      socket = new WebSocket(
        `ws://127.0.0.1:${port}${USER_EVENTS_WS_PATH}?ticket=${encodeURIComponent(ticket)}`,
      );
      const frame = await new Promise<string>((resolve, reject) => {
        socket?.once("message", (data) => resolve(data.toString()));
        socket?.once("error", reject);
      });
      expect(JSON.parse(frame)).toMatchObject({
        version: 1, type: "connection_established",
      });
      expect(connectedUserClientCount("user-upgrade")).toBe(1);
    } finally {
      if (socket) {
        await new Promise<void>((resolve) => {
          if (socket?.readyState === WebSocket.CLOSED) return resolve();
          socket?.once("close", () => resolve());
          socket?.close();
        });
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("keeps legacy token auth behind an explicit sunset switch", () => {
    const original = process.env.REALTIME_ALLOW_LEGACY_TOKEN;
    try {
      delete process.env.REALTIME_ALLOW_LEGACY_TOKEN;
      expect(isLegacyUserEventsTokenAllowed()).toBe(true);
      process.env.REALTIME_ALLOW_LEGACY_TOKEN = "false";
      expect(isLegacyUserEventsTokenAllowed()).toBe(false);
      process.env.REALTIME_ALLOW_LEGACY_TOKEN = "0";
      expect(isLegacyUserEventsTokenAllowed()).toBe(false);
      process.env.REALTIME_ALLOW_LEGACY_TOKEN = "true";
      expect(isLegacyUserEventsTokenAllowed()).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.REALTIME_ALLOW_LEGACY_TOKEN;
      } else {
        process.env.REALTIME_ALLOW_LEGACY_TOKEN = original;
      }
    }
  });
});
