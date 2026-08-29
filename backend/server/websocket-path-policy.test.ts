import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import type { Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { createWebSocketServer } from "./websocket-chat.js";
import {
  parseWebSocketRequestUrl,
  resolveWebSocketPathOwner,
  WEBSOCKET_PATHS,
} from "./websocket-path-policy.js";

function fakeUpgradeRequest(pathname: string) {
  return {
    url: pathname,
    headers: { host: "localhost" },
  };
}

function fakeUpgradeSocket(): Duplex {
  return Object.assign(new EventEmitter(), {
    destroyed: false,
    writable: true,
    destroy: vi.fn(),
    write: vi.fn(),
  }) as unknown as Duplex;
}

describe("WebSocket path ownership", () => {
  it("parses request targets without trusting a Host header", () => {
    expect(parseWebSocketRequestUrl("/ws/leadgrid?token=abc")?.pathname).toBe(
      "/ws/leadgrid",
    );
    expect(parseWebSocketRequestUrl("http://[")).toBeNull();
  });

  it("keeps every production upgrade listener on the Host-independent parser", () => {
    for (const filename of [
      "./capture-websocket.ts",
      "./realtime-user-events.ts",
      "./dance-realtime-server.ts",
      "./websocket-chat.ts",
      "./leadgrid-canvas-realtime.ts",
      "./leadgrid-realtime.ts",
      "./index.ts",
    ]) {
      const source = readFileSync(new URL(filename, import.meta.url), "utf8");
      expect(source).toContain("parseWebSocketRequestUrl");
      expect(source).not.toMatch(
        /new URL\(req\.url[\s\S]{0,160}req\.headers\.host/,
      );
    }
  });

  it("assigns every dedicated path to exactly one owner before chat", () => {
    expect(resolveWebSocketPathOwner(WEBSOCKET_PATHS.leadgridRealtime)).toBe(
      "leadgrid-realtime",
    );
    expect(resolveWebSocketPathOwner(WEBSOCKET_PATHS.leadgridCanvas)).toBe(
      "leadgrid-canvas",
    );
    expect(resolveWebSocketPathOwner(WEBSOCKET_PATHS.danceRealtime)).toBe(
      "dance",
    );
    expect(resolveWebSocketPathOwner(WEBSOCKET_PATHS.userEvents)).toBe(
      "user-events",
    );
    expect(
      resolveWebSocketPathOwner(
        "/api/capture/ws/sessions/123e4567-e89b-12d3-a456-426614174000",
      ),
    ).toBe("capture");
  });

  it("keeps the existing root and namespaced chat paths", () => {
    expect(resolveWebSocketPathOwner("/ws")).toBe("chat");
    expect(resolveWebSocketPathOwner("/ws/communication/conversation-1")).toBe(
      "chat",
    );
    expect(resolveWebSocketPathOwner("/ws/events")).toBe("chat");
    expect(resolveWebSocketPathOwner("/not-a-websocket-route")).toBeNull();
  });

  it("does not let the first-registered chat handler consume Leadgrid upgrades", () => {
    const server = new EventEmitter();
    const chatWss = createWebSocketServer(
      server as unknown as HttpServer,
      {} as never,
      {} as never,
      new Map(),
    );
    const chatUpgrade = vi
      .spyOn(chatWss, "handleUpgrade")
      .mockImplementation(() => undefined);
    let leadgridClaims = 0;

    // Production registers chat first and the dedicated Leadgrid listener
    // later. EventEmitter calls both listeners in that same order.
    server.on("upgrade", (request) => {
      const req = request as ReturnType<typeof fakeUpgradeRequest>;
      const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
      if (resolveWebSocketPathOwner(pathname) === "leadgrid-realtime") {
        leadgridClaims += 1;
      }
    });

    server.emit(
      "upgrade",
      fakeUpgradeRequest("/ws/leadgrid"),
      fakeUpgradeSocket(),
      Buffer.alloc(0),
    );

    expect(chatUpgrade).not.toHaveBeenCalled();
    expect(leadgridClaims).toBe(1);

    server.emit(
      "upgrade",
      fakeUpgradeRequest("/ws/communication/channel-1"),
      fakeUpgradeSocket(),
      Buffer.alloc(0),
    );

    expect(chatUpgrade).toHaveBeenCalledTimes(1);
    expect(leadgridClaims).toBe(1);
  });
});
