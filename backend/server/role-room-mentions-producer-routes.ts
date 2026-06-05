/**
 * role-room-mentions-producer-routes.ts — producer-facing social listening.
 *
 * "Who's talking about the client" — reads public posts where the client's
 * connected Facebook Page is tagged/mentioned (Graph `/{page-id}/tagged`),
 * so the content marketer can monitor brand mentions, respond, and turn
 * positive mentions into content or warm leads. Real-product surface on top of
 * the Page Mentions App Review demo (role-room-page-mentions-routes.ts): same
 * Graph call, but authenticated with the producer's session + the Page token
 * derived from the stored connection.
 *
 * Endpoints (requireAdminSession, user-isolated via the connection):
 *   GET  /api/role-room/mentions/producer?connectionId=...&limit=...
 *   POST /api/role-room/mentions/producer/status  { connectionId, mentionId, status }
 *
 * Live data needs Page Mentions App Review approval; until then the Graph call
 * returns an error which we surface (success:false) for the UI to explain.
 */

import type express from "express";
import type { Pool } from "pg";
import {
  getConnection,
  ensureFreshConnection,
  META_GRAPH_API_VERSION,
  type InstagramConnectionRow,
} from "./role-room-instagram-oauth.js";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
const MENTION_FIELDS = "id,from,message,story,created_time,permalink_url";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomMentionsProducerRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

// Triage status for a mention: responded / potential lead / hidden (+ unset = "ny").
export type MentionStatus = "svart" | "lead" | "skjult";
const VALID_STATUSES: MentionStatus[] = ["svart", "lead", "skjult"];

let mentionTriageSchemaReady = false;
async function ensureMentionTriageSchema(pool: Pool): Promise<void> {
  if (mentionTriageSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_mention_triage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      connection_id UUID NOT NULL,
      mention_external_id TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, mention_external_id)
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_rr_mention_triage_conn ON role_room_mention_triage(user_id, connection_id);`,
  );
  mentionTriageSchemaReady = true;
}

/** Map of mention_external_id → status for the given user. */
async function fetchMentionStatuses(pool: Pool, userId: string, ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const result = await pool.query(
    `SELECT mention_external_id, status FROM role_room_mention_triage
       WHERE user_id = $1 AND mention_external_id = ANY($2::text[])`,
    [userId, ids],
  );
  const map: Record<string, string> = {};
  for (const row of result.rows) map[String(row.mention_external_id)] = String(row.status);
  return map;
}

/** Derive a Page access token from the stored long-lived user token. */
async function getPageToken(connection: InstagramConnectionRow): Promise<string> {
  try {
    const url =
      `${GRAPH}/${encodeURIComponent(connection.facebookPageId)}` +
      `?fields=access_token&access_token=${encodeURIComponent(connection.accessToken)}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (res.ok && json.access_token) return json.access_token;
  } catch {
    /* fall through to user token */
  }
  return connection.accessToken;
}

export function setupRoleRoomMentionsProducerRoutes(deps: RoleRoomMentionsProducerRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ── GET /api/role-room/mentions/producer ────────────────────────────────
  app.get("/api/role-room/mentions/producer", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    const limit = typeof req.query.limit === "string" ? req.query.limit : "25";
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const fresh = await ensureFreshConnection(pool, connection);
      const pageToken = await getPageToken(fresh);
      const params = new URLSearchParams({ fields: MENTION_FIELDS, limit, access_token: pageToken });
      const upstream = await fetch(
        `${GRAPH}/${encodeURIComponent(fresh.facebookPageId)}/tagged?${params.toString()}`,
      );
      const body = (await upstream.json().catch(() => ({}))) as Record<string, any>;
      if (!upstream.ok) {
        res.status(200).json({
          success: false,
          error: body?.error?.message || `Graph ${upstream.status}`,
          mentions: [],
        });
        return;
      }
      const data = Array.isArray(body.data) ? body.data : [];
      await ensureMentionTriageSchema(pool);
      const statuses = await fetchMentionStatuses(pool, session.userId, data.map((m: Record<string, any>) => String(m.id)));
      res.json({
        success: true,
        pageName: fresh.facebookPageName,
        mentions: data.map((m: Record<string, any>) => ({
          id: m.id,
          from: m.from?.name ?? null,
          message: m.message ?? m.story ?? null,
          createdTime: m.created_time ?? null,
          permalinkUrl: m.permalink_url ?? null,
          status: statuses[String(m.id)] ?? null,
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/mentions/producer/status ────────────────────────
  // Triage a mention (svart/lead/skjult) or clear it.
  app.post("/api/role-room/mentions/producer/status", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string; mentionId?: string; status?: string | null };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const mentionId = typeof body.mentionId === "string" ? body.mentionId : "";
    const status = body.status;
    if (!connectionId || !mentionId) {
      res.status(400).json({ success: false, error: "connectionId and mentionId are required" });
      return;
    }
    if (status !== null && !VALID_STATUSES.includes(status as MentionStatus)) {
      res.status(400).json({ success: false, error: "invalid status" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureMentionTriageSchema(pool);
      if (status === null) {
        await pool.query(
          `DELETE FROM role_room_mention_triage WHERE user_id = $1 AND mention_external_id = $2`,
          [session.userId, mentionId],
        );
      } else {
        await pool.query(
          `INSERT INTO role_room_mention_triage (user_id, connection_id, mention_external_id, status)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, mention_external_id)
           DO UPDATE SET status = EXCLUDED.status, connection_id = EXCLUDED.connection_id, updated_at = now()`,
          [session.userId, connectionId, mentionId, status],
        );
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });
}
