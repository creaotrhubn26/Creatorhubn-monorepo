/**
 * Leadgrid Canvas realtime — ekte multi-penn over WebSocket.
 *
 * Path: /ws/leadgrid-canvas?notatId=<uuid>&token=<sesjonstoken>
 *
 * Live Collab v1 pollet (delte notater hentet på nytt hvert intervall);
 * dette er den ekte kanalen: strøk relayes til alle i samme notat-rom i
 * det de tegnes. Append-only-modellen (PencilKit-strøk legges bare til)
 * gjør konfliktfri merging triviell — sletting/visking forsones fortsatt
 * via den eksisterende PUT/poll-syklusen, som består som fallback.
 *
 * Auth: sesjonstoken fra query slås opp i samme activeSessions-map som
 * HTTP-rutene bruker; deretter verifiseres notat-tilgangen (eier ELLER
 * delt i org-en) mot databasen før klienten slippes inn i rommet.
 *
 * Skala: in-memory per instance (samme avgrensning som dance-realtime).
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { Pool } from "pg";
import crypto from "crypto";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";

interface CanvasKlient {
  ws: WebSocket;
  klientId: string;
  userId: string;
  navn: string;
  notatId: string;
  isAlive: boolean;
}

type SesjonsMap = Map<string, { userId: string; email?: string; name?: string }>;

export function createCanvasRealtimeServer(
  server: Server,
  pool: Pool,
  activeSessions: SesjonsMap,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const klienter = new Map<string, CanvasKlient>();

  server.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      if (url.pathname !== "/ws/leadgrid-canvas") return;
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } catch {
      // Malformet URL — andre listeners får prøve seg.
    }
  });

  function broadcast(notatId: string, payload: unknown, unntattKlientId?: string): void {
    const data = JSON.stringify(payload);
    for (const k of klienter.values()) {
      if (k.notatId !== notatId) continue;
      if (unntattKlientId && k.klientId === unntattKlientId) continue;
      if (k.ws.readyState !== WebSocket.OPEN) continue;
      try { k.ws.send(data); } catch { /* ignore */ }
    }
  }

  function tilstede(notatId: string): Array<{ userId: string; displayName: string }> {
    const sett = new Set<string>();
    const ut: Array<{ userId: string; displayName: string }> = [];
    for (const k of klienter.values()) {
      if (k.notatId !== notatId || sett.has(k.userId)) continue;
      sett.add(k.userId);
      ut.push({ userId: k.userId, displayName: k.navn });
    }
    return ut;
  }

  wss.on("connection", (ws, req) => {
    void (async () => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const notatId = url.searchParams.get("notatId") || "";
      const token = url.searchParams.get("token") || "";
      const sesjon = token ? activeSessions.get(token) : undefined;
      if (!notatId || !sesjon) {
        ws.close(1008, "auth_required");
        return;
      }
      // Tilgang: eier ELLER delt i samme org — samme regel som GET-en.
      try {
        const orgId = await resolveOrgIdForUser(pool, sesjon.userId).catch(() => null);
        if (!orgId) { ws.close(1008, "ingen_org"); return; }
        const r = await pool.query(
          `SELECT 1 FROM leadgrid_canvas_notater
            WHERE id = $1 AND organization_id = $2
              AND (user_id = $3 OR delt) AND slettet_at IS NULL`,
          [notatId, orgId, sesjon.userId]);
        if (r.rowCount === 0) { ws.close(1008, "not_found"); return; }
      } catch {
        ws.close(1011, "db_error");
        return;
      }

      const klientId = crypto.randomUUID();
      const navn = sesjon.name || sesjon.email || "Kollega";
      const klient: CanvasKlient = {
        ws, klientId, userId: sesjon.userId, navn, notatId, isAlive: true,
      };
      klienter.set(klientId, klient);

      ws.send(JSON.stringify({
        type: "presence:snapshot",
        users: tilstede(notatId).filter((u) => u.userId !== sesjon.userId),
      }));
      broadcast(notatId, {
        type: "presence:join",
        userId: sesjon.userId,
        displayName: navn,
      }, klientId);

      ws.on("pong", () => { klient.isAlive = true; });

      ws.on("message", (rå) => {
        let melding: Record<string, unknown>;
        try {
          melding = JSON.parse(String(rå));
        } catch { return; }
        // Strøk-relay: base64-PKDrawing-delta (cap 512 kB per melding).
        if (melding.type === "strokes"
            && typeof melding.strokes === "string"
            && melding.strokes.length <= 512_000) {
          broadcast(notatId, {
            type: "strokes",
            strokes: melding.strokes,
            fra: navn,
          }, klientId);
        }
      });

      ws.on("close", () => {
        klienter.delete(klientId);
        const fortsattInne = [...klienter.values()]
          .some((k) => k.notatId === notatId && k.userId === sesjon.userId);
        if (!fortsattInne) {
          broadcast(notatId, {
            type: "presence:leave",
            userId: sesjon.userId,
            displayName: navn,
          });
        }
      });
    })();
  });

  // Keep-alive: ping hvert 30. sekund, døde sockets ryddes.
  const intervall = setInterval(() => {
    for (const [id, k] of klienter) {
      if (!k.isAlive) {
        try { k.ws.terminate(); } catch { /* ignore */ }
        klienter.delete(id);
        continue;
      }
      k.isAlive = false;
      try { k.ws.ping(); } catch { /* ignore */ }
    }
  }, 30_000);
  wss.on("close", () => clearInterval(intervall));

  return wss;
}
