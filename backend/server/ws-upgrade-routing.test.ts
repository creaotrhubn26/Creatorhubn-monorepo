/**
 * ws-upgrade-routing.test.ts — hvem svarer på hvilken `/ws/*`-upgrade.
 *
 * Node emitter `'upgrade'` til hver eneste lytter på HTTP-serveren. `index.ts`
 * registrerer chat-serveren (som claimer hele `/ws/`-prefikset) FØR de tre
 * dedikerte sanntidsserverne som eier en eksakt sti under samme prefiks. Uten
 * en eierskapsliste betyr det at to servere fullfører håndtrykk på samme
 * socket. Testen wirer opp nøyaktig samme lytterform og rekkefølge som
 * `index.ts` og krever at hver sti lander hos én og bare én server.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import {
  DANCE_REALTIME_WS_PATH,
  DEDICATED_WS_UPGRADE_PATHS,
  LEADGRID_CANVAS_WS_PATH,
  LEADGRID_REALTIME_WS_PATH,
  isChatUpgradePath,
} from "./ws-upgrade-paths";

const CHAT_PATHS = [
  "/ws",
  "/ws/events",
  "/ws/shotlist/project-123",
  "/ws/?room=liveset:abc",
];

describe("isChatUpgradePath", () => {
  it("claims /ws and everything under /ws/ that nobody else owns", () => {
    for (const raw of CHAT_PATHS) {
      const pathname = new URL(raw, "http://x").pathname;
      expect(isChatUpgradePath(pathname), raw).toBe(true);
    }
  });

  it("yields every path owned by a dedicated upgrade listener", () => {
    for (const path of DEDICATED_WS_UPGRADE_PATHS) {
      expect(isChatUpgradePath(path), path).toBe(false);
    }
  });

  it("does not claim paths outside the /ws prefix", () => {
    // Capture og user-events ligger under /api/... — de må aldri fanges av
    // chat-prefikset, ellers ryker iPad-synken og hele varselstrømmen.
    for (const path of [
      "/api/ipad/ws/events",
      "/api/capture/ws/sessions/0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
      "/wsx",
      "/",
    ]) {
      expect(isChatUpgradePath(path), path).toBe(false);
    }
  });
});

/** Wirer opp lytterne i samme form og rekkefølge som `backend/server/index.ts`. */
function buildServer(): {
  server: Server;
  claims: Map<string, string[]>;
  errors: string[];
} {
  const server = createServer();
  const claims = new Map<string, string[]>();
  const errors: string[] = [];
  const claim = (name: string, url: string): void => {
    const list = claims.get(url) ?? [];
    list.push(name);
    claims.set(url, list);
  };

  const attach = (
    name: string,
    matches: (pathname: string) => boolean,
  ): void => {
    const wss = new WebSocketServer({ noServer: true });
    wss.on("connection", (_ws, req) => claim(name, req.url ?? ""));
    server.on("upgrade", (req, socket, head) => {
      try {
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        if (!matches(pathname)) return;
        wss.handleUpgrade(req, socket, head, (ws) =>
          wss.emit("connection", ws, req),
        );
      } catch (error) {
        // Produksjonskoden svelger dette i sin egen catch. Vi fanger det opp
        // her slik at en kollisjon blir synlig i stedet for stille.
        errors.push(
          `${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  };

  // Rekkefølge som index.ts: chat først, deretter de dedikerte serverne.
  attach("chat", isChatUpgradePath);
  attach("dance", (p) => p === DANCE_REALTIME_WS_PATH);
  attach("canvas", (p) => p === LEADGRID_CANVAS_WS_PATH);
  attach("leadgrid", (p) => p === LEADGRID_REALTIME_WS_PATH);

  return { server, claims, errors };
}

function connect(port: number, path: string): Promise<"open" | string> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    const done = (value: "open" | string) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* noop */
      }
      resolve(value);
    };
    const timer = setTimeout(() => done("timeout"), 3000);
    ws.on("open", () => done("open"));
    ws.on("error", (error) => done(`error: ${error.message}`));
    ws.on("close", (code) => done(`closed: ${code}`));
  });
}

describe("upgrade routing over a real http server", () => {
  let active: Server | null = null;
  afterEach(async () => {
    if (active) {
      await new Promise<void>((r) => active!.close(() => r()));
      active = null;
    }
  });

  it("routes every /ws path to exactly one server, with no double handshake", async () => {
    const { server, claims, errors } = buildServer();
    active = server;
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;

    const cases: Array<[string, string]> = [
      ["/ws", "chat"],
      ["/ws/events", "chat"],
      ["/ws/shotlist/project-123", "chat"],
      [DANCE_REALTIME_WS_PATH, "dance"],
      [LEADGRID_CANVAS_WS_PATH, "canvas"],
      [LEADGRID_REALTIME_WS_PATH, "leadgrid"],
    ];

    for (const [path, owner] of cases) {
      expect(await connect(port, path), path).toBe("open");
      expect(claims.get(path), path).toEqual([owner]);
    }
    expect(errors).toEqual([]);
  });

  it("regression: the old greedy /ws/ prefix collided with the dedicated servers", async () => {
    // Dokumenterer feilen fiksen fjerner. Med prefiks-matchen som stod i
    // websocket-chat.ts før, kaster `ws` «handleUpgrade() was called more than
    // once with the same socket» og dansemodulen havner på chat-serveren.
    const server = createServer();
    active = server;
    const chat = new WebSocketServer({ noServer: true });
    const dance = new WebSocketServer({ noServer: true });
    const claimedBy: string[] = [];
    let collision: string | null = null;
    chat.on("connection", () => claimedBy.push("chat"));
    dance.on("connection", () => claimedBy.push("dance"));

    server.on("upgrade", (req, socket, head) => {
      const p = new URL(req.url ?? "/", "http://localhost").pathname;
      if (p === "/ws" || p.startsWith("/ws/")) {
        chat.handleUpgrade(req, socket, head, (ws) =>
          chat.emit("connection", ws, req),
        );
      }
    });
    server.on("upgrade", (req, socket, head) => {
      try {
        const p = new URL(req.url ?? "/", "http://localhost").pathname;
        if (p !== DANCE_REALTIME_WS_PATH) return;
        dance.handleUpgrade(req, socket, head, (ws) =>
          dance.emit("connection", ws, req),
        );
      } catch (error) {
        collision = error instanceof Error ? error.message : String(error);
      }
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    await connect(port, DANCE_REALTIME_WS_PATH);

    expect(collision).toMatch(/more than once with the same socket/);
    expect(claimedBy).toEqual(["chat"]);
  });
});
