/**
 * role-room-mcp-routes.ts — The Role Room MCP-server (JSON-RPC 2.0 over HTTP).
 *
 * Eksponerer Role Rooms data som MCP-verktøy for eksterne AI-klienter (Claude
 * Desktop, Cursor, ChatGPT-connectors). Håndrullet JSON-RPC (som REKNAREN) —
 * ingen ny avhengighet. Auth = rri_-nøkler (x-api-key), scope + prosjekt-tilgang
 * gjenbrukt fra Integration v1. Read-first: kun lese-verktøy i denne fasen.
 *
 * Montert på POST /api/role-room/mcp.
 */

import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import type { Pool } from "pg";
import { authenticateMcpKey } from "./role-room-mcp-auth.js";
import {
  listCapabilitiesFor, findCapability, McpToolError, ROLE_ROOM_CAPABILITIES,
  type McpCallContext,
} from "./role-room-mcp-registry.js";
import { hasScope } from "./role-room-integrations-v1-routes.js";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "the-role-room", title: "The Role Room", version: "0.1.0" };

// Enkel per-nøkkel token-bucket (minne). Overlever ikke restart — kun mykt vern.
const rlBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(apiKeyId: string, perMinute: number, nowMs: number): boolean {
  const b = rlBuckets.get(apiKeyId);
  if (!b || nowMs >= b.resetAt) { rlBuckets.set(apiKeyId, { count: 1, resetAt: nowMs + 60_000 }); return false; }
  if (b.count >= perMinute) return true;
  b.count += 1; return false;
}

/** Nøkkel fra `Authorization: Bearer rri_…` (foretrukket av MCP-klienter) ELLER `x-api-key`. */
export function extractApiKey(req: Request): string | undefined {
  const authz = req.headers.authorization;
  if (typeof authz === "string") {
    const m = authz.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  const xk = req.headers["x-api-key"];
  return typeof xk === "string" ? xk : undefined;
}

interface JsonRpcReq { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
const rpcOk = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const rpcErr = (id: unknown, code: number, message: string, data?: unknown) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });

const toolDef = (c: { name: string; description: string; inputSchema: Record<string, unknown>; mutates?: boolean }) => ({
  name: c.name, description: c.description, inputSchema: c.inputSchema,
  // Utkast-verktøy skriver, men er ikke destruktive (upublisert utkast).
  annotations: { readOnlyHint: !c.mutates, destructiveHint: false },
});

export function createRoleRoomMcpRouter(pool: Pool): ExpressRouter {
  const router = Router();

  router.post("/mcp", async (req: Request, res: Response) => {
    const nowMs = Date.now();
    const body = req.body as JsonRpcReq | JsonRpcReq[] | undefined;
    if (Array.isArray(body)) { res.status(400).json(rpcErr(null, -32600, "Batch-forespørsler støttes ikke.")); return; }
    const rpc = (body ?? {}) as JsonRpcReq;
    const id = rpc.id ?? null;
    const method = rpc.method ?? "";

    // Notifikasjoner (uten id) → ingen respons-kropp.
    if ((rpc.id === undefined || rpc.id === null) && method.startsWith("notifications/")) { res.status(202).end(); return; }

    // initialize + ping krever ikke auth (handshake).
    if (method === "initialize") {
      res.json(rpcOk(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {}, resources: {} }, serverInfo: SERVER_INFO }));
      return;
    }
    if (method === "ping") { res.json(rpcOk(id, {})); return; }

    // Alt annet krever en gyldig rri_-nøkkel.
    const auth = await authenticateMcpKey(pool, extractApiKey(req));
    if (!auth.ok) { res.json(rpcErr(id, auth.status === 401 ? -32001 : -32003, auth.message, { code: auth.code })); return; }
    const user = auth.user;
    if (rateLimited(user.apiKeyId, user.rateLimitPerMinute, nowMs)) {
      res.json(rpcErr(id, -32029, "For mange forespørsler.", { retryAfterSeconds: 60 })); return;
    }
    const ctx: McpCallContext = { userId: user.userId, scopes: user.scopes, apiKeyId: user.apiKeyId };

    try {
      switch (method) {
        case "tools/list": {
          const mode = typeof rpc.params?.mode === "string" ? rpc.params.mode : undefined;
          res.json(rpcOk(id, { tools: listCapabilitiesFor(user.scopes, mode).map(toolDef) }));
          return;
        }
        case "tools/call": {
          const name = String(rpc.params?.name ?? "");
          const args = (rpc.params?.arguments ?? {}) as Record<string, unknown>;
          const cap = findCapability(name);
          if (!cap) { res.json(rpcErr(id, -32601, `Ukjent verktøy: ${name}`)); return; }
          if (!hasScope(user.scopes, cap.scope)) { res.json(rpcErr(id, -32003, `Mangler scope ${cap.scope} for ${name}.`)); return; }
          const result = await cap.handler(pool, ctx, args);
          res.json(rpcOk(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: false }));
          return;
        }
        case "resources/list": {
          if (!hasScope(user.scopes, "projects.read")) { res.json(rpcOk(id, { resources: [] })); return; }
          const r = await pool.query(
            `SELECT DISTINCT p.id, p.name FROM casting_projects p
               LEFT JOIN casting_user_roles cr ON cr.project_id = p.id AND cr.user_id = $1 AND cr.deactivated_at IS NULL
              WHERE p.created_by = $1 OR cr.user_id IS NOT NULL ORDER BY p.name LIMIT 200`, [user.userId]);
          res.json(rpcOk(id, {
            resources: r.rows.map((row: { id: string; name: string }) => ({
              uri: `role-room://project/${row.id}`, name: row.name || row.id, mimeType: "application/json",
            })),
          }));
          return;
        }
        case "resources/read": {
          const uri = String(rpc.params?.uri ?? "");
          const m = uri.match(/^role-room:\/\/project\/(.+)$/);
          if (!m) { res.json(rpcErr(id, -32602, "Ukjent ressurs-URI.")); return; }
          const cap = findCapability("rr_get_project");
          const result = await cap!.handler(pool, ctx, { projectId: m[1] });
          res.json(rpcOk(id, { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(result) }] }));
          return;
        }
        default:
          res.json(rpcErr(id, -32601, `Ukjent metode: ${method}`));
          return;
      }
    } catch (err) {
      if (err instanceof McpToolError) { res.json(rpcErr(id, err.code, err.message)); return; }
      console.error("[role-room-mcp] feil:", (err as Error).message);
      res.json(rpcErr(id, -32603, "Intern feil."));
    }
  });

  // Enkel oppdagbarhet: hvilke verktøy finnes (offentlig metadata, ingen data).
  router.get("/mcp/manifest", (_req, res) => {
    res.json({
      server: SERVER_INFO, protocolVersion: PROTOCOL_VERSION, transport: "POST /api/role-room/mcp (JSON-RPC 2.0)",
      auth: "Authorization: Bearer rri_…  (eller x-api-key: rri_…) — Integration v1-nøkkel",
      tools: ROLE_ROOM_CAPABILITIES.map((c) => ({ name: c.name, scope: c.scope, modes: c.modes, description: c.description })),
    });
  });

  return router;
}
