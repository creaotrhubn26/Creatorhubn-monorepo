/**
 * role-room-agent-threads-routes.ts
 *
 * HTTP-eksponering av eksisterende `role-room-agent-threads`-service så
 * iPad-appen kan bygge en native "Chat med Agent"-flate. Backend-koden
 * for tråd-persistens og SSE-streaming ER allerede produksjons-utprøvd
 * via web-chatten — denne fila legger bare et ekstra Express-mount over.
 *
 * Endepunkter (alle gated av activeSessions Bearer-token):
 *
 *   GET    /api/role-room/agent/threads?project_id=...&limit=20
 *          — liste alle threads brukeren eier (filtrert per prosjekt)
 *
 *   POST   /api/role-room/agent/threads
 *          body: { project_id: string, title?: string }
 *          — opprett ny thread
 *
 *   GET    /api/role-room/agent/threads/:id
 *          — full thread + alle meldinger
 *
 *   DELETE /api/role-room/agent/threads/:id
 *          — soft-delete (archived_at = now())
 *
 *   POST   /api/role-room/agent/threads/:id/messages
 *          body: { content: string, required_scope?: ConsentScope }
 *          — start ny SSE-stream som svar (reuses handleAgentStream)
 *
 * Streaming-endepunktet gjenbruker `handleAgentStream` fullstendig —
 * vi mapper kun project_id fra thread og setter req.body.threadId før
 * vi delegerer videre. Det betyr at consent-sjekk, pseudonymisering,
 * audit-log, rate-limit, entitlement, og persistering av meldinger
 * kjører nøyaktig samme kode som /projects/:projectId/agent/stream.
 *
 * RBAC/consent: handleAgentStream gjør requireActiveConsent(...) selv,
 * så vi trenger ikke pre-validere her. 403 propageres direkte fra
 * streaming-handleren via res.status før SSE åpnes.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  createThread,
  listThreads,
  getThread,
  archiveThread,
  updateThreadTitle,
} from "./role-room-agent-threads.js";
import { handleAgentStream } from "./role-room-agent-stream.js";

type SessionData = {
  userId: string;
  role?: string;
  email?: string;
};

export interface AgentThreadsRoutesDeps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  return activeSessions.get(token) ?? null;
}

/**
 * Slå opp thread-eierskap + project_id i én query. Brukes av endepunkter
 * som tar :id direkte og må vite hvilket prosjekt thread tilhører.
 */
async function loadThreadOwner(
  pool: Pool,
  threadId: string,
  userId: string,
): Promise<{ projectId: string } | null> {
  try {
    const r = await pool.query<{ project_id: string }>(
      `SELECT project_id::text
         FROM role_room_agent_threads
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
        LIMIT 1`,
      [threadId, userId],
    );
    return r.rows[0] ? { projectId: r.rows[0].project_id } : null;
  } catch {
    return null;
  }
}

export function registerRoleRoomAgentThreadsRoutes(
  deps: AgentThreadsRoutesDeps,
): void {
  const { app, pool, activeSessions } = deps;

  // ── GET /api/role-room/agent/threads?project_id=... ────────────────
  app.get(
    "/api/role-room/agent/threads",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId = typeof req.query.project_id === "string"
        ? req.query.project_id
        : typeof req.query.projectId === "string"
          ? req.query.projectId
          : "";
      if (!projectId) {
        res.status(400).json({ error: "project_id required" });
        return;
      }
      const includeArchived = req.query.include_archived === "true";
      const limitRaw = typeof req.query.limit === "string"
        ? parseInt(req.query.limit, 10)
        : 20;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 100)
        : 20;
      try {
        const threads = await listThreads(pool, projectId, session.userId, {
          includeArchived,
          limit,
        });
        res.json({
          threads: threads.map((t) => ({
            id: t.id,
            project_id: t.projectId,
            user_id: t.userId,
            title: t.title,
            created_at: t.createdAt,
            last_active_at: t.lastActiveAt,
            archived_at: t.archivedAt,
          })),
        });
      } catch (err) {
        console.error("[agent-threads GET list]", err);
        res.status(500).json({ error: "list_failed" });
      }
    },
  );

  // ── POST /api/role-room/agent/threads ──────────────────────────────
  app.post(
    "/api/role-room/agent/threads",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const body = (req.body ?? {}) as {
        project_id?: string;
        projectId?: string;
        title?: string;
      };
      const projectId = body.project_id ?? body.projectId ?? "";
      if (!projectId) {
        res.status(400).json({ error: "project_id required" });
        return;
      }
      const title = typeof body.title === "string"
        ? body.title.trim().slice(0, 200)
        : undefined;
      try {
        const created = await createThread(
          pool,
          projectId,
          session.userId,
          title && title.length > 0 ? title : undefined,
        );
        if (!created) {
          res.status(500).json({ error: "create_failed" });
          return;
        }
        res.status(201).json({
          thread: {
            id: created.id,
            project_id: created.projectId,
            user_id: created.userId,
            title: created.title,
            created_at: created.createdAt,
            last_active_at: created.lastActiveAt,
            archived_at: created.archivedAt,
          },
        });
      } catch (err) {
        console.error("[agent-threads POST create]", err);
        res.status(500).json({ error: "create_failed" });
      }
    },
  );

  // ── GET /api/role-room/agent/threads/:id ───────────────────────────
  app.get(
    "/api/role-room/agent/threads/:id",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const full = await getThread(pool, req.params.id, session.userId);
        if (!full) {
          res.status(404).json({ error: "thread_not_found" });
          return;
        }
        res.json({
          thread: {
            id: full.thread.id,
            project_id: full.thread.projectId,
            user_id: full.thread.userId,
            title: full.thread.title,
            created_at: full.thread.createdAt,
            last_active_at: full.thread.lastActiveAt,
            archived_at: full.thread.archivedAt,
          },
          messages: full.messages.map((m) => ({
            id: m.id,
            thread_id: m.threadId,
            role: m.role,
            text: m.text,
            response: m.response,
            created_at: m.createdAt,
          })),
        });
      } catch (err) {
        console.error("[agent-threads GET detail]", err);
        res.status(500).json({ error: "get_failed" });
      }
    },
  );

  // ── PATCH /api/role-room/agent/threads/:id ─────────────────────────
  // Rename. Body: { title }.
  app.patch(
    "/api/role-room/agent/threads/:id",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const title = typeof req.body?.title === "string"
        ? req.body.title.trim().slice(0, 200)
        : "";
      if (!title) {
        res.status(400).json({ error: "title required" });
        return;
      }
      try {
        const ok = await updateThreadTitle(
          pool,
          req.params.id,
          session.userId,
          title,
        );
        if (!ok) {
          res.status(404).json({ error: "thread_not_found" });
          return;
        }
        res.json({ ok: true });
      } catch (err) {
        console.error("[agent-threads PATCH]", err);
        res.status(500).json({ error: "patch_failed" });
      }
    },
  );

  // ── DELETE /api/role-room/agent/threads/:id ────────────────────────
  app.delete(
    "/api/role-room/agent/threads/:id",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const ok = await archiveThread(pool, req.params.id, session.userId);
        if (!ok) {
          res.status(404).json({ error: "thread_not_found" });
          return;
        }
        res.json({ ok: true, archived: true });
      } catch (err) {
        console.error("[agent-threads DELETE]", err);
        res.status(500).json({ error: "delete_failed" });
      }
    },
  );

  // ── POST /api/role-room/agent/threads/:id/messages ─────────────────
  // Send melding + start SSE-streaming-respons. Gjenbruker handleAgentStream
  // 1:1 — vi setter bare projectId fra thread og maper body.content →
  // body.userMessage før vi delegerer.
  //
  // Stream-events fra handleAgentStream:
  //   - event: start  data: { model, threadId }
  //   - event: delta  data: { text }
  //   - event: tool_use data: { id, name, input }
  //   - event: done   data: { model, threadId, usage, toolUses, transparency }
  //   - event: error  data: { message }
  app.post(
    "/api/role-room/agent/threads/:id/messages",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const owner = await loadThreadOwner(pool, req.params.id, session.userId);
      if (!owner) {
        res.status(404).json({ error: "thread_not_found" });
        return;
      }
      const body = (req.body ?? {}) as {
        content?: string;
        message?: string;
        userMessage?: string;
        required_scope?: string;
        requiredScope?: string;
      };
      const userMessage = body.content ?? body.message ?? body.userMessage ?? "";
      if (typeof userMessage !== "string" || userMessage.trim().length === 0) {
        res.status(400).json({ error: "content required" });
        return;
      }
      // Shimme req.body til formatet handleAgentStream forventer + sett
      // params.projectId (handleAgentStream leser fra req.params).
      req.body = {
        userMessage: userMessage.trim(),
        requiredScope: body.required_scope ?? body.requiredScope ?? "brief_only",
        threadId: req.params.id,
        persistThread: true,
      };
      (req.params as Record<string, string>).projectId = owner.projectId;
      try {
        await handleAgentStream(pool, req, res, session.userId, session.role);
      } catch (err) {
        if (!res.headersSent) {
          res.status(500).json({
            error: "stream_failed",
            detail: err instanceof Error ? err.message : String(err),
          });
        } else {
          res.end();
        }
      }
    },
  );

  console.log(
    "[role-room-agent-threads-routes] mounted at /api/role-room/agent/threads/*",
  );
}
