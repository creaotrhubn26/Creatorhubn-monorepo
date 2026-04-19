import { afterEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import {
  broadcastUserEvent,
  connectedUserClientCount,
  registerUserClientForTests,
  resetUserClientsForTests,
} from "./realtime-user-events";

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
 *   - Frame shape carries ``type: user_event`` + the serialized
 *     event so the iPad can decode without version negotiation.
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
    expect(frame.type).toBe("connection_established");
    expect(typeof frame.serverTime).toBe("string");
  });
});
